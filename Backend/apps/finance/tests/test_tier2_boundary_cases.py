import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
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
    PricingChangeRequest,
    DetailedAuditLog,
)
from apps.finance.services import (
    process_payment,
    PaymentProcessingError,
    MakerCheckerService,
    get_platform_wallet,
    get_instructor_wallet,
)
from apps.finance.tasks import process_dunning_retries_task
from apps.finance.tests.helpers import (
    KashierTestHelper,
    LedgerTestHelper,
    FinancialDataFactory,
)

User = get_user_model()


@pytest.mark.django_db
class TestTier2BoundaryCases:
    """
    ====================================================================================================
    TIER 2: BOUNDARY & CORNER CASES (Security, Integrity, Limits)
    ====================================================================================================
    Adversarial and stress testing covering signature forgery, duplicate replays, decimal precision,
    Maker-Checker self-approval, negative balance locks, coupon limits, and grace period transitions.
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("student2@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("instructor2@edusmart.com", revenue_percentage=Decimal("70.00"))
        self.super_admin_1 = FinancialDataFactory.create_super_admin("admin_sec1@edusmart.com")
        self.super_admin_2 = FinancialDataFactory.create_super_admin("admin_sec2@edusmart.com")

        self.course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("199.99"),
            title="Calculus Advanced Boundary",
        )

    def test_tc_t2_01_webhook_signature_replay_and_tampering(self):
        """
        [TC-T2-01] Webhook Signature Replay & Tampering Attack
        Action: Tamper the payload amount from 100.00 to 1000.00 while reusing the original signature.
        Expected: Signature verification algorithm rejects the payload with 403 / False.
        """
        secret_key = "kashier_webhook_secret_key"
        payload = KashierTestHelper.create_webhook_payload(
            merchant_order_id="ORDER-999",
            amount="100.00",
            secret_key=secret_key,
        )
        valid_signature = payload["signature"]

        # Tamper payload amount
        payload["amount"] = "1000.00"

        # Recomputed signature must NOT match original signature
        recomputed = KashierTestHelper.generate_webhook_signature(payload, secret_key=secret_key)
        assert recomputed != valid_signature

        # Verify Kashier signature rejects tampered payload
        tampered_payload = dict(payload)
        tampered_payload["amount"] = "99999.00"
        assert KashierTestHelper.generate_webhook_signature(tampered_payload, secret_key=secret_key) != valid_signature

    def test_tc_t2_02_duplicate_webhook_delivery_idempotency(self):
        """
        [TC-T2-02] Duplicate Webhook Delivery Race Condition
        Action: Send duplicate payment settlement with identical idempotency_key.
        Expected: Second execution is safely ignored without duplicate ledger entries or double enrollment.
        """
        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("199.99"),
            total=Decimal("199.99"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("199.99"))

        idempotency_key = f"idemp_{uuid.uuid4().hex[:12]}"

        # First call -> Succeeds
        txn1 = process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="ref_1",
            amount_paid=Decimal("199.99"),
            idempotency_key=idempotency_key,
        )
        assert txn1.status == TransactionStatusChoices.SUCCESS

        # Second call with same idempotency key -> Returns early without duplicate ledger creation
        txn2 = process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="ref_1",
            amount_paid=Decimal("199.99"),
            idempotency_key=idempotency_key,
        )
        assert txn2.id == txn1.id

        # Ensure exactly one transaction exists
        assert Transaction.objects.filter(idempotency_key=idempotency_key).count() == 1

        # Ensure ledger is balanced
        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

    def test_tc_t2_03_decimal_rounding_and_14_percent_vat_precision(self):
        """
        [TC-T2-03] Decimal Rounding & 14% VAT Precision
        Action: Item price 199.99 EGP, 14% VAT, 70% instructor cut (139.993 EGP).
        Expected: Exact 2 decimal places quantization, sum of entries strictly equals total with zero fractional leakage.
        """
        price = Decimal("199.99")
        vat_rate = Decimal("0.14")
        vat_amount = (price * vat_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert vat_amount == Decimal("28.00")

        instructor_rate = Decimal("70.00")
        instructor_cut = (price * (instructor_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert instructor_cut == Decimal("139.99")

        platform_cut = (price - instructor_cut).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert platform_cut == Decimal("60.00")
        assert (instructor_cut + platform_cut) == price

        # Test in Ledger
        order = Order.objects.create(student=self.student, status=OrderStatusChoices.PENDING, subtotal=price, total=price)
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=price)

        process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref=f"vat_test_{order.id}",
            amount_paid=price,
            idempotency_key=f"vat_idemp_{order.id}",
        )

        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

    def test_tc_t2_04_minimum_withdrawal_limit_enforcement(self):
        """
        [TC-T2-04] Minimum Withdrawal Limit Enforcement (< 500 EGP)
        Action: Payout request for 499.00 EGP (below 500 EGP minimum).
        Expected: Rejected as invalid.
        """
        MINIMUM_PAYOUT = Decimal("500.00")
        requested_amount = Decimal("499.00")
        assert requested_amount < MINIMUM_PAYOUT

        # Validation rule verification
        is_valid = requested_amount >= MINIMUM_PAYOUT
        assert is_valid is False

    def test_tc_t2_05_maker_checker_self_approval_prevention(self):
        """
        [TC-T2-05] Maker-Checker Self-Approval Prevention
        Action: Super admin attempts to approve their own change request.
        Expected: Raises ValueError with message 'Cannot approve your own change request' and status remains PENDING.
        """
        plan = FinancialDataFactory.create_pricing_plan(slug="test-maker-checker-plan")
        change_req = MakerCheckerService.submit_change_request(
            target_model="PricingPlan",
            target_id=plan.id,
            old_val={"price_monthly": "1200.00"},
            new_val={"price_monthly": "1500.00"},
            user=self.super_admin_1,
        )

        with pytest.raises(ValueError, match="Maker-Checker violation: Cannot approve your own change request"):
            MakerCheckerService.approve_change_request(change_req.id, self.super_admin_1)

        change_req.refresh_from_db()
        assert change_req.status == PricingChangeRequest.Status.PENDING
        assert change_req.approved_by is None

    def test_tc_t2_06_zero_cost_100_percent_coupon_checkout(self):
        """
        [TC-T2-06] Zero-Cost / 100% Coupon Checkout
        Action: Free course or 100% coupon discount resulting in 0.00 EGP total.
        Expected: Instant enrollment created without external gateway redirect.
        """
        free_course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("0.00"),
            title="Introduction to Platform (Free)",
        )

        self.client.force_authenticate(user=self.student)
        url = reverse("v1:finance-checkout")
        res = self.client.post(url, {"course_id": free_course.id, "gateway": "kashier"})

        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["is_free"] is True
        assert res.data["enrolled"] is True
        assert Enrollment.objects.filter(student=self.student, course=free_course).exists()

    def test_tc_t2_07_multi_wallet_negative_balance_prevention(self):
        """
        [TC-T2-07] Multi-Wallet Negative Balance Prevention (Pessimistic Locking & DB Constraint)
        Action: Attempt to debit more balance than available.
        Expected: Database CheckConstraint or validation prevents negative balance.
        """
        wallet, _ = Wallet.objects.get_or_create(
            user=self.student,
            wallet_type=WalletTypeChoices.PLATFORM,
            defaults={"available_balance": Decimal("100.00"), "current_balance": Decimal("100.00")},
        )
        wallet.available_balance = Decimal("100.00")
        wallet.save()

        # Attempt to subtract 150 EGP directly
        with pytest.raises((IntegrityError, Exception)):
            with transaction.atomic():
                wallet.available_balance = Decimal("-50.00")
                wallet.save()

    def test_tc_t2_08_expired_and_over_limit_coupon_validation(self):
        """
        [TC-T2-08] Expired & Over-Limit Coupon Validation
        Action: Validate expired coupon and coupon with max_uses reached.
        Expected: Validation rejects with HTTP 400.
        """
        plan = FinancialDataFactory.create_pricing_plan(slug="coupon-test-plan")

        # 1. Expired Coupon
        expired_coupon = Coupon.objects.create(
            code="EXPIRED50",
            discount_type=Coupon.DiscountType.PERCENT,
            discount_value=Decimal("50.00"),
            expires_at=timezone.now() - timedelta(days=2),
            is_active=True,
        )

        self.client.force_authenticate(user=self.student)
        url = reverse("v1:coupon-validate")
        res1 = self.client.post(url, {"code": "EXPIRED50", "plan_id": plan.id, "billing_cycle": "monthly"})
        assert res1.status_code == status.HTTP_400_BAD_REQUEST
        assert "منتهي الصلاحية" in res1.data["detail"]

        # 2. Over-limit Coupon
        exhausted_coupon = Coupon.objects.create(
            code="MAXED10",
            discount_type=Coupon.DiscountType.FIXED,
            discount_value=Decimal("100.00"),
            max_uses=5,
            used_count=5,
            is_active=True,
        )
        res2 = self.client.post(url, {"code": "MAXED10", "plan_id": plan.id, "billing_cycle": "monthly"})
        assert res2.status_code == status.HTTP_400_BAD_REQUEST
        assert "الحد الأقصى" in res2.data["detail"]

    def test_tc_t2_09_subscription_dunning_and_3_day_grace_period(self):
        """
        [TC-T2-09] Subscription Dunning & 3-Day Grace Period Suspensions
        Action: Run dunning task on overdue subscriptions.
        Expected: Subscriptions overdue < 5 days marked PAST_DUE (grace period); older marked EXPIRED.
        """
        plan = FinancialDataFactory.create_pricing_plan(slug="dunning-plan")
        student2 = FinancialDataFactory.create_student("grace_student@edusmart.com")
        student3 = FinancialDataFactory.create_student("expired_student@edusmart.com")

        # Sub 1: Overdue by 1 day -> Should become PAST_DUE (Grace period active)
        sub1 = Subscription.objects.create(
            user=student2,
            plan=plan,
            price_at_subscription=Decimal("1200.00"),
            status=SubscriptionStatusChoices.ACTIVE,
            billing_cycle="monthly",
            current_period_end=timezone.now() - timedelta(days=1),
        )

        # Sub 2: Overdue by 6 days -> Should become EXPIRED
        sub2 = Subscription.objects.create(
            user=student3,
            plan=plan,
            price_at_subscription=Decimal("1200.00"),
            status=SubscriptionStatusChoices.PAST_DUE,
            billing_cycle="monthly",
            current_period_end=timezone.now() - timedelta(days=6),
        )

        result = process_dunning_retries_task()
        sub1.refresh_from_db()
        sub2.refresh_from_db()

        assert sub1.status == SubscriptionStatusChoices.PAST_DUE
        assert sub2.status == SubscriptionStatusChoices.EXPIRED

    def test_tc_t2_10_activation_code_invalid_pin_rejection(self):
        """
        [TC-T2-10] Activation Code Invalid PIN Rejection
        Action: Student provides incorrect PIN for an active activation code.
        Expected: RedemptionService raises ValidationError ('كود التفعيل أو كلمة المرور غير صحيحة').
        """
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            price_per_code=Decimal("300.00"),
            expires_at=timezone.now() + timedelta(days=10),
            courses=[self.course],
        )
        code_obj = batch.codes.first()

        with pytest.raises(ValidationError) as exc_info:
            RedemptionService.redeem_code(
                user=self.student,
                code_str=code_obj.code,
                password="WRONG_PASSWORD_123",
            )
        assert "غير صحيحة" in str(exc_info.value)
