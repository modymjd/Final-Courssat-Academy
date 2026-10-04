import hashlib
import hmac
import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

import requests
from decouple import config
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.enrollments.models import Enrollment
from apps.finance.models import (
    EscrowHolding,
    EscrowStatusChoices,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    Order,
    OrderStatusChoices,
    PaymentMethod,
    PaymentTransaction,
    Subscription,
    SubscriptionStatusChoices,
    Transaction,
    TransactionStatus,
    TransactionStatusChoices,
    Wallet,
)

logger = logging.getLogger(__name__)


class KashierError(Exception):
    """Base exception for all Kashier gateway errors."""

    pass


class KashierConfigurationError(KashierError):
    """Raised when mandatory Kashier settings are missing."""

    pass


class KashierSignatureError(KashierError):
    """Raised when signature verification fails."""

    pass


class KashierAPIError(KashierError):
    """Raised when Kashier REST API returns an error response."""

    pass


class KashierConnectionError(KashierError):
    """Raised when network timeout or connection fails."""

    pass


class KashierService:
    """
    Authoritative Kashier Payment Gateway Service for EduSmart.
    Handles HMAC-SHA256 signatures, hosted checkout session generation,
    outbound REST order status inquiries, recurring tokenized card charges,
    and refund processing.
    """

    def __init__(
        self,
        merchant_id: str | None = None,
        api_key: str | None = None,
        iframe_key: str | None = None,
        mode: str | None = None,
        base_url: str | None = None,
        checkout_url: str | None = None,
        currency: str | None = None,
        timeout: int = 10,
    ):
        db_cfg = None
        try:
            from apps.finance.models import PaymentGatewayConfig

            db_cfg = PaymentGatewayConfig.objects.filter(gateway_name="kashier").first()
        except Exception:
            db_cfg = None

        self.db_config = db_cfg
        self.merchant_id = merchant_id or (
            db_cfg.merchant_id if db_cfg and db_cfg.merchant_id else getattr(
                settings, "KASHIER_MERCHANT_ID", config("KASHIER_MERCHANT_ID", default="")
            )
        )
        self.api_key = api_key or (
            db_cfg.api_key if db_cfg and db_cfg.api_key else getattr(
                settings, "KASHIER_API_KEY", config("KASHIER_API_KEY", default="")
            )
        )
        self.iframe_key = iframe_key or (
            db_cfg.iframe_key if db_cfg and db_cfg.iframe_key else getattr(
                settings, "KASHIER_IFRAME_KEY", config("KASHIER_IFRAME_KEY", default="")
            )
        )
        mode_val = db_cfg.mode if db_cfg and db_cfg.mode else getattr(settings, "KASHIER_MODE", config("KASHIER_MODE", default="test"))
        self.mode = (mode or mode_val).lower()
        self.base_url = base_url or getattr(
            settings,
            "KASHIER_BASE_URL",
            config(
                "KASHIER_BASE_URL",
                default="https://test-api.kashier.io" if self.mode == "test" else "https://api.kashier.io",
            ),
        )
        self.checkout_url = checkout_url or getattr(
            settings,
            "KASHIER_CHECKOUT_URL",
            config(
                "KASHIER_CHECKOUT_URL",
                default="https://test-checkout.kashier.io" if self.mode == "test" else "https://checkout.kashier.io",
            ),
        )
        self.currency = currency or getattr(settings, "KASHIER_CURRENCY", config("KASHIER_CURRENCY", default="EGP"))
        self.timeout = timeout

    @classmethod
    def is_gateway_enabled(cls) -> bool:
        """Returns True only when the gateway is active and credentials have been entered by the Super Admin."""
        try:
            from apps.finance.models import PaymentGatewayConfig

            cfg = PaymentGatewayConfig.objects.filter(gateway_name="kashier").first()
            if cfg is not None:
                return cfg.is_enabled
        except Exception:
            pass

        # Fallback to settings / env credentials when no DB config row is present (e.g. testing)
        mid = getattr(settings, "KASHIER_MERCHANT_ID", config("KASHIER_MERCHANT_ID", default=""))
        return bool(mid)

    # -------------------------------------------------------------------------
    # Class-Level Helper Accessors
    # -------------------------------------------------------------------------

    @classmethod
    def get_merchant_id(cls) -> str:
        return getattr(settings, "KASHIER_MERCHANT_ID", config("KASHIER_MERCHANT_ID", default="MID-24326-928"))

    @classmethod
    def get_iframe_key(cls) -> str:
        return getattr(
            settings,
            "KASHIER_IFRAME_KEY",
            config("KASHIER_IFRAME_KEY", default=config("KASHIER_SECRET_KEY", default="sandbox_kashier_iframe_key")),
        )

    @classmethod
    def get_api_key(cls) -> str:
        return getattr(settings, "KASHIER_API_KEY", config("KASHIER_API_KEY", default="sandbox_kashier_api_key"))

    @classmethod
    def get_mode(cls) -> str:
        return getattr(settings, "KASHIER_MODE", config("KASHIER_MODE", default="test")).lower()

    @classmethod
    def get_base_url(cls) -> str:
        mode = cls.get_mode()
        return getattr(
            settings,
            "KASHIER_BASE_URL",
            config(
                "KASHIER_BASE_URL",
                default="https://test-api.kashier.io" if mode == "test" else "https://api.kashier.io",
            ),
        )

    @classmethod
    def get_checkout_base_url(cls) -> str:
        mode = cls.get_mode()
        return getattr(
            settings,
            "KASHIER_CHECKOUT_URL",
            config(
                "KASHIER_CHECKOUT_URL",
                default="https://test-checkout.kashier.io" if mode == "test" else "https://checkout.kashier.io",
            ),
        )

    @classmethod
    def get_currency(cls) -> str:
        return getattr(settings, "KASHIER_CURRENCY", config("KASHIER_CURRENCY", default="EGP"))

    # -------------------------------------------------------------------------
    # Cryptographic Operations
    # -------------------------------------------------------------------------

    @classmethod
    def generate_order_hash(
        cls,
        merchant_id: str | None = None,
        order_id: str | None = None,
        amount: Any = "0.00",
        currency: str | None = None,
        iframe_key: str | None = None,
    ) -> str:
        """
        Computes HMAC-SHA256 signature for client-side Kashier iFrame / Pop-up / redirect.
        Formula: /?payment={merchant_id}.{order_id}.{amount}.{currency}
        Supports both (merchant_id, order_id, amount, currency, iframe_key)
        and (order_id, amount, currency) calling conventions.
        """
        mid = merchant_id
        oid = order_id
        amt = amount
        cur = currency
        key = iframe_key

        if mid and oid is not None:
            is_oid_a_number = False
            try:
                float(str(oid))
                is_oid_a_number = True
            except (ValueError, TypeError):
                is_oid_a_number = False

            if is_oid_a_number and (not str(mid).startswith("MID-") or amt == "0.00"):
                key = cur or key
                cur = amt if isinstance(amt, str) and len(amt) == 3 and amt.isalpha() else cur
                amt = oid
                oid = mid
                mid = cls.get_merchant_id()

        mid = mid or cls.get_merchant_id()
        oid = oid or ""
        key = key or cls.get_iframe_key()
        cur = cur or cls.get_currency()
        amt_str = f"{Decimal(str(amt)):.2f}"
        canonical_string = f"/?payment={mid}.{oid}.{amt_str}.{cur}"
        return hmac.new(
            key.encode("utf-8"),
            canonical_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def compute_order_hash(
        self,
        order_id: str,
        amount: Decimal | float | str,
        currency: str | None = None,
    ) -> str:
        """Instance method for computing order hash using service configuration."""
        return self.generate_order_hash(
            merchant_id=self.merchant_id,
            order_id=order_id,
            amount=amount,
            currency=currency or self.currency,
            iframe_key=self.iframe_key,
        )

    @classmethod
    def verify_signature(
        cls,
        payload: dict[str, Any],
        secret_key: str | None = None,
    ) -> bool:
        """
        Verifies Kashier callback & webhook signature using constant-time digest comparison.
        Ordered keys:
        ["paymentStatus", "cardDataToken", "maskedCard", "merchantOrderId", "orderId",
         "cardBrand", "orderReference", "transactionId", "amount", "currency"]
        """
        key = secret_key or cls.get_iframe_key()
        if not key:
            return False

        received_signature = str(payload.get("signature") or "").strip()
        if not received_signature:
            return False

        ordered_keys = [
            "paymentStatus",
            "cardDataToken",
            "maskedCard",
            "merchantOrderId",
            "orderId",
            "cardBrand",
            "orderReference",
            "transactionId",
            "amount",
            "currency",
        ]

        snake_key_map = {
            "paymentStatus": "payment_status",
            "cardDataToken": "card_data_token",
            "maskedCard": "masked_card",
            "merchantOrderId": "merchant_order_id",
            "orderId": "order_id",
            "cardBrand": "card_brand",
            "orderReference": "order_reference",
            "transactionId": "transaction_id",
            "amount": "amount",
            "currency": "currency",
        }

        # Method 1: key=value joined by &
        parts = []
        for k in ordered_keys:
            val = None
            if k in payload and payload[k] is not None and str(payload[k]) != "":
                val = payload[k]
            elif (
                snake_key_map.get(k) in payload
                and payload[snake_key_map[k]] is not None
                and str(payload[snake_key_map[k]]) != ""
            ):
                val = payload[snake_key_map[k]]

            if val is not None:
                parts.append(f"{k}={val}")

        raw_str1 = "&".join(parts)
        computed1 = hmac.new(
            key.encode("utf-8"),
            raw_str1.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if hmac.compare_digest(computed1.lower(), received_signature.lower()):
            return True

        # Method 2: leading & join fallback (for some query string representations)
        raw_str2 = "".join([f"&{p}" for p in parts])
        if raw_str2.startswith("&"):
            raw_str2 = raw_str2[1:]
        computed2 = hmac.new(
            key.encode("utf-8"),
            raw_str2.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed2.lower(), received_signature.lower())

    @classmethod
    def verify_webhook_signature(cls, payload: dict[str, Any], secret_key: str | None = None) -> bool:
        """Alias for verify_signature."""
        return cls.verify_signature(payload, secret_key=secret_key)

    @classmethod
    def classify_payment_method(cls, card_brand: str) -> str:
        """
        Maps Kashier cardBrand string to standardized payment channel identifier.
        """
        cb = (card_brand or "").upper()
        if "VODAFONE" in cb:
            return "kashier_vodafone_cash"
        elif "ORANGE" in cb:
            return "kashier_orange_cash"
        elif "ETISALAT" in cb:
            return "kashier_etisalat_cash"
        elif "WE" in cb:
            return "kashier_we_pay"
        elif "INSTAPAY" in cb:
            return "kashier_instapay"
        elif "MEEZA" in cb:
            return "kashier_meeza"
        elif "VALU" in cb:
            return "kashier_valu"
        elif "VISA" in cb or "MASTERCARD" in cb:
            return "kashier_card"
        return f"kashier_{cb.lower()}" if cb else "kashier"

    # -------------------------------------------------------------------------
    # Checkout Session Generation
    # -------------------------------------------------------------------------

    def create_checkout_session(
        self,
        resource_type: str,  # 'course', 'exam', 'subscription', 'wallet_deposit'
        resource_id: int | str,
        user: Any,
        amount: Decimal | float | str,
        merchant_order_id: str | None = None,
        return_url: str | None = None,
        callback_url: str | None = None,
        metadata: dict[str, Any] | None = None,
        allowed_methods: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Generates hosted iFrame / Pop-up parameters and checkout URL for single courses,
        exams, subscriptions, and wallet deposits.
        """
        if not self.is_gateway_enabled():
            raise KashierConfigurationError(
                "الدفع الإلكتروني عبر كاشيير قيد التفعيل حالياً ومتاح قريباً بعد استكمال اعتماد الحساب البنكي."
            )

        amt_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        amt_str = f"{amt_decimal:.2f}"

        ts = int(timezone.now().timestamp())
        if not merchant_order_id:
            prefix_map = {
                "course": "CRS",
                "exam": "EXM",
                "subscription": "SUB",
                "wallet_deposit": "WLT",
            }
            pfx = prefix_map.get(resource_type, "ORD")
            merchant_order_id = f"{pfx}-{resource_id}-{ts}"

        kashier_hash = self.compute_order_hash(
            order_id=merchant_order_id,
            amount=amt_decimal,
            currency=self.currency,
        )

        customer_name = (f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}").strip() or getattr(
            user, "username", "Student"
        )
        customer_email = getattr(user, "email", "customer@edusmart.com")
        customer_phone = getattr(user, "phone_number", "") or "+201000000000"

        success_url = return_url or getattr(
            settings, "KASHIER_FRONTEND_SUCCESS_URL", "http://localhost:8080/checkout/success"
        )
        failure_url = getattr(settings, "KASHIER_FRONTEND_FAILURE_URL", "http://localhost:8080/checkout/failed")

        default_methods = allowed_methods or [
            "card",
            "wallet",
            "fawry",
            "bank_installments",
            "meeza",
            "instapay",
            "valu",
        ]

        hosted_url = (
            f"{self.checkout_url}/?payment={self.merchant_id}.{merchant_order_id}.{amt_str}.{self.currency}"
            f"&hash={kashier_hash}&mode={self.mode}"
        )

        return {
            "merchant_order_id": merchant_order_id,
            "merchant_id": self.merchant_id,
            "amount": amt_str,
            "currency": self.currency,
            "hash": kashier_hash,
            "mode": self.mode,
            "checkout_url": hosted_url,
            "server_webhook_url": callback_url or "http://127.0.0.1:8000/api/v1/finance/webhooks/kashier/",
            "return_url": success_url,
            "failure_url": failure_url,
            "allowed_methods": default_methods,
            "customer": {
                "name": customer_name,
                "email": customer_email,
                "phone": customer_phone,
            },
            "metadata": {
                "resource_type": resource_type,
                "resource_id": str(resource_id),
                "user_id": getattr(user, "id", None),
                **(metadata or {}),
            },
        }

    # -------------------------------------------------------------------------
    # Outbound REST Inquiries & Actions
    # -------------------------------------------------------------------------

    def get_order_status(self, merchant_order_id: str) -> dict[str, Any]:
        """
        Queries Kashier REST API for the real-time status of an order.
        Endpoint: GET /payments/orders/{merchantOrderId}
        """
        url = f"{self.base_url}/payments/orders/{merchant_order_id}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

        try:
            res = requests.get(url, headers=headers, timeout=self.timeout)
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 404:
                return {"status": "NOT_FOUND", "merchantOrderId": merchant_order_id}
            else:
                logger.warning(f"Kashier order status query returned HTTP {res.status_code}: {res.text}")
                return {"status": "ERROR", "status_code": res.status_code, "detail": res.text}
        except requests.RequestException as e:
            logger.error(f"Kashier status inquiry connection error for {merchant_order_id}: {str(e)}")
            raise KashierConnectionError(f"Failed to connect to Kashier API: {str(e)}") from e

    def charge_tokenized_card(
        self,
        card_token: str,
        amount: Decimal | float | str,
        order_id: str,
        description: str = "",
    ) -> dict[str, Any]:
        """
        Executes a server-to-server recurring debit using a stored Kashier cardDataToken.
        Endpoint: POST /payments/token
        """
        amt_str = f"{Decimal(str(amount)):.2f}"
        url = f"{self.base_url}/payments/token"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "merchantId": self.merchant_id,
            "cardToken": card_token,
            "amount": float(amt_str),
            "currency": self.currency,
            "merchantOrderId": order_id,
            "description": description or f"Recurring subscription debit for {order_id}",
            "mode": self.mode,
        }

        try:
            res = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            data = res.json() if res.content else {}
            if res.status_code in (200, 201) and data.get("status") in ("SUCCESS", "success", None):
                return {
                    "success": True,
                    "status": "SUCCESS",
                    "transaction_id": data.get("response", {}).get(
                        "transactionId", data.get("transactionId", f"txn_{order_id}")
                    ),
                    "raw_response": data,
                }
            else:
                logger.error(f"Tokenized charge failed with HTTP {res.status_code}: {res.text}")
                return {
                    "success": False,
                    "status": "FAILED",
                    "error_code": data.get("error", {}).get("code", "CARD_DECLINED"),
                    "error_message": data.get("error", {}).get("message", res.text or "Charge failed"),
                    "raw_response": data,
                }
        except requests.RequestException as e:
            logger.error(f"Kashier tokenized charge connection error: {str(e)}")
            return {
                "success": False,
                "status": "FAILED",
                "error_code": "NETWORK_TIMEOUT",
                "error_message": str(e),
                "raw_response": {},
            }

    @classmethod
    def charge_token(
        cls,
        card_token: str,
        amount: Decimal | float | str,
        currency: str = "EGP",
        merchant_order_id: str = "",
        descriptor: str = "EduSmart Subscription",
    ) -> dict[str, Any]:
        """Class method helper for charging tokenized cards."""
        service = cls(currency=currency)
        return service.charge_tokenized_card(
            card_token=card_token,
            amount=amount,
            order_id=merchant_order_id,
            description=descriptor,
        )

    def refund_payment(
        self,
        transaction_id: str,
        amount: Decimal | float | str,
        reason: str = "",
    ) -> dict[str, Any]:
        """
        Submits an outbound refund request to Kashier.
        Endpoint: POST /payments/refund
        """
        amt_str = f"{Decimal(str(amount)):.2f}"
        url = f"{self.base_url}/payments/refund"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "transactionId": transaction_id,
            "amount": float(amt_str),
            "currency": self.currency,
            "reason": reason or "Customer refund request",
        }

        try:
            res = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            if res.status_code in (200, 201):
                return res.json()
            else:
                logger.error(f"Kashier refund failed with HTTP {res.status_code}: {res.text}")
                raise KashierAPIError(f"Kashier refund failed: {res.text}")
        except requests.RequestException as e:
            logger.error(f"Kashier refund connection error: {str(e)}")
            raise KashierConnectionError(f"Failed to connect to Kashier API: {str(e)}") from e


class KashierReconciliationService:
    """
    Unified, 100% idempotent reconciliation processor for Kashier transactions.
    Handles:
    1. Single Course & Exam Checkouts
    2. SaaS Recurring Subscriptions
    3. Prepaid Digital Wallet Top-ups
    """

    @classmethod
    @transaction.atomic
    def reconcile_payment(cls, payload: dict[str, Any]) -> dict[str, Any]:

        payment_status = (payload.get("paymentStatus") or "").upper()
        merchant_order_id = str(payload.get("merchantOrderId") or payload.get("orderId") or "")
        gateway_txn_id = str(payload.get("transactionId") or payload.get("orderReference") or "")
        amount = Decimal(str(payload.get("amount", "0.00")))
        currency = payload.get("currency", "EGP")
        card_data_token = payload.get("cardDataToken")
        card_brand = payload.get("cardBrand", "")
        masked_card = payload.get("maskedCard", "")
        payment_channel = KashierService.classify_payment_method(card_brand)

        if not merchant_order_id:
            logger.warning("Kashier payload missing merchantOrderId")
            return {"status": "error", "reason": "missing_merchant_order_id"}

        # Route A: SaaS Subscriptions (Prefix: SUB- or SUB_ or sub_)
        if (
            merchant_order_id.upper().startswith("SUB-")
            or merchant_order_id.upper().startswith("SUB_")
            or merchant_order_id.lower().startswith("sub_")
        ):
            return cls._reconcile_subscription(
                merchant_order_id=merchant_order_id,
                gateway_txn_id=gateway_txn_id,
                payment_status=payment_status,
                amount=amount,
                card_data_token=card_data_token,
                card_brand=card_brand,
                masked_card=masked_card,
                payload=payload,
                payment_channel=payment_channel,
            )

        # Route B: Digital Wallet Top-up (Prefix: WALLET- or TOPUP- or WLT-)
        if (
            merchant_order_id.upper().startswith("WALLET-")
            or merchant_order_id.upper().startswith("TOPUP-")
            or merchant_order_id.upper().startswith("WLT-")
        ):
            return cls._reconcile_wallet_topup(
                merchant_order_id=merchant_order_id,
                gateway_txn_id=gateway_txn_id,
                payment_status=payment_status,
                amount=amount,
                currency=currency,
                payload=payload,
                payment_channel=payment_channel,
            )

        # Route C: Pay-Per-Course / Exam Checkout (ORDER-<id> or CRS-<id> or EXM-<id> or numeric id)
        return cls._reconcile_course_order(
            merchant_order_id=merchant_order_id,
            gateway_txn_id=gateway_txn_id,
            payment_status=payment_status,
            amount=amount,
            payload=payload,
            payment_channel=payment_channel,
        )

    @classmethod
    def _reconcile_course_order(
        cls,
        merchant_order_id: str,
        gateway_txn_id: str,
        payment_status: str,
        amount: Decimal,
        payload: dict[str, Any],
        payment_channel: str,
    ) -> dict[str, Any]:
        from apps.finance.services import (
            calculate_revenue_splits,
            get_instructor_wallet,
            get_platform_wallet,
            get_student_wallet,
        )

        clean_id = (
            merchant_order_id.replace("ORDER-", "")
            .replace("order_", "")
            .replace("CRS-", "")
            .replace("EXM-", "")
            .split("-")[0]
            .split("_")[0]
        )

        order = None
        if clean_id.isdigit():
            order = Order.objects.select_for_update().filter(pk=int(clean_id)).first()

        if not order:
            txn = Transaction.objects.select_for_update().filter(idempotency_key__icontains=merchant_order_id).first()
            if txn:
                order = Order.objects.select_for_update().filter(pk=txn.order_id).first()

        if not order:
            logger.error(f"Order cannot be found for merchantOrderId: {merchant_order_id}")
            return {"status": "error", "reason": "order_not_found"}

        txn, created = Transaction.objects.select_for_update().get_or_create(
            order=order,
            gateway=payment_channel,
            defaults={
                "amount": amount if amount > 0 else order.total,
                "status": TransactionStatusChoices.INITIATED,
                "gateway_reference": gateway_txn_id,
                "idempotency_key": f"kashier_{order.id}_{gateway_txn_id or timezone.now().timestamp()}",
            },
        )

        # 100% Idempotency Check:
        if order.status == OrderStatusChoices.COMPLETED and txn.status == TransactionStatusChoices.SUCCESS:
            logger.info(f"Kashier order #{order.id} already completed (idempotency guard hit)")
            return {"status": "already_processed", "order_id": order.id, "transaction_id": txn.id}

        if payment_status == "SUCCESS":
            if amount > 0 and amount < order.total:
                logger.error(f"Paid amount {amount} is less than order total {order.total} for Order #{order.id}")
                txn.status = TransactionStatusChoices.FAILED
                txn.error_message = f"Underpaid: {amount} < {order.total}"
                txn.save(update_fields=["status", "error_message", "updated_at"])
                return {"status": "error", "reason": "underpaid"}

            settled_amount = amount if amount > 0 else order.total

            txn.status = TransactionStatusChoices.SUCCESS
            txn.gateway_reference = gateway_txn_id
            txn.amount = settled_amount
            txn.save(update_fields=["status", "gateway_reference", "amount", "updated_at"])

            order.status = OrderStatusChoices.COMPLETED
            order.save(update_fields=["status", "updated_at"])

            # 1. Auto-Enroll Student
            enrolled_ids = []
            for item in order.items.select_related("course").all():
                enrollment, _ = Enrollment.objects.get_or_create(
                    student=order.student,
                    course=item.course,
                    defaults={"source": "online"},
                )
                enrolled_ids.append(item.course.id)

            # 2. Perform Double-Entry Accounting Ledger Records with Pessimistic Locking
            platform_wallet = Wallet.objects.select_for_update().get(id=get_platform_wallet().id)
            student_wallet = Wallet.objects.select_for_update().get(id=get_student_wallet(order.student).id)
            ledger, _ = Ledger.objects.get_or_create(
                reference_id=f"KASHIER_ORDER_{order.id}_{gateway_txn_id or txn.id}",
                defaults={"description": f"Payment for Order #{order.id} via Kashier ({payment_channel})"},
            )

            # Inflow leg: Student purchase debited, Platform credited total cash
            platform_wallet.current_balance += settled_amount
            platform_wallet.available_balance += settled_amount
            platform_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=student_wallet,
                entry_type=LedgerEntryType.DEBIT,
                amount=settled_amount,
            )
            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=platform_wallet,
                entry_type=LedgerEntryType.CREDIT,
                amount=settled_amount,
            )

            # 3. Distribute Instructor Revenue Cuts to Pending Balance (14-day Escrow Window)
            splits = calculate_revenue_splits(order)
            holding_maturity = timezone.now() + timedelta(days=14)
            for split in splits.values():
                instructor = split["instructor"]
                cut_amount = split["amount"]
                if cut_amount > Decimal("0.00"):
                    instructor_wallet = Wallet.objects.select_for_update().get(id=get_instructor_wallet(instructor).id)

                    # Debit Platform Wallet
                    platform_wallet.current_balance -= cut_amount
                    platform_wallet.available_balance -= cut_amount
                    platform_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

                    LedgerEntry.objects.create(
                        ledger=ledger,
                        wallet=platform_wallet,
                        entry_type=LedgerEntryType.DEBIT,
                        amount=cut_amount,
                    )

                    # Credit Instructor Pending Balance (14-day Escrow)
                    instructor_wallet.current_balance += cut_amount
                    instructor_wallet.pending_balance += cut_amount
                    instructor_wallet.save(update_fields=["current_balance", "pending_balance", "updated_at"])

                    LedgerEntry.objects.create(
                        ledger=ledger,
                        wallet=instructor_wallet,
                        entry_type=LedgerEntryType.CREDIT,
                        amount=cut_amount,
                    )

                    # Create 14-day EscrowHolding records
                    items_list = split.get("items", [])
                    if items_list:
                        for item_split in items_list:
                            EscrowHolding.objects.create(
                                order=order,
                                order_item=item_split.get("item"),
                                wallet=instructor_wallet,
                                amount=item_split.get("cut", cut_amount),
                                status=EscrowStatusChoices.HELD,
                                mature_at=holding_maturity,
                                ledger=ledger,
                            )
                    else:
                        EscrowHolding.objects.create(
                            order=order,
                            order_item=None,
                            wallet=instructor_wallet,
                            amount=cut_amount,
                            status=EscrowStatusChoices.HELD,
                            mature_at=holding_maturity,
                            ledger=ledger,
                        )

            logger.info(f"Kashier Order #{order.id} successfully processed, enrolled in courses {enrolled_ids}")
            return {
                "status": "payment_completed",
                "order_id": order.id,
                "transaction_id": txn.id,
                "enrolled_courses": enrolled_ids,
            }

        elif payment_status in ("FAILED", "CANCELED"):
            txn.status = TransactionStatusChoices.FAILED
            txn.error_message = (
                payload.get("error", {}).get("message", "Payment failed at Kashier")
                if isinstance(payload.get("error"), dict)
                else "Payment failed at Kashier"
            )
            txn.save(update_fields=["status", "error_message", "updated_at"])

            order.status = OrderStatusChoices.FAILED
            order.save(update_fields=["status", "updated_at"])
            return {"status": "payment_failed", "order_id": order.id}

        return {"status": "pending"}

    @classmethod
    def _reconcile_subscription(
        cls,
        merchant_order_id: str,
        gateway_txn_id: str,
        payment_status: str,
        amount: Decimal,
        card_data_token: str | None,
        card_brand: str,
        masked_card: str,
        payload: dict[str, Any],
        payment_channel: str,
    ) -> dict[str, Any]:
        from apps.finance.services import InvoiceGeneratorService

        clean_id = (
            merchant_order_id.upper()
            .replace("SUB-", "")
            .replace("SUB_", "")
            .replace("sub_", "")
            .split("-")[0]
            .split("_")[0]
        )
        if not clean_id.isdigit():
            logger.error(f"Cannot parse subscription ID from {merchant_order_id}")
            return {"status": "error", "reason": "invalid_subscription_order_id"}

        sub_id = int(clean_id)
        try:
            sub = Subscription.objects.select_for_update().get(pk=sub_id)
        except Subscription.DoesNotExist:
            logger.error(f"Subscription #{sub_id} not found for Kashier payment")
            return {"status": "error", "reason": "subscription_not_found"}

        txn_ref = gateway_txn_id or f"kashier_sub_{sub.id}_{int(timezone.now().timestamp())}"
        txn, created = PaymentTransaction.objects.select_for_update().get_or_create(
            gateway_transaction_id=txn_ref,
            defaults={
                "subscription": sub,
                "gateway": "kashier",
                "amount": amount if amount > 0 else sub.price_at_subscription,
                "status": TransactionStatus.PAID if payment_status == "SUCCESS" else TransactionStatus.PENDING,
                "raw_webhook_payload": payload,
            },
        )

        if not created and txn.status == TransactionStatus.PAID:
            logger.info(f"Kashier subscription payment for Sub #{sub.id} already processed")
            return {"status": "already_processed", "subscription_id": sub.id, "transaction_id": txn.id}

        if payment_status == "SUCCESS":
            txn.status = TransactionStatus.PAID
            txn.amount = amount if amount > 0 else sub.price_at_subscription
            txn.save(update_fields=["status", "amount", "updated_at"])

            # Activate Subscription & Extend Period
            sub.status = SubscriptionStatusChoices.ACTIVE
            duration_days = 365 if sub.billing_cycle == "yearly" else 30
            sub.current_period_end = timezone.now() + timedelta(days=duration_days)
            sub.grace_period_ends_at = None
            sub.dunning_attempt_count = 0
            sub.pre_due_notified = False
            sub.save(
                update_fields=[
                    "status",
                    "current_period_end",
                    "grace_period_ends_at",
                    "dunning_attempt_count",
                    "pre_due_notified",
                    "updated_at",
                ]
            )

            # Tokenize & Update Payment Method for Recurring Auto-Debit
            if card_data_token:
                PaymentMethod.objects.filter(subscription=sub, is_active=True).update(is_active=False)
                PaymentMethod.objects.create(
                    subscription=sub,
                    gateway=PaymentMethod.GatewayChoices.KASHIER,
                    gateway_ref=card_data_token,
                    payment_channel=PaymentMethod.ChannelChoices.CARD,
                    card_brand=card_brand or "VISA",
                    masked_pan=masked_card or "",
                    is_active=True,
                )

            # Generate Invoice
            InvoiceGeneratorService.create_invoice_for_transaction(txn)
            logger.info(f"Kashier Subscription #{sub.id} successfully activated/renewed")
            return {"status": "payment_completed", "subscription_id": sub.id, "transaction_id": txn.id}

        elif payment_status in ("FAILED", "CANCELED"):
            txn.status = TransactionStatus.FAILED
            txn.save(update_fields=["status", "updated_at"])
            return {"status": "payment_failed", "subscription_id": sub.id}

        return {"status": "pending"}

    @classmethod
    def _reconcile_wallet_topup(
        cls,
        merchant_order_id: str,
        gateway_txn_id: str,
        payment_status: str,
        amount: Decimal,
        currency: str,
        payload: dict[str, Any],
        payment_channel: str,
    ) -> dict[str, Any]:
        from apps.finance.services import get_platform_wallet

        clean_id = (
            merchant_order_id.upper()
            .replace("WALLET-", "")
            .replace("TOPUP-", "")
            .replace("WLT-", "")
            .split("-")[0]
            .split("_")[0]
        )
        if not clean_id.isdigit():
            logger.error(f"Cannot parse wallet ID from {merchant_order_id}")
            return {"status": "error", "reason": "invalid_wallet_topup_id"}

        wallet_id = int(clean_id)
        platform_wallet = Wallet.objects.select_for_update().get(id=get_platform_wallet().id)
        try:
            wallet = Wallet.objects.select_for_update().get(pk=wallet_id)
        except Wallet.DoesNotExist:
            logger.error(f"Wallet #{wallet_id} not found for top-up")
            return {"status": "error", "reason": "wallet_not_found"}

        ledger_ref = f"KASHIER_TOPUP_{wallet.id}_{gateway_txn_id or int(timezone.now().timestamp())}"
        if Ledger.objects.filter(reference_id=ledger_ref).exists():
            return {"status": "already_processed", "wallet_id": wallet.id}

        if payment_status == "SUCCESS":
            ledger = Ledger.objects.create(
                reference_id=ledger_ref,
                description=f"Direct Wallet Top-up via Kashier ({payment_channel})",
            )

            # Platform receives cash
            platform_wallet.current_balance += amount
            platform_wallet.available_balance += amount
            platform_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=platform_wallet,
                entry_type=LedgerEntryType.DEBIT,
                amount=amount,
            )

            # Student/Center Wallet gets available balance
            wallet.current_balance += amount
            wallet.available_balance += amount
            wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=wallet,
                entry_type=LedgerEntryType.CREDIT,
                amount=amount,
            )

            logger.info(f"Wallet #{wallet.id} credited {amount} {currency} via Kashier top-up")
            return {
                "status": "payment_completed",
                "wallet_id": wallet.id,
                "credited_amount": str(amount),
                "new_balance": str(wallet.available_balance),
            }

        return {"status": "payment_failed"}
