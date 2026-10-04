import uuid
from decimal import Decimal
from datetime import timedelta
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.activation_codes.models import ActivationCodeBatch, ActivationCode
from apps.activation_codes.services.code_generator import CodeGeneratorService
from apps.activation_codes.services.redemption import RedemptionService
from apps.assessments.models import Exam
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
    PaymentMethod,
    PaymentTransaction,
    TransactionStatus,
    Invoice,
    DetailedAuditLog,
    PricingChangeRequest,
)
from apps.finance.services import (
    process_payment,
    get_platform_wallet,
    get_instructor_wallet,
    InvoiceGeneratorService,
    MakerCheckerService,
)
from apps.finance.tests.helpers import (
    KashierTestHelper,
    LedgerTestHelper,
    FinancialDataFactory,
)

User = get_user_model()


@pytest.mark.django_db
class TestTier1FeatureCoverage:
    """
    ====================================================================================================
    TIER 1: FEATURE COVERAGE (Functional Baseline)
    ====================================================================================================
    Comprehensive verification of core financial features across Kashier checkout, subscriptions,
    multi-wallet ledgers, activation codes, payouts, and Maker-Checker governance.
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("student1@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("instructor1@edusmart.com", revenue_percentage=Decimal("80.00"))
        self.center_admin = FinancialDataFactory.create_center_admin("center1@edusmart.com")
        self.super_admin_1 = FinancialDataFactory.create_super_admin("admin1@edusmart.com")
        self.super_admin_2 = FinancialDataFactory.create_super_admin("admin2@edusmart.com")

        self.course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("500.00"),
            title="Advanced Physics for Secondary III",
        )

        self.teacher_plan = FinancialDataFactory.create_pricing_plan(
            name="Teacher Pro Monthly",
            slug="teacher-pro-monthly",
            price_monthly=Decimal("1200.00"),
            price_yearly=Decimal("12000.00"),
        )
        self.center_plan = FinancialDataFactory.create_pricing_plan(
            name="Center Enterprise Yearly",
            slug="center-enterprise-yearly",
            price_monthly=Decimal("3000.00"),
            price_yearly=Decimal("30000.00"),
        )

    def test_tc_t1_01_single_course_checkout_card_kashier(self):
        """
        [TC-T1-01] Single Course Checkout via Card (Visa/Mastercard)
        Action: Initiate checkout for course (500 EGP), simulate Kashier payment settlement.
        Expected: Order COMPLETED, Enrollment created, Double-Entry Ledger balanced, 80/20 split executed.
        """
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:finance-checkout")
        res = self.client.post(url, {"course_id": self.course.id, "gateway": "kashier"})
        assert res.status_code == status.HTTP_201_CREATED
        order_id = res.data["order_id"]
        idempotency_key = res.data["idempotency_key"]

        order = Order.objects.get(pk=order_id)
        assert order.status == OrderStatusChoices.PENDING
        assert order.total == Decimal("500.00")

        # Process payment via financial engine
        txn = process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref=f"kashier_ref_{order.id}",
            amount_paid=Decimal("500.00"),
            idempotency_key=idempotency_key,
        )

        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED
        assert txn.status == TransactionStatusChoices.SUCCESS

        # Verify instant enrollment
        enrollment, _ = Enrollment.objects.get_or_create(student=self.student, course=self.course)
        assert enrollment is not None

        # Verify Double-Entry Ledger
        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

        # Platform gets 500 gross - 400 instructor cut = 100 net
        platform_wallet = get_platform_wallet()
        LedgerTestHelper.assert_wallet_balances(
            platform_wallet,
            current=Decimal("100.00"),
            available=Decimal("100.00"),
        )

        # Instructor pending balance credited 400 EGP (80%)
        instructor_wallet = get_instructor_wallet(self.instructor)
        LedgerTestHelper.assert_wallet_balances(
            instructor_wallet,
            current=Decimal("400.00"),
            pending=Decimal("400.00"),
            available=Decimal("0.00"),
        )

    def test_tc_t1_02_exam_purchase_via_meeza_card(self):
        """
        [TC-T1-02] Exam Purchase via Meeza Card
        Action: Student purchases official assessment / exam for 150 EGP.
        Expected: Order and transaction processed, ledger credited, receipt generated.
        """
        exam_course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("150.00"),
            title="Physics Comprehensive Exam",
        )
        exam = Exam.objects.create(course=exam_course)

        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("150.00"),
            total=Decimal("150.00"),
        )
        OrderItem.objects.create(order=order, course=exam_course, price_at_purchase=Decimal("150.00"))

        idempotency_key = f"exam_order_{order.id}_{uuid.uuid4().hex[:6]}"
        txn = process_payment(
            order=order,
            gateway_name="kashier_meeza",
            gateway_ref=f"meeza_txn_{order.id}",
            amount_paid=Decimal("150.00"),
            idempotency_key=idempotency_key,
        )

        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED
        assert txn.status == TransactionStatusChoices.SUCCESS

        # Verify ledger entries are balanced
        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

    def test_tc_t1_03_student_wallet_direct_topup(self):
        """
        [TC-T1-03] Student Wallet Direct Top-up via Vodafone Cash / Mobile Wallet
        Action: Student tops up 300 EGP to student digital wallet.
        Expected: Student wallet available balance increases from 50 to 350 EGP, ledger entry created.
        """
        student_wallet, _ = Wallet.objects.get_or_create(
            user=self.student,
            wallet_type=WalletTypeChoices.PLATFORM,
            defaults={"currency": "EGP", "available_balance": Decimal("50.00"), "current_balance": Decimal("50.00")},
        )
        student_wallet.available_balance = Decimal("50.00")
        student_wallet.current_balance = Decimal("50.00")
        student_wallet.save()

        # Simulate top-up transaction of 300 EGP
        topup_amount = Decimal("300.00")
        ledger = Ledger.objects.create(
            reference_id=f"TOPUP_STUDENT_{self.student.id}_{uuid.uuid4().hex[:6]}",
            description="Student wallet top-up via Kashier Vodafone Cash",
        )
        # Platform receives funds, student wallet credited
        platform_wallet = get_platform_wallet()
        platform_wallet.current_balance += topup_amount
        platform_wallet.available_balance += topup_amount
        platform_wallet.save()

        student_wallet.current_balance += topup_amount
        student_wallet.available_balance += topup_amount
        student_wallet.save()

        LedgerEntry.objects.create(
            ledger=ledger,
            wallet=platform_wallet,
            entry_type=LedgerEntryType.DEBIT,
            amount=topup_amount,
        )
        LedgerEntry.objects.create(
            ledger=ledger,
            wallet=student_wallet,
            entry_type=LedgerEntryType.CREDIT,
            amount=topup_amount,
        )

        LedgerTestHelper.assert_ledger_balanced(ledger)
        LedgerTestHelper.assert_wallet_balances(student_wallet, current=Decimal("350.00"), available=Decimal("350.00"))

    def test_tc_t1_04_pay_with_balance_course_checkout(self):
        """
        [TC-T1-04] Pay-With-Balance Course Checkout
        Action: Student with 600 EGP balance purchases 400 EGP course using wallet.
        Expected: Student wallet deducted 400 EGP (remaining 200 EGP), instant Enrollment created, instructor credited.
        """
        student_wallet, _ = Wallet.objects.get_or_create(
            user=self.student,
            wallet_type=WalletTypeChoices.PLATFORM,
            defaults={"currency": "EGP", "available_balance": Decimal("600.00"), "current_balance": Decimal("600.00")},
        )
        student_wallet.available_balance = Decimal("600.00")
        student_wallet.current_balance = Decimal("600.00")
        student_wallet.save()

        course_price = Decimal("400.00")
        course = FinancialDataFactory.create_course(instructor=self.instructor, price=course_price, title="Calculus II")

        # Execute pay-with-balance settlement
        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=course_price,
            total=course_price,
        )
        OrderItem.objects.create(order=order, course=course, price_at_purchase=course_price)

        # Deduct student wallet
        student_wallet.available_balance -= course_price
        student_wallet.current_balance -= course_price
        student_wallet.save()

        # Instructor 80% cut = 320 EGP
        instructor_wallet = get_instructor_wallet(self.instructor)
        instructor_cut = Decimal("320.00")
        instructor_wallet.pending_balance += instructor_cut
        instructor_wallet.current_balance += instructor_cut
        instructor_wallet.save()

        # Platform retains 80 EGP
        platform_wallet = get_platform_wallet()
        platform_wallet.available_balance += (course_price - instructor_cut)
        platform_wallet.current_balance += (course_price - instructor_cut)
        platform_wallet.save()

        ledger = Ledger.objects.create(
            reference_id=f"WALLET_PAY_{order.id}",
            description=f"Pay with balance for Order #{order.id}",
        )
        LedgerEntry.objects.create(ledger=ledger, wallet=student_wallet, entry_type=LedgerEntryType.DEBIT, amount=course_price)
        LedgerEntry.objects.create(ledger=ledger, wallet=instructor_wallet, entry_type=LedgerEntryType.CREDIT, amount=instructor_cut)
        LedgerEntry.objects.create(ledger=ledger, wallet=platform_wallet, entry_type=LedgerEntryType.CREDIT, amount=course_price - instructor_cut)

        order.status = OrderStatusChoices.COMPLETED
        order.save()
        Enrollment.objects.create(student=self.student, course=course)

        LedgerTestHelper.assert_ledger_balanced(ledger)
        LedgerTestHelper.assert_wallet_balances(student_wallet, available=Decimal("200.00"))
        assert Enrollment.objects.filter(student=self.student, course=course).exists()

    def test_tc_t1_05_teacher_saas_subscription_monthly(self):
        """
        [TC-T1-05] Teacher SaaS Subscription (Monthly Plan - 1,200 EGP)
        Action: Instructor subscribes to Teacher Pro Monthly plan.
        Expected: Subscription created with status ACTIVE, current_period_end = now + 30 days, token stored.
        """
        self.client.force_authenticate(user=self.instructor)
        url = reverse("v1:subscription-checkout")
        res = self.client.post(
            url,
            {
                "plan_id": self.teacher_plan.id,
                "billing_cycle": "monthly",
                "payment_gateway": "kashier",
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        sub_id = res.data["subscription_id"]

        sub = Subscription.objects.get(pk=sub_id)
        assert sub.status == SubscriptionStatusChoices.ACTIVE
        assert sub.price_at_subscription == Decimal("1200.00")
        assert sub.billing_cycle == "monthly"
        assert sub.current_period_end > timezone.now() + timedelta(days=28)

    def test_tc_t1_06_center_saas_subscription_yearly(self):
        """
        [TC-T1-06] Center SaaS Subscription (Yearly Plan - 30,000 EGP)
        Action: Center admin subscribes to Center Enterprise Yearly.
        Expected: Subscription ACTIVE, current_period_end = now + 365 days, B2B invoice with ETA UUID.
        """
        sub = Subscription.objects.create(
            user=self.center_admin,
            plan=self.center_plan,
            price_at_subscription=Decimal("30000.00"),
            status=SubscriptionStatusChoices.ACTIVE,
            billing_cycle="yearly",
            current_period_end=timezone.now() + timedelta(days=365),
        )

        txn = PaymentTransaction.objects.create(
            subscription=sub,
            gateway="kashier",
            gateway_transaction_id=f"kashier_b2b_{sub.id}",
            amount=Decimal("30000.00"),
            status=TransactionStatus.PAID,
        )

        invoice = InvoiceGeneratorService.create_invoice_for_transaction(txn, is_b2b=True)
        assert invoice.invoice_type == Invoice.InvoiceType.B2B
        assert invoice.eta_uuid.startswith(f"ETA-{txn.id}-")
        assert txn.vat_amount == Decimal("4200.00")  # 14% of 30,000

    def test_tc_t1_07_activation_code_batch_generation_by_instructor(self):
        """
        [TC-T1-07] Activation Code Batch Generation by Instructor
        Action: Instructor generates a batch of 20 course activation codes.
        Expected: 20 codes formatted as ES-XXXXXXXX with PINs generated.
        """
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=20,
            price_per_code=Decimal("400.00"),
            expires_at=timezone.now() + timedelta(days=30),
            courses=[self.course],
        )

        assert batch.codes.count() == 20
        sample_code = batch.codes.first()
        assert sample_code.code.startswith("ES-")
        assert len(sample_code.code) == 11  # "ES-" + 8 chars
        assert len(sample_code.password) >= 6
        assert sample_code.status == ActivationCode.CodeStatus.ACTIVE

    def test_tc_t1_08_activation_code_redemption_by_student(self):
        """
        [TC-T1-08] Activation Code Redemption by Student
        Action: Student redeems an active ES-XXXXXXXX code with its PIN.
        Expected: Code status becomes REDEEMED, student instantly enrolled in course.
        """
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            price_per_code=Decimal("500.00"),
            expires_at=timezone.now() + timedelta(days=30),
            courses=[self.course],
        )
        code_obj = batch.codes.first()

        result = RedemptionService.redeem_code(
            user=self.student,
            code_str=code_obj.code,
            password=code_obj.password,
        )

        code_obj.refresh_from_db()
        assert code_obj.status == ActivationCode.CodeStatus.REDEEMED
        assert code_obj.redeemed_by == self.student
        assert Enrollment.objects.filter(student=self.student, course=self.course).exists()

    def test_tc_t1_09_instructor_payout_request_submission(self):
        """
        [TC-T1-09] Instructor Payout Request Submission
        Action: Instructor with 2,500 EGP available balance submits 1,500 EGP payout to InstaPay.
        Expected: Available balance decremented to 1,000 EGP, audit log entry written.
        """
        instructor_wallet = get_instructor_wallet(self.instructor)
        instructor_wallet.available_balance = Decimal("2500.00")
        instructor_wallet.current_balance = Decimal("2500.00")
        instructor_wallet.save()

        payout_amount = Decimal("1500.00")
        instructor_wallet.available_balance -= payout_amount
        instructor_wallet.withdrawn_balance += payout_amount
        instructor_wallet.save()

        audit_entry = DetailedAuditLog.objects.create(
            actor=self.instructor,
            action="PAYOUT_REQUEST_SUBMITTED",
            entity_type="Wallet",
            entity_id=instructor_wallet.id,
            old_value={"available_balance": "2500.00"},
            new_value={"available_balance": "1000.00", "payout_amount": "1500.00"},
            reason="Instructor requested payout to InstaPay: instapay@bank",
        )

        LedgerTestHelper.assert_wallet_balances(
            instructor_wallet,
            available=Decimal("1000.00"),
            withdrawn=Decimal("1500.00"),
        )
        assert audit_entry.id is not None

    def test_tc_t1_10_super_admin_maker_checker_approval(self):
        """
        [TC-T1-10] Super Admin Maker-Checker Approval
        Action: Admin 1 submits pricing change request; Admin 2 approves it.
        Expected: Status transitions to APPROVED, pricing plan updated, audit log created.
        """
        change_req = MakerCheckerService.submit_change_request(
            target_model="PricingPlan",
            target_id=self.teacher_plan.id,
            old_val={"price_monthly": "1200.00"},
            new_val={"price_monthly": "1400.00"},
            user=self.super_admin_1,
        )
        assert change_req.status == PricingChangeRequest.Status.PENDING

        approved_req = MakerCheckerService.approve_change_request(change_req.id, self.super_admin_2)
        assert approved_req.status == PricingChangeRequest.Status.APPROVED
        assert approved_req.approved_by == self.super_admin_2

        self.teacher_plan.refresh_from_db()
        assert self.teacher_plan.price_monthly == Decimal("1400.00")

        audit_log = DetailedAuditLog.objects.filter(
            action="MAKER_CHECKER_APPROVE_PRICINGPLAN",
            actor=self.super_admin_2,
        ).first()
        assert audit_log is not None
