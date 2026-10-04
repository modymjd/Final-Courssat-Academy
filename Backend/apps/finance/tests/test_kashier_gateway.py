import hashlib
import hmac
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.assessments.models import Exam
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.finance.models import (
    Coupon,
    EscrowHolding,
    EscrowStatusChoices,
    Invoice,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    Order,
    OrderItem,
    OrderStatusChoices,
    PaymentMethod,
    PaymentTransaction,
    PricingPlan,
    Subscription,
    SubscriptionStatusChoices,
    Transaction,
    TransactionStatus,
    TransactionStatusChoices,
    Wallet,
    WalletTypeChoices,
)
from apps.finance.services import (
    InvoiceGeneratorService,
    get_instructor_wallet,
    get_platform_wallet,
)
from apps.finance.services.kashier import (
    KashierAPIError,
    KashierConnectionError,
    KashierReconciliationService,
    KashierService,
)
from apps.finance.tasks import (
    process_dunning_retries_task,
    process_kashier_webhook_task,
    process_recurring_subscription_debit_task,
    send_pre_due_subscription_invoices_task,
)
from apps.finance.tests.helpers import (
    FinancialDataFactory,
    KashierTestHelper,
    LedgerTestHelper,
)
from apps.notifications.models import Notification

User = get_user_model()


@pytest.mark.django_db
class TestKashierCryptography:
    """
    Unit test coverage for Kashier HMAC-SHA256 hash generation,
    inbound signature verification, and payment method classification.
    """

    def test_generate_order_hash_verified_test_vector(self):
        """
        Asserts exact SHA-256 match with authoritative test vector:
        /?payment=MID-24326-928.ORD-105.400.00.EGP with key test_secret_key_123
        produces 3e63880a9b8c5d263d4eb19f05b18817acdaeb4e28ca08e043eb5f3f69508ca0.
        """
        merchant_id = "MID-24326-928"
        order_id = "ORD-105"
        amount = "400.00"
        currency = "EGP"
        iframe_key = "test_secret_key_123"

        computed = KashierService.generate_order_hash(
            merchant_id=merchant_id,
            order_id=order_id,
            amount=amount,
            currency=currency,
            iframe_key=iframe_key,
        )
        expected = "3e63880a9b8c5d263d4eb19f05b18817acdaeb4e28ca08e043eb5f3f69508ca0"
        assert computed == expected

    def test_generate_order_hash_instance_method(self):
        service = KashierService(
            merchant_id="MID-24326-928",
            iframe_key="test_secret_key_123",
            currency="EGP",
        )
        computed = service.compute_order_hash(
            order_id="ORD-105",
            amount=Decimal("400.00"),
        )
        assert computed == "3e63880a9b8c5d263d4eb19f05b18817acdaeb4e28ca08e043eb5f3f69508ca0"

    def test_verify_signature_success(self):
        """
        Asserts that valid concatenated query parameters with matching signature return True.
        """
        secret_key = "test_secret_key_123"
        payload = {
            "paymentStatus": "SUCCESS",
            "cardDataToken": "tok_kashier_998877",
            "maskedCard": "411111******1111",
            "merchantOrderId": "ORD-105",
            "orderId": "kashier_ord_554433",
            "cardBrand": "VISA",
            "orderReference": "REF-998877",
            "transactionId": "txn_kashier_001122",
            "amount": "400.00",
            "currency": "EGP",
        }
        # raw string: paymentStatus=SUCCESS&cardDataToken=tok_kashier_998877&maskedCard=411111******1111&merchantOrderId=ORD-105&orderId=kashier_ord_554433&cardBrand=VISA&orderReference=REF-998877&transactionId=txn_kashier_001122&amount=400.00&currency=EGP
        # with secret_key produces ceafb9f9b9ef02c565c58cbe6404fc5d454c9e20053b011df6a386dd6facaa7d
        signature = KashierTestHelper.generate_webhook_signature(payload, secret_key=secret_key)
        payload["signature"] = signature

        assert KashierService.verify_signature(payload, secret_key=secret_key) is True

    def test_verify_signature_tampered_amount_rejection(self):
        """
        Modifies amount from 400.00 to 4000.00 while keeping original signature,
        asserting verify_signature returns False.
        """
        secret_key = "test_secret_key_123"
        payload = {
            "paymentStatus": "SUCCESS",
            "merchantOrderId": "ORD-105",
            "amount": "400.00",
            "currency": "EGP",
        }
        sig = KashierTestHelper.generate_webhook_signature(payload, secret_key=secret_key)
        payload["amount"] = "4000.00"
        payload["signature"] = sig

        assert KashierService.verify_signature(payload, secret_key=secret_key) is False

    def test_verify_signature_missing_signature(self):
        assert KashierService.verify_signature({"amount": "100.00"}) is False
        assert KashierService.verify_signature({}) is False

    def test_classify_payment_methods(self):
        assert KashierService.classify_payment_method("VISA") == "kashier_card"
        assert KashierService.classify_payment_method("MASTERCARD") == "kashier_card"
        assert KashierService.classify_payment_method("MEEZA") == "kashier_meeza"
        assert KashierService.classify_payment_method("VODAFONE_CASH") == "kashier_vodafone_cash"
        assert KashierService.classify_payment_method("ORANGE_CASH") == "kashier_orange_cash"
        assert KashierService.classify_payment_method("ETISALAT_CASH") == "kashier_etisalat_cash"
        assert KashierService.classify_payment_method("WE_PAY") == "kashier_we_pay"
        assert KashierService.classify_payment_method("INSTAPAY") == "kashier_instapay"
        assert KashierService.classify_payment_method("VALU") == "kashier_valu"


