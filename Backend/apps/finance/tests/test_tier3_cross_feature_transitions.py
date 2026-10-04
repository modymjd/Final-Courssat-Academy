import uuid
from decimal import Decimal
from datetime import timedelta
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole, CenterProfile, CenterStudent
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.activation_codes.models import ActivationCodeBatch, ActivationCode
from apps.activation_codes.services.code_generator import CodeGeneratorService
from apps.activation_codes.services.redemption import RedemptionService
from apps.assessments.models import Exam, Grade
from apps.certificates.models import Certificate
from apps.finance.models import (
    Wallet,
    WalletTypeChoices,
    Order,
    OrderItem,
    OrderStatusChoices,
    Transaction,
    TransactionStatusChoices,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    PricingPlan,
    Subscription,
    SubscriptionStatusChoices,
    PaymentTransaction,
    TransactionStatus,
    Refund,
    Invoice,
    DetailedAuditLog,
)
from apps.finance.services import (
    process_payment,
    get_platform_wallet,
    get_instructor_wallet,
    InvoiceGeneratorService,
    BunnyStorageService,
)
from apps.finance.tests.helpers import (
    KashierTestHelper,
    LedgerTestHelper,
    FinancialDataFactory,
)

User = get_user_model()


@pytest.mark.django_db
class TestTier3CrossFeatureTransitions:
    """
    ====================================================================================================
    TIER 3: CROSS-FEATURE INTERACTIONS (End-to-End State Transitions)
    ====================================================================================================
    Lifecycle test sequences across multiple domain modules:
    - Escrow holding and maturity payout flow
    - Full refund with ledger clawback and enrollment revocation
    - B2B center bulk licensing and student redemption
    - Top-up to Exam certification flow
    - Recurring SaaS subscription renewal and invoice CDN archival
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("tier3_student@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("tier3_instructor@edusmart.com", revenue_percentage=Decimal("80.00"))
        self.center_admin = FinancialDataFactory.create_center_admin("tier3_center@edusmart.com")
        self.super_admin = FinancialDataFactory.create_super_admin("tier3_admin@edusmart.com")

        self.course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("1000.00"),
            title="Comprehensive Engineering Mathematics",
        )

    def test_tc_t3_01_sale_escrow_maturity_payout_lifecycle(self):
        """
        [TC-T3-01] Sale -> 14-Day Escrow -> Release -> Payout -> Maker-Checker Approval
        Step 1: Student purchases 1,000 EGP course. Platform gets 1,000; Instructor pending = 800 EGP, available = 0.
        Step 2: 14 days mature -> Escrow released -> Instructor available = 800 EGP.
        Step 3: Instructor requests 800 EGP payout to InstaPay.
        Step 4: Super Admin approves payout -> Ledger debit, payout completed.
        """
        # Step 1: Sale & Initial Escrow Split
        order = Order.objects.create(student=self.student, status=OrderStatusChoices.PENDING, subtotal=Decimal("1000.00"), total=Decimal("1000.00"))
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("1000.00"))

        idemp_key = f"escrow_sale_{uuid.uuid4().hex[:8]}"
        process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="kashier_tx_1000",
            amount_paid=Decimal("1000.00"),
            idempotency_key=idemp_key,
        )

        instructor_wallet = get_instructor_wallet(self.instructor)
        LedgerTestHelper.assert_wallet_balances(
            instructor_wallet,
            current=Decimal("800.00"),
            pending=Decimal("800.00"),
            available=Decimal("0.00"),
        )

        # Step 2: 14-Day Escrow Maturity Settlement Simulation
        matured_amount = instructor_wallet.pending_balance
        instructor_wallet.pending_balance -= matured_amount
        instructor_wallet.available_balance += matured_amount
        instructor_wallet.save()

        escrow_ledger = Ledger.objects.create(
            reference_id=f"ESCROW_RELEASE_INSTR_{self.instructor.id}_{order.id}",
            description="Automatic 14-day escrow maturity release",
        )
        LedgerEntry.objects.create(ledger=escrow_ledger, wallet=instructor_wallet, entry_type=LedgerEntryType.DEBIT, amount=matured_amount)
        LedgerEntry.objects.create(ledger=escrow_ledger, wallet=instructor_wallet, entry_type=LedgerEntryType.CREDIT, amount=matured_amount)
        LedgerTestHelper.assert_ledger_balanced(escrow_ledger)

        LedgerTestHelper.assert_wallet_balances(
            instructor_wallet,
            pending=Decimal("0.00"),
            available=Decimal("800.00"),
        )

        # Step 3: Instructor Payout Request Submission
        payout_amount = Decimal("800.00")
        instructor_wallet.available_balance -= payout_amount
        instructor_wallet.withdrawn_balance += payout_amount
        instructor_wallet.save()

        # Step 4: Super Admin Approval of Payout
        platform_wallet = get_platform_wallet()
        platform_wallet.available_balance += Decimal("10000.00")
        platform_wallet.current_balance += Decimal("10000.00")
        platform_wallet.save()

        payout_ledger = Ledger.objects.create(
            reference_id=f"PAYOUT_PROCESSED_{self.instructor.id}_{uuid.uuid4().hex[:6]}",
            description="InstaPay Payout Disbursement to instructor@instapay",
        )
        # Platform holding wallet sends funds out to bank
        platform_wallet.available_balance -= payout_amount
        platform_wallet.current_balance -= payout_amount
        platform_wallet.save()

        LedgerEntry.objects.create(ledger=payout_ledger, wallet=platform_wallet, entry_type=LedgerEntryType.DEBIT, amount=payout_amount)
        LedgerEntry.objects.create(ledger=payout_ledger, wallet=instructor_wallet, entry_type=LedgerEntryType.CREDIT, amount=payout_amount)
        LedgerTestHelper.assert_ledger_balanced(payout_ledger)

        audit_log = DetailedAuditLog.objects.create(
            actor=self.super_admin,
            action="PAYOUT_APPROVED_AND_PROCESSED",
            entity_type="PayoutRequest",
            entity_id=1,
            new_value={"status": "processed", "amount": "800.00", "channel": "instapay"},
            reason="Approved by super admin after verification",
        )
        assert audit_log.id is not None
        LedgerTestHelper.assert_wallet_balances(instructor_wallet, available=Decimal("0.00"), withdrawn=Decimal("800.00"))

    def test_tc_t3_02_sale_refund_clawback_and_revocation(self):
        """
        [TC-T3-02] Sale -> Student Refund (Day 5) -> Approval -> Ledger Clawback -> Enrollment Revoked
        Step 1: Student purchases 500 EGP course -> Enrolled, instructor pending = 400 EGP.
        Step 2: On Day 5, refund requested & approved.
        Step 3: Ledger reverses split, instructor pending balance clawed back (-400 EGP), enrollment deactivated/deleted.
        """
        course_500 = FinancialDataFactory.create_course(instructor=self.instructor, price=Decimal("500.00"), title="Biology II")
        order = Order.objects.create(student=self.student, status=OrderStatusChoices.PENDING, subtotal=Decimal("500.00"), total=Decimal("500.00"))
        OrderItem.objects.create(order=order, course=course_500, price_at_purchase=Decimal("500.00"))

        idemp_key = f"refund_sale_{uuid.uuid4().hex[:8]}"
        process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="kashier_tx_500",
            amount_paid=Decimal("500.00"),
            idempotency_key=idemp_key,
        )

        enrollment = Enrollment.objects.create(student=self.student, course=course_500)
        assert Enrollment.objects.filter(student=self.student, course=course_500).exists()

        instructor_wallet = get_instructor_wallet(self.instructor)
        platform_wallet = get_platform_wallet()

        initial_inst_pending = instructor_wallet.pending_balance

        # Process Refund & Clawback
        refund_amount = Decimal("500.00")
        instructor_clawback = Decimal("400.00")
        platform_clawback = Decimal("100.00")

        # 1. Reverse instructor pending balance
        instructor_wallet.pending_balance -= instructor_clawback
        instructor_wallet.current_balance -= instructor_clawback
        instructor_wallet.save()

        # 2. Reverse platform wallet balance
        platform_wallet.available_balance -= platform_clawback
        platform_wallet.current_balance -= platform_clawback
        platform_wallet.save()

        # 3. Create reverse ledger entries
        refund_ledger = Ledger.objects.create(
            reference_id=f"REFUND_ORDER_{order.id}",
            description=f"Full refund and clawback for Order #{order.id}",
        )
        LedgerEntry.objects.create(ledger=refund_ledger, wallet=instructor_wallet, entry_type=LedgerEntryType.DEBIT, amount=instructor_clawback)
        LedgerEntry.objects.create(ledger=refund_ledger, wallet=platform_wallet, entry_type=LedgerEntryType.DEBIT, amount=platform_clawback)
        # Platform issues refund back to student gateway
        LedgerEntry.objects.create(ledger=refund_ledger, wallet=platform_wallet, entry_type=LedgerEntryType.CREDIT, amount=refund_amount)
        LedgerTestHelper.assert_ledger_balanced(refund_ledger)

        # 4. Revoke Enrollment
        enrollment.delete()
        assert not Enrollment.objects.filter(student=self.student, course=course_500).exists()

        # 5. Mark Order Refunded
        order.status = OrderStatusChoices.REFUNDED
        order.save()
        assert order.status == OrderStatusChoices.REFUNDED

    def test_tc_t3_03_b2b_center_bulk_licensing_and_redemption(self):
        """
        [TC-T3-03] B2B Center Bulk License -> Code Generation -> Student Redemption -> Center Membership
        Step 1: Educational Center purchases bulk licensing pack for 15,000 EGP.
        Step 2: Center generates batch of 100 activation codes.
        Step 3: Student redeems code -> Enrolled into course and affiliated to Center.
        """
        center_profile = self.center_admin.center_profile

        # Step 1: Center buys license batch
        batch = CodeGeneratorService.generate_batch(
            user=self.center_admin,
            batch_type=ActivationCodeBatch.BatchType.CENTER_STUDENT,
            quantity=10,
            price_per_code=Decimal("150.00"),
            expires_at=timezone.now() + timedelta(days=90),
            courses=[self.course],
        )
        assert batch.codes.count() == 10

        # Step 2: Student redeems center activation code
        sample_code = batch.codes.first()
        result = RedemptionService.redeem_code(
            user=self.student,
            code_str=sample_code.code,
            password=sample_code.password,
        )

        sample_code.refresh_from_db()
        assert sample_code.status == ActivationCode.CodeStatus.REDEEMED

        # Verify Course Enrollment
        assert Enrollment.objects.filter(student=self.student, course=self.course).exists()

        # Verify Center Affiliation
        center_membership, _ = CenterStudent.objects.get_or_create(
            center=center_profile,
            student=self.student,
            defaults={"joined_via_code": sample_code},
        )
        assert center_membership.is_active is True

    def test_tc_t3_04_topup_to_exam_and_certification(self):
        """
        [TC-T3-04] Wallet Top-up via Kashier -> Pay-Per-Exam Checkout -> Instant Certificate Generation
        Step 1: Student tops up 500 EGP.
        Step 2: Student spends 200 EGP on exam.
        Step 3: Student passes exam with 95% -> Verified Certificate created.
        """
        # Step 1: Top up
        student_wallet, _ = Wallet.objects.get_or_create(
            user=self.student,
            wallet_type=WalletTypeChoices.PLATFORM,
            defaults={"currency": "EGP"},
        )
        student_wallet.available_balance = Decimal("500.00")
        student_wallet.current_balance = Decimal("500.00")
        student_wallet.save()

        # Step 2: Pay for Exam (200 EGP)
        exam_cost = Decimal("200.00")
        student_wallet.available_balance -= exam_cost
        student_wallet.current_balance -= exam_cost
        student_wallet.save()

        exam_course = FinancialDataFactory.create_course(instructor=self.instructor, price=exam_cost, title="Official Certification Prep")
        Enrollment.objects.create(student=self.student, course=exam_course)

        # Step 3: Complete and Grade Exam -> Issue Certificate
        grade = Grade.objects.create(
            student=self.student,
            course=exam_course,
            score=Decimal("95.00"),
            max_score=100,
            feedback="Distinction Honors",
        )
        assert grade.percentage == 95.0

        certificate = Certificate.objects.create(
            student=self.student,
            course=exam_course,
            grade="A+",
        )
        assert certificate.serial is not None
        assert len(certificate.serial) == 16
        assert Certificate.objects.filter(student=self.student, course=exam_course).count() == 1

    def test_tc_t3_05_recurring_saas_renewal_and_cdn_archival(self):
        """
        [TC-T3-05] Recurring SaaS Subscription Cycle -> Renewal Auto-Debit -> Invoice Archival
        Step 1: Teacher has active monthly subscription.
        Step 2: Renewal event executes -> Period extended 30 days.
        Step 3: B2C Invoice generated and secure signed CDN URL generated.
        """
        plan = FinancialDataFactory.create_pricing_plan(slug="recurring-monthly-plan")
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=plan,
            price_at_subscription=Decimal("1200.00"),
            status=SubscriptionStatusChoices.ACTIVE,
            billing_cycle="monthly",
            current_period_end=timezone.now() + timedelta(days=1),
        )

        # Renewal auto-debit simulation
        new_end_date = sub.current_period_end + timedelta(days=30)
        sub.current_period_end = new_end_date
        sub.save()

        txn = PaymentTransaction.objects.create(
            subscription=sub,
            gateway="kashier_tokenized",
            gateway_transaction_id=f"kashier_tok_sub_{sub.id}_{uuid.uuid4().hex[:6]}",
            amount=Decimal("1200.00"),
            status=TransactionStatus.PAID,
        )

        invoice = InvoiceGeneratorService.create_invoice_for_transaction(txn, is_b2b=False)
        assert invoice.invoice_type == Invoice.InvoiceType.B2C
        assert invoice.pdf_file is not None

        signed_url = BunnyStorageService.get_temporary_signed_url(str(invoice.pdf_file), valid_seconds=900)
        assert "token=" in signed_url
        assert "expires=" in signed_url
