import hashlib
import hmac
import uuid
from decimal import Decimal, ROUND_HALF_UP
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.accounts.models import UserRole, CenterProfile
from apps.courses.models import Course, Category
from apps.finance.models import (
    Wallet,
    WalletTypeChoices,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    InstructorContract,
    RevenueModelChoices,
    PricingPlan,
    Coupon,
)
from apps.activation_codes.models import CodeQuotaContract

User = get_user_model()


class KashierTestHelper:
    """Authoritative helper for Kashier Payment Gateway cryptographic and payload generation."""

    DEFAULT_MID = "MID-EDUSMART-001"
    DEFAULT_IFRAME_KEY = "kashier_iframe_secret_key_12345"
    DEFAULT_API_KEY = "kashier_api_secret_key_67890"

    @classmethod
    def generate_order_hash(
        cls,
        merchant_id: str = DEFAULT_MID,
        order_id: str = "1",
        amount: str = "100.00",
        currency: str = "EGP",
        iframe_key: str = DEFAULT_IFRAME_KEY,
    ) -> str:
        """
        Computes Kashier HMAC-SHA256 hash for client checkout.
        Canonical format: /?payment={merchant_id}.{order_id}.{amount}.{currency}
        """
        canonical_string = f"/?payment={merchant_id}.{order_id}.{amount}.{currency}"
        return hmac.new(
            iframe_key.encode("utf-8"),
            canonical_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    @classmethod
    def generate_webhook_signature(cls, payload: dict, secret_key: str = DEFAULT_API_KEY) -> str:
        """
        Computes Kashier inbound callback HMAC-SHA256 signature across canonical ordered keys.
        """
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
        parts = []
        for k in ordered_keys:
            if k in payload and payload[k] is not None:
                parts.append(f"&{k}={payload[k]}")

        raw_str = "".join(parts)
        if raw_str.startswith("&"):
            raw_str = raw_str[1:]

        return hmac.new(
            secret_key.encode("utf-8"),
            raw_str.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    @classmethod
    def create_webhook_payload(
        cls,
        merchant_order_id: str,
        amount: str = "500.00",
        payment_status: str = "SUCCESS",
        transaction_id: str = None,
        card_brand: str = "VISA",
        card_token: str = "tok_kashier_test_token_123",
        currency: str = "EGP",
        secret_key: str = DEFAULT_API_KEY,
        tamper: bool = False,
    ) -> dict:
        """Creates a signed Kashier server-to-server webhook dictionary."""
        if not transaction_id:
            transaction_id = f"txn_kashier_{uuid.uuid4().hex[:12]}"

        payload = {
            "paymentStatus": payment_status,
            "cardDataToken": card_token,
            "maskedCard": "411111******1111",
            "merchantOrderId": merchant_order_id,
            "orderId": f"kashier_ord_{uuid.uuid4().hex[:8]}",
            "cardBrand": card_brand,
            "orderReference": f"REF-{uuid.uuid4().hex[:8].upper()}",
            "transactionId": transaction_id,
            "amount": amount,
            "currency": currency,
        }

        signature = cls.generate_webhook_signature(payload, secret_key=secret_key)
        if tamper:
            # Tamper the signature or payload
            payload["signature"] = signature[::-1]  # reversed/invalid signature
        else:
            payload["signature"] = signature

        return payload


class LedgerTestHelper:
    """Helper assertions for double-entry financial ledger invariants and wallet balances."""

    @staticmethod
    def assert_ledger_balanced(ledger: Ledger):
        """Ensures sum of debit entries equals sum of credit entries for a ledger transaction."""
        debits = sum(
            entry.amount
            for entry in ledger.entries.filter(entry_type=LedgerEntryType.DEBIT)
        )
        credits = sum(
            entry.amount
            for entry in ledger.entries.filter(entry_type=LedgerEntryType.CREDIT)
        )
        # Convert to Decimal with 2 decimal places
        d_val = Decimal(str(debits)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        c_val = Decimal(str(credits)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert d_val == c_val, f"Ledger #{ledger.id} is UNBALANCED: Debits ({d_val}) != Credits ({c_val})"

    @staticmethod
    def assert_all_ledgers_balanced():
        """Asserts that all Ledger instances in database maintain the double-entry invariant."""
        for ledger in Ledger.objects.all():
            debits = sum(e.amount for e in ledger.entries.filter(entry_type=LedgerEntryType.DEBIT))
            credits = sum(e.amount for e in ledger.entries.filter(entry_type=LedgerEntryType.CREDIT))
            assert debits == credits, f"Ledger #{ledger.id} reference {ledger.reference_id} unbalanced: {debits} vs {credits}"

    @staticmethod
    def assert_wallet_balances(
        wallet: Wallet,
        current: Decimal = None,
        pending: Decimal = None,
        available: Decimal = None,
        withdrawn: Decimal = None,
    ):
        """Asserts wallet balance precision and exact amounts."""
        wallet.refresh_from_db()
        if current is not None:
            assert Decimal(str(wallet.current_balance)) == Decimal(str(current)), (
                f"Wallet {wallet.id} current_balance expected {current}, got {wallet.current_balance}"
            )
        if pending is not None:
            assert Decimal(str(wallet.pending_balance)) == Decimal(str(pending)), (
                f"Wallet {wallet.id} pending_balance expected {pending}, got {wallet.pending_balance}"
            )
        if available is not None:
            assert Decimal(str(wallet.available_balance)) == Decimal(str(available)), (
                f"Wallet {wallet.id} available_balance expected {available}, got {wallet.available_balance}"
            )
        if withdrawn is not None:
            assert Decimal(str(wallet.withdrawn_balance)) == Decimal(str(withdrawn)), (
                f"Wallet {wallet.id} withdrawn_balance expected {withdrawn}, got {wallet.withdrawn_balance}"
            )
        # Invariant: available balance must never be negative
        assert wallet.available_balance >= Decimal("0.00"), f"Wallet {wallet.id} negative available balance!"


class FinancialDataFactory:
    """Factory helper to provision test entities with clean defaults."""

    @staticmethod
    def create_student(email: str = None) -> User:
        if not email:
            email = f"student_{uuid.uuid4().hex[:6]}@edusmart.com"
        return User.objects.create_user(
            email=email,
            password="Password123!",
            first_name="Tarek",
            last_name="El-Sayed",
            role=UserRole.STUDENT,
        )

    @staticmethod
    def create_instructor(email: str = None, revenue_percentage: Decimal = Decimal("80.00")) -> User:
        if not email:
            email = f"instructor_{uuid.uuid4().hex[:6]}@edusmart.com"
        instructor = User.objects.create_user(
            email=email,
            password="Password123!",
            first_name="Hassan",
            last_name="Kamal",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.PERCENTAGE,
            revenue_percentage=revenue_percentage,
            is_active=True,
        )
        CodeQuotaContract.objects.create(
            owner=instructor,
            monthly_code_limit=500,
            billing_unit_size=100,
            price_per_billing_unit=Decimal("0.00"),
            is_active=True,
        )
        return instructor

    @staticmethod
    def create_center_admin(email: str = None, name: str = "Al-Rowad Educational Academy") -> User:
        if not email:
            email = f"center_{uuid.uuid4().hex[:6]}@edusmart.com"
        center_user = User.objects.create_user(
            email=email,
            password="Password123!",
            first_name="Center",
            last_name="Director",
            role=UserRole.CENTER,
        )
        CenterProfile.objects.update_or_create(
            user=center_user,
            defaults={
                "institution_name": name,
                "institution_type": "academy",
                "is_verified": True,
            },
        )
        CodeQuotaContract.objects.create(
            owner=center_user,
            monthly_code_limit=1000,
            billing_unit_size=100,
            price_per_billing_unit=Decimal("0.00"),
            is_active=True,
        )
        return center_user

    @staticmethod
    def create_super_admin(email: str = None) -> User:
        if not email:
            email = f"superadmin_{uuid.uuid4().hex[:6]}@edusmart.com"
        return User.objects.create_superuser(
            email=email,
            password="Password123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
        )

    @staticmethod
    def create_course(instructor: User, price: Decimal = Decimal("500.00"), title: str = "Physics 101") -> Course:
        category, _ = Category.objects.get_or_create(name="Science", slug="science")
        return Course.objects.create(
            instructor=instructor,
            category=category,
            title=title,
            price=price,
            status="published",
        )

    @staticmethod
    def create_pricing_plan(
        name: str = "Teacher Pro Plan",
        slug: str = "teacher-pro",
        price_monthly: Decimal = Decimal("1200.00"),
        price_yearly: Decimal = Decimal("12000.00"),
        trial_days: int = 0,
    ) -> PricingPlan:
        plan, _ = PricingPlan.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": f"Subscription plan for {name}",
                "price_monthly": price_monthly,
                "price_yearly": price_yearly,
                "currency": "EGP",
                "is_featured": True,
                "is_active": True,
                "trial_days": trial_days,
            },
        )
        return plan