@pytest.mark.django_db
class TestKashierCheckoutSessions:
    """
    Verification of unified checkout session generator across 4 monetization streams:
    Courses, Standalone Exams, SaaS Subscriptions, and Digital Wallet Deposits.
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("student_kashier@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("instructor_kashier@edusmart.com")
        self.course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("600.00"),
            title="Kashier Certified Advanced Physics",
        )
        self.plan = FinancialDataFactory.create_pricing_plan(
            name="Teacher Pro Plus",
            slug="teacher-pro-plus",
            price_monthly=Decimal("1500.00"),
            price_yearly=Decimal("15000.00"),
        )
        self.exam = Exam.objects.create(course=self.course)

    def test_create_checkout_session_course_endpoint(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:kashier-checkout-session")
        payload = {
            "resource_type": "course",
            "resource_id": str(self.course.id),
        }
        res = self.client.post(url, payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert "checkout_url" in res.data
        assert "hash" in res.data
        assert "merchant_order_id" in res.data
        assert res.data["merchant_order_id"].startswith("CRS-")
        assert res.data["amount"] == "600.00"
        assert res.data["currency"] == "EGP"

        # Verify pending order and initiated transaction created
        order = Order.objects.filter(student=self.student).first()
        assert order is not None
        assert order.status == OrderStatusChoices.PENDING
        assert order.total == Decimal("600.00")

    def test_create_checkout_session_course_with_coupon(self):
        coupon = Coupon.objects.create(
            code="KASHIER20",
            discount_type=Coupon.DiscountType.PERCENT,
            discount_value=Decimal("20.00"),
            is_active=True,
        )
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:kashier-checkout-session")
        payload = {
            "resource_type": "course",
            "resource_id": str(self.course.id),
            "coupon_code": "KASHIER20",
        }
        res = self.client.post(url, payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["amount"] == "480.00"

        order = Order.objects.filter(student=self.student).first()
        assert order.total == Decimal("480.00")
        assert order.discount_amount == Decimal("120.00")

    def test_create_checkout_session_exam(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:kashier-checkout-session")
        payload = {
            "resource_type": "exam",
            "resource_id": str(self.exam.id),
        }
        res = self.client.post(url, payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["merchant_order_id"].startswith("EXM-")

    def test_create_checkout_session_subscription(self):
        self.client.force_authenticate(user=self.instructor)
        url = reverse("v1:kashier-checkout-session")
        payload = {
            "resource_type": "subscription",
            "resource_id": str(self.plan.id),
            "billing_cycle": "monthly",
        }
        res = self.client.post(url, payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["merchant_order_id"].startswith("SUB-")
        assert res.data["amount"] == "1500.00"

        sub = Subscription.objects.filter(user=self.instructor).first()
        assert sub is not None
        assert sub.price_at_subscription == Decimal("1500.00")

    def test_create_checkout_session_wallet_deposit(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:kashier-checkout-session")
        payload = {
            "resource_type": "wallet_deposit",
            "resource_id": "0",
            "amount": "750.00",
        }
        res = self.client.post(url, payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["merchant_order_id"].startswith("WLT-")
        assert res.data["amount"] == "750.00"

    def test_create_checkout_session_already_enrolled_fails(self):
        Enrollment.objects.create(student=self.student, course=self.course)
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:kashier-checkout-session")
        res = self.client.post(url, {"resource_type": "course", "resource_id": str(self.course.id)})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestKashierWebhookReconciliation:
    """
    Verification of 100% idempotent webhook reconciliation, double-entry ledger settlements,
    student enrollment, subscription activation, and digital wallet credits.
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("student_wh@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("instructor_wh@edusmart.com", revenue_percentage=Decimal("80.00"))
        self.course = FinancialDataFactory.create_course(
            instructor=self.instructor,
            price=Decimal("500.00"),
            title="Calculus III Advanced",
        )
        self.plan = FinancialDataFactory.create_pricing_plan(
            name="Teacher Basic",
            slug="teacher-basic",
            price_monthly=Decimal("1200.00"),
        )

    def test_webhook_course_order_settlement_and_ledger(self):
        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("500.00"),
            total=Decimal("500.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("500.00"))

        secret_key = KashierService.get_iframe_key()
        payload = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"CRS-{order.id}-9999",
            amount="500.00",
            payment_status="SUCCESS",
            card_brand="VISA",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-webhook")
        res = self.client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "payment_completed"
        assert res.data["order_id"] == order.id

        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED
        assert Enrollment.objects.filter(student=self.student, course=self.course).exists()

        # Check double-entry ledger
        ledger = Ledger.objects.filter(reference_id__startswith=f"KASHIER_ORDER_{order.id}").first()
        assert ledger is not None
        LedgerTestHelper.assert_ledger_balanced(ledger)

        # Platform gets 500 - 400 = 100 net
        platform_wallet = get_platform_wallet()
        LedgerTestHelper.assert_wallet_balances(platform_wallet, current=Decimal("100.00"), available=Decimal("100.00"))

        # Instructor gets 400 in pending escrow (14-day hold)
        instructor_wallet = get_instructor_wallet(self.instructor)
        LedgerTestHelper.assert_wallet_balances(instructor_wallet, current=Decimal("400.00"), pending=Decimal("400.00"), available=Decimal("0.00"))

        # Verify EscrowHolding created with 14-day maturity
        holding = EscrowHolding.objects.filter(order=order, wallet=instructor_wallet).first()
        assert holding is not None
        assert holding.status == EscrowStatusChoices.HELD
        assert holding.amount == Decimal("400.00")
        assert holding.mature_at > timezone.now() + timedelta(days=13)

    def test_webhook_idempotent_duplicate_delivery(self):
        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("500.00"),
            total=Decimal("500.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("500.00"))

        secret_key = KashierService.get_iframe_key()
        payload = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"CRS-{order.id}-1234",
            amount="500.00",
            transaction_id="txn_unique_kash_999",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-webhook")
        res1 = self.client.post(url, payload, format="json")
        assert res1.status_code == status.HTTP_200_OK
        assert res1.data["status"] == "payment_completed"

        # Re-send same payload
        res2 = self.client.post(url, payload, format="json")
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data["status"] == "already_processed"

        # Enrollment count must remain 1
        assert Enrollment.objects.filter(student=self.student, course=self.course).count() == 1

    def test_webhook_tampered_signature_rejected(self):
        url = reverse("v1:kashier-webhook")
        payload = {
            "paymentStatus": "SUCCESS",
            "merchantOrderId": "CRS-1-1234",
            "amount": "500.00",
            "signature": "invalid_forged_signature_hex",
        }
        res = self.client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_webhook_subscription_activation_and_card_tokenization(self):
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=self.plan,
            price_at_subscription=Decimal("1200.00"),
            billing_cycle="monthly",
            status=SubscriptionStatusChoices.TRIALING,
            current_period_end=timezone.now() + timedelta(days=7),
        )

        secret_key = KashierService.get_iframe_key()
        payload = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"SUB-{sub.id}-5555",
            amount="1200.00",
            card_token="tok_kashier_card_777888",
            card_brand="VISA",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-webhook")
        res = self.client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "payment_completed"

        sub.refresh_from_db()
        assert sub.status == SubscriptionStatusChoices.ACTIVE
        assert sub.current_period_end > timezone.now() + timedelta(days=25)

        # Active PaymentMethod stored with tokenized cardDataToken
        pm = PaymentMethod.objects.filter(subscription=sub, is_active=True).first()
        assert pm is not None
        assert pm.gateway_ref == "tok_kashier_card_777888"
        assert pm.payment_channel == PaymentMethod.ChannelChoices.CARD
        assert pm.card_brand == "VISA"

        # Invoice generated
        txn = PaymentTransaction.objects.filter(subscription=sub).first()
        assert txn is not None
        invoice = Invoice.objects.filter(transaction=txn).first()
        assert invoice is not None
        assert invoice.eta_uuid is not None

    def test_webhook_wallet_topup_reconciliation(self):
        student_wallet, _ = Wallet.objects.get_or_create(
            user=self.student,
            wallet_type=WalletTypeChoices.PLATFORM,
            defaults={"available_balance": Decimal("100.00"), "current_balance": Decimal("100.00"), "currency": "EGP"},
        )
        student_wallet.available_balance = Decimal("100.00")
        student_wallet.current_balance = Decimal("100.00")
        student_wallet.save()

        secret_key = KashierService.get_iframe_key()
        payload = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"WLT-{student_wallet.id}-7777",
            amount="400.00",
            card_brand="VODAFONE_CASH",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-webhook")
        res = self.client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "payment_completed"

        student_wallet.refresh_from_db()
        assert student_wallet.available_balance == Decimal("500.00")
        assert student_wallet.current_balance == Decimal("500.00")

        ledger = Ledger.objects.filter(reference_id__startswith=f"KASHIER_TOPUP_{student_wallet.id}").first()
        assert ledger is not None
        LedgerTestHelper.assert_ledger_balanced(ledger)


@pytest.mark.django_db
class TestKashierBrowserCallbacks:
    """
    Verification of browser return callback signature validation and HTTP 302 redirects to Port 8080.
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("student_cb@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("instructor_cb@edusmart.com")
        self.course = FinancialDataFactory.create_course(instructor=self.instructor, price=Decimal("300.00"))
        self.plan = FinancialDataFactory.create_pricing_plan(name="Plan CB", price_monthly=Decimal("999.00"))

    def test_callback_course_success_redirect(self):
        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("300.00"),
            total=Decimal("300.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("300.00"))

        secret_key = KashierService.get_iframe_key()
        params = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"CRS-{order.id}-99",
            amount="300.00",
            payment_status="SUCCESS",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-callback")
        res = self.client.get(url, params)
        assert res.status_code == status.HTTP_302_FOUND
        assert "/checkout/success" in res.url
        assert f"order_id={order.id}" in res.url

        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED

    def test_callback_subscription_success_redirect(self):
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=self.plan,
            price_at_subscription=Decimal("999.00"),
            billing_cycle="monthly",
            current_period_end=timezone.now() + timedelta(days=30),
        )

        secret_key = KashierService.get_iframe_key()
        params = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"SUB-{sub.id}-11",
            amount="999.00",
            payment_status="SUCCESS",
            card_token="tok_sub_cb_123",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-callback")
        res = self.client.get(url, params)
        assert res.status_code == status.HTTP_302_FOUND
        assert "/pricing/success" in res.url
        assert f"subscription_id={sub.id}" in res.url

    def test_callback_wallet_topup_success_redirect(self):
        wallet, _ = Wallet.objects.get_or_create(
            user=self.student,
            wallet_type=WalletTypeChoices.PLATFORM,
            defaults={"currency": "EGP"},
        )
        secret_key = KashierService.get_iframe_key()
        params = KashierTestHelper.create_webhook_payload(
            merchant_order_id=f"WLT-{wallet.id}-22",
            amount="250.00",
            payment_status="SUCCESS",
            secret_key=secret_key,
        )

        url = reverse("v1:kashier-callback")
        res = self.client.get(url, params)
        assert res.status_code == status.HTTP_302_FOUND
        assert "/student/wallet" in res.url
        assert "status=topup_success" in res.url

    def test_callback_tampered_signature_redirect(self):
        url = reverse("v1:kashier-callback")
        params = {
            "paymentStatus": "SUCCESS",
            "merchantOrderId": "CRS-10-99",
            "signature": "forged_invalid_signature",
        }
        res = self.client.get(url, params)
        assert res.status_code == status.HTTP_302_FOUND
        assert "/checkout/failed?reason=tampered_signature" in res.url


@pytest.mark.django_db
class TestRecurringHybridEngineAndGracePeriod:
    """
    Verification of recurring tokenized auto-debit, pre-due renewal notifications,
    3-day grace period state machine, and dunning retries.
    """

    def setup_method(self):
        self.instructor = FinancialDataFactory.create_instructor("teacher_rec@edusmart.com")
        self.plan = FinancialDataFactory.create_pricing_plan(
            name="Teacher Premium Monthly",
            price_monthly=Decimal("1200.00"),
        )

    def test_recurring_auto_debit_tokenized_card_success(self):
        now = timezone.now()
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=self.plan,
            price_at_subscription=Decimal("1200.00"),
            billing_cycle="monthly",
            status=SubscriptionStatusChoices.ACTIVE,
            auto_renew=True,
            current_period_end=now - timedelta(hours=1),
        )
        PaymentMethod.objects.create(
            subscription=sub,
            gateway=PaymentMethod.GatewayChoices.KASHIER,
            gateway_ref="tok_valid_card_123",
            payment_channel=PaymentMethod.ChannelChoices.CARD,
            is_active=True,
        )

        # Mock Kashier charge_token success response
        mock_charge_response = {
            "success": True,
            "status": "SUCCESS",
            "transaction_id": "txn_rec_charge_9988",
            "raw_response": {"status": "SUCCESS"},
        }
        with patch.object(KashierService, "charge_token", return_value=mock_charge_response):
            result = process_recurring_subscription_debit_task()

        assert result["renewed"] == 1
        sub.refresh_from_db()
        assert sub.status == SubscriptionStatusChoices.ACTIVE
        assert sub.current_period_end > now + timedelta(days=25)
        assert sub.dunning_attempt_count == 0

        txn = PaymentTransaction.objects.filter(subscription=sub).first()
        assert txn is not None
        assert txn.status == TransactionStatus.PAID

    def test_recurring_auto_debit_declined_initiates_3day_grace_period(self):
        now = timezone.now()
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=self.plan,
            price_at_subscription=Decimal("1200.00"),
            billing_cycle="monthly",
            status=SubscriptionStatusChoices.ACTIVE,
            auto_renew=True,
            current_period_end=now - timedelta(hours=1),
        )
        PaymentMethod.objects.create(
            subscription=sub,
            gateway=PaymentMethod.GatewayChoices.KASHIER,
            gateway_ref="tok_declined_card_456",
            payment_channel=PaymentMethod.ChannelChoices.CARD,
            is_active=True,
        )

        mock_charge_response = {
            "success": False,
            "status": "FAILED",
            "error_code": "INSUFFICIENT_FUNDS",
            "error_message": "Card declined: insufficient funds",
        }
        with patch.object(KashierService, "charge_token", return_value=mock_charge_response):
            result = process_recurring_subscription_debit_task()

        assert result["failed_or_grace"] == 1
        sub.refresh_from_db()
        assert sub.status == SubscriptionStatusChoices.PAST_DUE
        assert sub.dunning_attempt_count == 1
        assert sub.grace_period_ends_at is not None
        assert sub.grace_period_ends_at <= sub.current_period_end + timedelta(days=3) + timedelta(seconds=10)

        # In-app notification sent
        notif = Notification.objects.filter(user=self.instructor).first()
        assert notif is not None
        assert "فترة السماح" in notif.title

    def test_send_pre_due_subscription_invoices_task(self):
        now = timezone.now()
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=self.plan,
            price_at_subscription=Decimal("1200.00"),
            billing_cycle="monthly",
            status=SubscriptionStatusChoices.ACTIVE,
            current_period_end=now + timedelta(days=2),
            pre_due_notified=False,
        )

        result = send_pre_due_subscription_invoices_task()
        assert result["notified_count"] == 1

        sub.refresh_from_db()
        assert sub.pre_due_notified is True

        notif = Notification.objects.filter(user=self.instructor).first()
        assert notif is not None
        assert "تذكير: اقتراب موعد تجديد الاشتراك" in notif.title

    def test_dunning_retries_and_grace_period_expiration_after_72_hours(self):
        now = timezone.now()
        # Subscription whose 3-day grace period has elapsed
        sub = Subscription.objects.create(
            user=self.instructor,
            plan=self.plan,
            price_at_subscription=Decimal("1200.00"),
            billing_cycle="monthly",
            status=SubscriptionStatusChoices.PAST_DUE,
            current_period_end=now - timedelta(days=4),
            grace_period_ends_at=now - timedelta(minutes=5),
        )
        PaymentMethod.objects.create(
            subscription=sub,
            gateway=PaymentMethod.GatewayChoices.KASHIER,
            gateway_ref="tok_expired_card",
            is_active=True,
        )

        result = process_dunning_retries_task()
        assert result["expired_count"] == 1

        sub.refresh_from_db()
        assert sub.status == SubscriptionStatusChoices.EXPIRED
        assert PaymentMethod.objects.filter(subscription=sub, is_active=True).count() == 0


@pytest.mark.django_db
class TestKashierRestInquiriesAndRefunds:
    """
    Verification of outbound REST inquiries (order status query) and refund processing.
    """

    def setup_method(self):
        self.service = KashierService(
            merchant_id="MID-24326-928",
            api_key="sandbox_kashier_api_key",
            base_url="https://test-api.kashier.io",
        )

    def test_get_order_status_success_mock(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "SUCCESS",
            "merchantOrderId": "CRS-100-1234",
            "amount": "500.00",
            "currency": "EGP",
        }
        with patch("requests.get", return_value=mock_resp):
            status_data = self.service.get_order_status("CRS-100-1234")
            assert status_data["status"] == "SUCCESS"
            assert status_data["amount"] == "500.00"

    def test_refund_payment_success_mock(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "SUCCESS",
            "transactionId": "txn_refund_123",
            "refundAmount": "500.00",
        }
        with patch("requests.post", return_value=mock_resp):
            refund_data = self.service.refund_payment(
                transaction_id="txn_kashier_001122",
                amount=Decimal("500.00"),
                reason="Customer course dissatisfaction refund",
            )
            assert refund_data["status"] == "SUCCESS"
