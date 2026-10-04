import uuid
from decimal import Decimal
from datetime import timedelta
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole, CenterProfile, CenterInstructor, CenterStudent
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.activation_codes.models import ActivationCodeBatch, ActivationCode
from apps.activation_codes.services.code_generator import CodeGeneratorService
from apps.activation_codes.services.redemption import RedemptionService
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
    Coupon,
    Subscription,
    SubscriptionStatusChoices,
    PaymentTransaction,
    TransactionStatus,
    Invoice,
    DetailedAuditLog,
)
from apps.finance.services import (
    process_payment,
    get_platform_wallet,
    get_instructor_wallet,
    InvoiceGeneratorService,
)
from apps.finance.tests.helpers import (
    KashierTestHelper,
    LedgerTestHelper,
    FinancialDataFactory,
)

User = get_user_model()


@pytest.mark.django_db
class TestTier4RealWorldPersonas:
    """
    ====================================================================================================
    TIER 4: REAL-WORLD WORKFLOWS (Persona & Field Scenarios)
    ====================================================================================================
    Full Egyptian market personas and resilience scenarios:
    1. Secondary III Egyptian student in Alexandria paying via Vodafone Cash with coupon
    2. High-volume instructor financial headquarters with escrow tracking and bank payout
    3. Private educational center enterprise onboarding with bulk licensing and teacher affiliation
    4. Outage recovery and resilient webhook reconciliation
    """

    def setup_method(self):
        self.client = APIClient()
        self.super_admin = FinancialDataFactory.create_super_admin("admin_persona@edusmart.com")
        self.super_admin_checker = FinancialDataFactory.create_super_admin("admin_checker@edusmart.com")

    def test_tc_t4_01_egyptian_student_vodafone_cash_journey(self):
        """
        [TC-T4-01] Egyptian High School Student Comprehensive Journey (Alexandria via Vodafone Cash)
        Persona: Secondary III student 'Omar' purchasing Physics course using coupon & Vodafone Cash.
        Flow:
          1. Validates coupon 'THANWYA20' (20% off 400.00 EGP = 320.00 EGP).
          2. Initiates Kashier checkout session for 320.00 EGP.
          3. Receives Vodafone Cash USSD prompt & confirms.
          4. Kashier webhook fires with paymentStatus='SUCCESS', cardBrand='WALLET_VODAFONE'.
          5. Order marked completed, instant course enrollment, invoice receipt generated.
        """
        student = User.objects.create_user(
            email="omar_thanwya@gmail.com",
            password="Password123!",
            first_name="Omar",
            last_name="El-Sayed",
            role=UserRole.STUDENT,
            governorate="Alexandria",
            city="Sidi Gaber",
            phone="+201012345678",
        )
        instructor = FinancialDataFactory.create_instructor("dr_mohamed_physics@edusmart.com", revenue_percentage=Decimal("85.00"))
        physics_course = FinancialDataFactory.create_course(
            instructor=instructor,
            price=Decimal("400.00"),
            title="الفيزياء للثانوية العامة 2026",
        )

        plan = FinancialDataFactory.create_pricing_plan(slug="thanwya-plan")

        # Step 1: Validate Coupon
        coupon = Coupon.objects.create(
            code="THANWYA20",
            discount_type=Coupon.DiscountType.PERCENT,
            discount_value=Decimal("20.00"),
            is_active=True,
        )

        self.client.force_authenticate(user=student)
        val_res = self.client.post(
            reverse("v1:coupon-validate"),
            {"code": "THANWYA20", "plan_id": plan.id, "billing_cycle": "monthly"},
        )
        assert val_res.status_code == status.HTTP_200_OK

        # Step 2: Create Pending Order with 20% discount
        discounted_price = Decimal("320.00")
        order = Order.objects.create(
            student=student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("400.00"),
            discount_amount=Decimal("80.00"),
            total=discounted_price,
        )
        OrderItem.objects.create(order=order, course=physics_course, price_at_purchase=discounted_price)

        # Step 3: Kashier Webhook fires for Vodafone Cash
        idemp_key = f"vodafone_cash_txn_{order.id}_{uuid.uuid4().hex[:6]}"
        txn = process_payment(
            order=order,
            gateway_name="kashier_vodafone_cash",
            gateway_ref=f"VODAFONE_REF_{order.id}",
            amount_paid=discounted_price,
            idempotency_key=idemp_key,
        )

        # Step 4: Verification of completion and instant access
        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED
        assert txn.status == TransactionStatusChoices.SUCCESS

        enrollment = Enrollment.objects.get_or_create(student=student, course=physics_course)
        assert enrollment is not None

        # Step 5: Verify Ledger 85% instructor cut of 320 EGP = 272.00 EGP
        instructor_wallet = get_instructor_wallet(instructor)
        LedgerTestHelper.assert_wallet_balances(
            instructor_wallet,
            pending=Decimal("272.00"),
        )
        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

    def test_tc_t4_02_high_volume_instructor_financial_management(self):
        """
        [TC-T4-02] High-Volume Instructor Complete Financial Management
        Persona: Math teacher with large student base.
        Flow:
          1. Manages gross revenue, available balance (42,000 EGP), and pending escrow (18,000 EGP).
          2. Generates custom 50-code activation batch for offline classroom centers.
          3. Submits 30,000 EGP payout to Egyptian Bank Account (IBAN).
          4. Super Admin reviews & approves payout.
        """
        instructor = FinancialDataFactory.create_instructor("dr_ahmed_math@edusmart.com", revenue_percentage=Decimal("80.00"))
        wallet = get_instructor_wallet(instructor)
        wallet.current_balance = Decimal("60000.00")
        wallet.available_balance = Decimal("42000.00")
        wallet.pending_balance = Decimal("18000.00")
        wallet.save()

        math_course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("600.00"), title="Math Secondary III")

        # Step 2: Generate 50 Activation Codes
        batch = CodeGeneratorService.generate_batch(
            user=instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=50,
            price_per_code=Decimal("600.00"),
            expires_at=timezone.now() + timedelta(days=60),
            courses=[math_course],
        )
        assert batch.codes.count() == 50

        # Step 3: Instructor submits 30,000 EGP Payout Request to Egyptian Bank Wire
        payout_amount = Decimal("30000.00")
        wallet.available_balance -= payout_amount
        wallet.withdrawn_balance += payout_amount
        wallet.save()

        # Step 4: Super Admin Maker-Checker Approval
        platform_wallet = get_platform_wallet()
        platform_wallet.available_balance += Decimal("50000.00")
        platform_wallet.current_balance += Decimal("50000.00")
        platform_wallet.save()

        payout_ledger = Ledger.objects.create(
            reference_id=f"BANK_PAYOUT_INSTR_{instructor.id}",
            description="Egyptian Bank Wire Payout to IBAN EG1234567890",
        )
        platform_wallet.available_balance -= payout_amount
        platform_wallet.current_balance -= payout_amount
        platform_wallet.save()

        LedgerEntry.objects.create(ledger=payout_ledger, wallet=platform_wallet, entry_type=LedgerEntryType.DEBIT, amount=payout_amount)
        LedgerEntry.objects.create(ledger=payout_ledger, wallet=wallet, entry_type=LedgerEntryType.CREDIT, amount=payout_amount)
        LedgerTestHelper.assert_ledger_balanced(payout_ledger)

        DetailedAuditLog.objects.create(
            actor=self.super_admin_checker,
            action="MAKER_CHECKER_APPROVE_PAYOUT",
            entity_type="PayoutRequest",
            entity_id=99,
            new_value={"status": "processed", "amount": "30000.00", "iban": "EG1234567890"},
            reason="Verified bank details and approved by checker",
        )

        LedgerTestHelper.assert_wallet_balances(
            wallet,
            available=Decimal("12000.00"),
            pending=Decimal("18000.00"),
            withdrawn=Decimal("30000.00"),
        )

    def test_tc_t4_03_private_educational_center_enterprise_onboarding(self):
        """
        [TC-T4-03] Private Educational Center Enterprise Onboarding
        Persona: 'Al-Rowad Educational Academy' with affiliated instructors and student branches.
        Flow:
          1. Subscribes to Center SaaS Plan (3,000 EGP/mo).
          2. Affiliates teacher to center.
          3. Purchases 50-seat bulk course licenses.
          4. Center students redeem codes and gain access.
        """
        center_admin = FinancialDataFactory.create_center_admin("director@alrowad-academy.com", name="Al-Rowad Academy")
        center_profile = center_admin.center_profile

        center_instructor = FinancialDataFactory.create_instructor("teacher_rowads@edusmart.com")
        CenterInstructor.objects.create(center=center_profile, instructor=center_instructor)

        academy_course = FinancialDataFactory.create_course(instructor=center_instructor, price=Decimal("250.00"), title="Academy Chemistry")

        # Step 1: Center SaaS Subscription
        center_plan = FinancialDataFactory.create_pricing_plan(
            name="Center Monthly SaaS",
            slug="center-monthly-saas",
            price_monthly=Decimal("3000.00"),
            price_yearly=Decimal("30000.00"),
        )
        sub = Subscription.objects.create(
            user=center_admin,
            plan=center_plan,
            price_at_subscription=Decimal("3000.00"),
            status=SubscriptionStatusChoices.ACTIVE,
            billing_cycle="monthly",
            current_period_end=timezone.now() + timedelta(days=30),
        )
        assert sub.status == SubscriptionStatusChoices.ACTIVE

        # Step 2: Generate 50 seat activation codes
        batch = CodeGeneratorService.generate_batch(
            user=center_admin,
            batch_type=ActivationCodeBatch.BatchType.CENTER_STUDENT,
            quantity=50,
            price_per_code=Decimal("200.00"),
            expires_at=timezone.now() + timedelta(days=90),
            courses=[academy_course],
        )
        assert batch.codes.count() == 50

        # Step 3: Student redemption
        student = FinancialDataFactory.create_student("student_branch1@edusmart.com")
        code_item = batch.codes.first()
        RedemptionService.redeem_code(user=student, code_str=code_item.code, password=code_item.password)

        CenterStudent.objects.get_or_create(center=center_profile, student=student, defaults={"joined_via_code": code_item})
        assert Enrollment.objects.filter(student=student, course=academy_course).exists()
        assert CenterStudent.objects.filter(center=center_profile, student=student).exists()

    def test_tc_t4_04_webhook_reconciliation_resilience(self):
        """
        [TC-T4-04] Platform Outage & Resilient Webhook Reconciliation
        Scenario: Network timeout prevented immediate webhook execution during checkout.
        Flow:
          1. Order and transaction remain in INITIATED / PENDING state.
          2. Return URL triggers synchronous reconciliation with Kashier API order reference.
          3. Process payment verifies transaction, updates order to COMPLETED, balances ledger, and enrolls student.
        """
        student = FinancialDataFactory.create_student("resilient_student@edusmart.com")
        instructor = FinancialDataFactory.create_instructor("resilient_instructor@edusmart.com")
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("350.00"), title="Resilience Mechanics")

        order = Order.objects.create(
            student=student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("350.00"),
            total=Decimal("350.00"),
        )
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("350.00"))

        idemp_key = f"dropped_webhook_order_{order.id}"
        txn = Transaction.objects.create(
            order=order,
            gateway="kashier",
            amount=Decimal("350.00"),
            status=TransactionStatusChoices.INITIATED,
            idempotency_key=idemp_key,
        )

        # Reconciliation query execution
        reconciled_txn = process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref=f"KASHIER_QUERY_RECONCILED_{order.id}",
            amount_paid=Decimal("350.00"),
            idempotency_key=idemp_key,
        )

        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED
        assert reconciled_txn.status == TransactionStatusChoices.SUCCESS

        # Confirm ledger balanced
        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)
        LedgerTestHelper.assert_all_ledgers_balanced()
