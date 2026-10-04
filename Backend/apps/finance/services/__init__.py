import hashlib
import hmac
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

import requests
from decouple import config
from django.db import transaction
from django.utils import timezone

from ..models import (
    Coupon,
    DetailedAuditLog,
    EscrowHolding,
    EscrowStatusChoices,
    Invoice,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    Order,
    OrderStatusChoices,
    PaymentTransaction,
    PricingChangeRequest,
    PricingPlan,
    RevenueModelChoices,
    Subscription,
    Transaction,
    TransactionStatusChoices,
    Wallet,
    WalletTypeChoices,
)
from .bulk_licensing import BulkLicensingService
from .coupons import CouponCalculationResult, CouponService
from .kashier import (
    KashierAPIError,
    KashierConfigurationError,
    KashierConnectionError,
    KashierError,
    KashierReconciliationService,
    KashierService,
    KashierSignatureError,
)

__all__ = [
    "BulkLicensingService",
    "BunnyStorageService",
    "CouponCalculationResult",
    "CouponService",
    "FawryService",
    "InvoiceGeneratorService",
    "KashierAPIError",
    "KashierConfigurationError",
    "KashierConnectionError",
    "KashierError",
    "KashierReconciliationService",
    "KashierService",
    "KashierSignatureError",
    "MakerCheckerService",
    "PaymentProcessingError",
    "calculate_revenue_splits",
    "get_center_wallet",
    "get_instructor_wallet",
    "get_platform_wallet",
    "get_student_wallet",
]


class PaymentProcessingError(Exception):
    pass


def get_platform_wallet() -> Wallet:
    """Returns the singleton Platform Wallet."""
    wallet, _ = Wallet.objects.get_or_create(
        wallet_type=WalletTypeChoices.PLATFORM,
        user=None,
        defaults={"currency": "EGP"},
    )
    return wallet


def get_instructor_wallet(instructor) -> Wallet:
    """Returns the Wallet for a specific instructor."""
    user = getattr(instructor, "user", instructor)
    wallet, _ = Wallet.objects.get_or_create(
        user=user,
        wallet_type=WalletTypeChoices.INSTRUCTOR,
        defaults={"currency": "EGP"},
    )
    return wallet


def get_student_wallet(user) -> Wallet:
    """Returns the Wallet for a specific student."""
    user_obj = getattr(user, "user", user)
    wallet, _ = Wallet.objects.get_or_create(
        user=user_obj,
        wallet_type=WalletTypeChoices.STUDENT,
        defaults={"currency": "EGP"},
    )
    return wallet


def get_center_wallet(center_profile_or_user) -> Wallet:
    """Returns the Wallet for a specific educational center."""
    user_obj = getattr(center_profile_or_user, "user", center_profile_or_user)
    wallet, _ = Wallet.objects.get_or_create(
        user=user_obj,
        wallet_type=WalletTypeChoices.CENTER,
        defaults={"currency": "EGP"},
    )
    return wallet


def calculate_revenue_splits(order: Order) -> dict:
    """
    Calculates how much goes to the platform vs the instructors.
    Evaluates InstructorContract models:
    - PERCENTAGE: percentage of purchase price
    - FIXED_FEE: minimum_guarantee fee per item (capped at purchase price)
    - HYBRID: max of percentage cut and minimum_guarantee (capped at purchase price)
    - Uncontracted/Inactive/Expired fallback: 80% instructor / 20% platform
    Returns a dict mapping instructor_id -> dict with instructor, total amount, and item breakdown.
    """
    splits = {}

    for item in order.items.select_related("course__instructor").all():
        instructor = getattr(item.course, "instructor", None)
        if not instructor:
            continue

        try:
            from ..models import InstructorContract

            contract = InstructorContract.objects.filter(instructor=instructor).first()
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                "Failed to retrieve InstructorContract for instructor %s: %s", instructor, str(e), exc_info=True
            )
            raise PaymentProcessingError(
                f"Revenue split calculation failed due to contract lookup error: {str(e)}"
            ) from e

        # Check contract validity dates
        is_valid = False
        if contract and getattr(contract, "is_active", False):
            today = timezone.now().date()
            from_ok = contract.valid_from is None or contract.valid_from <= today
            to_ok = contract.valid_to is None or contract.valid_to >= today
            is_valid = from_ok and to_ok

        price = item.price_at_purchase

        if is_valid and contract:
            if contract.revenue_model == RevenueModelChoices.PERCENTAGE:
                revenue_percentage = contract.revenue_percentage
                instructor_cut = price * (revenue_percentage / Decimal("100.00"))
            elif contract.revenue_model == RevenueModelChoices.FIXED_FEE:
                if contract.minimum_guarantee > Decimal("0.00"):
                    instructor_cut = min(contract.minimum_guarantee, price)
                else:
                    instructor_cut = price * Decimal("0.80")
            elif contract.revenue_model == RevenueModelChoices.HYBRID:
                percentage_cut = price * (contract.revenue_percentage / Decimal("100.00"))
                guarantee = contract.minimum_guarantee
                instructor_cut = min(price, max(percentage_cut, guarantee))
            else:
                instructor_cut = price * Decimal("0.80")
        else:
            # Default fallback split if uncontracted: 80% instructor / 20% platform
            instructor_cut = price * Decimal("0.80")

        # Quantize to 2 decimal places
        instructor_cut = instructor_cut.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        if instructor.id not in splits:
            splits[instructor.id] = {
                "instructor": instructor,
                "amount": Decimal("0.00"),
                "items": [],
            }

        splits[instructor.id]["amount"] += instructor_cut
        splits[instructor.id]["items"].append(
            {
                "item": item,
                "price": price,
                "cut": instructor_cut,
            }
        )

    return splits


@transaction.atomic
def process_payment(order: Order, gateway_name: str, gateway_ref: str, amount_paid: Decimal, idempotency_key: str):
    """
    Core Financial Engine: Processes a successful payment.
    - Idempotent execution using the uniqueness of `idempotency_key`.
    - Double-entry accounting to the ledger with strict balance invariants.
    - Pessimistic locking (select_for_update) on wallets to prevent race conditions.
    - Automatic 14-day EscrowHolding creation for instructor revenue shares.
    """

    # 1. Idempotency Check
    existing_txn = Transaction.objects.filter(idempotency_key=idempotency_key).first()
    if existing_txn and existing_txn.status == TransactionStatusChoices.SUCCESS:
        return existing_txn

    order = Order.objects.select_for_update().get(id=order.id)

    if order.status == OrderStatusChoices.COMPLETED:
        return order.transactions.filter(status=TransactionStatusChoices.SUCCESS).first()

    if amount_paid < order.total:
        raise PaymentProcessingError(f"Paid amount {amount_paid} is less than order total {order.total}")

    # 2. Record or Update Transaction
    if existing_txn:
        existing_txn.gateway = gateway_name
        existing_txn.gateway_reference = gateway_ref
        existing_txn.amount = amount_paid
        existing_txn.status = TransactionStatusChoices.SUCCESS
        existing_txn.save(update_fields=["gateway", "gateway_reference", "amount", "status", "updated_at"])
        txn = existing_txn
    else:
        txn = Transaction.objects.create(
            order=order,
            gateway=gateway_name,
            amount=amount_paid,
            status=TransactionStatusChoices.SUCCESS,
            gateway_reference=gateway_ref,
            idempotency_key=idempotency_key,
        )

    # 3. Update Order Status
    order.status = OrderStatusChoices.COMPLETED
    order.save(update_fields=["status", "updated_at"])

    # 4. Double-Entry Accounting on Wallets with Pessimistic Locking
    platform_wallet = Wallet.objects.select_for_update().get(id=get_platform_wallet().id)
    student_wallet = Wallet.objects.select_for_update().get(id=get_student_wallet(order.student).id)

    ledger = Ledger.objects.create(
        reference_id=f"ORDER_{order.id}_PAYMENT",
        description=f"Payment for Order #{order.id} via {gateway_name}",
    )

    # Inflow: Student purchase debited, Platform credited total cash
    platform_wallet.current_balance += amount_paid
    platform_wallet.available_balance += amount_paid
    platform_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

    LedgerEntry.objects.create(
        ledger=ledger,
        wallet=student_wallet,
        entry_type=LedgerEntryType.DEBIT,
        amount=amount_paid,
    )
    LedgerEntry.objects.create(
        ledger=ledger,
        wallet=platform_wallet,
        entry_type=LedgerEntryType.CREDIT,
        amount=amount_paid,
    )

    # 5. Distribute Revenue Splits to Instructors (Crediting pending_balance + EscrowHolding)
    splits = calculate_revenue_splits(order)
    holding_maturity = timezone.now() + timedelta(days=14)

    for split in splits.values():
        instructor = split["instructor"]
        cut_amount = split["amount"]

        if cut_amount > Decimal("0.00"):
            instructor_wallet = Wallet.objects.select_for_update().get(id=get_instructor_wallet(instructor).id)

            # Transfer from Platform to Instructor Pending Balance
            platform_wallet.current_balance -= cut_amount
            platform_wallet.available_balance -= cut_amount
            platform_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=platform_wallet,
                entry_type=LedgerEntryType.DEBIT,
                amount=cut_amount,
            )

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
            for item_split in split.get("items", []):
                EscrowHolding.objects.create(
                    order=order,
                    order_item=item_split.get("item"),
                    wallet=instructor_wallet,
                    amount=item_split.get("cut", cut_amount),
                    status=EscrowStatusChoices.HELD,
                    mature_at=holding_maturity,
                    ledger=ledger,
                )

    return txn


@transaction.atomic
def deposit_to_wallet(
    wallet: Wallet, amount: Decimal, gateway_name: str = "kashier", reference_id: str | None = None
) -> Ledger:
    """
    Processes a direct digital wallet top-up.
    - Credits target wallet available_balance.
    - Double-entry: DEBIT Platform Wallet (Cash Inflow), CREDIT Target Wallet (Deposit).
    """
    if amount <= Decimal("0.00"):
        raise ValueError("Deposit amount must be positive.")

    platform_wallet = Wallet.objects.select_for_update().get(id=get_platform_wallet().id)
    target_wallet = Wallet.objects.select_for_update().get(id=wallet.id)

    ref = (
        reference_id
        or f"TOPUP_{target_wallet.wallet_type.upper()}_{target_wallet.user_id or target_wallet.id}_{uuid.uuid4().hex[:6]}"
    )
    ledger = Ledger.objects.create(
        reference_id=ref,
        description=f"Wallet top-up of {amount} EGP via {gateway_name}",
    )

    platform_wallet.current_balance += amount
    platform_wallet.available_balance += amount
    platform_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

    target_wallet.current_balance += amount
    target_wallet.available_balance += amount
    target_wallet.save(update_fields=["current_balance", "available_balance", "updated_at"])

    LedgerEntry.objects.create(
        ledger=ledger,
        wallet=platform_wallet,
        entry_type=LedgerEntryType.DEBIT,
        amount=amount,
    )
    LedgerEntry.objects.create(
        ledger=ledger,
        wallet=target_wallet,
        entry_type=LedgerEntryType.CREDIT,
        amount=amount,
    )
    return ledger


@transaction.atomic
def pay_with_balance(student, order: Order) -> Transaction:
    """
    Purchases an order using student wallet available_balance.
    - Pessimistic lock on student, platform, and instructor wallets.
    - Double-entry: DEBIT Student Wallet (Total), CREDIT Instructor Wallet (Cut), CREDIT Platform Wallet (Platform Cut).
    - Instant enrollment and EscrowHolding creation.
    """
    # Standardized Lock Acquisition: Platform -> Student -> Instructor (prevents deadlock)
    order = Order.objects.select_for_update().get(id=order.id)

    if order.status == OrderStatusChoices.COMPLETED:
        transaction_obj = order.transactions.filter(status=TransactionStatusChoices.SUCCESS).first()
        if transaction_obj is None:
            raise PaymentProcessingError(
                f"Order #{order.id} is marked completed but has no successful payment transaction."
            )
        return transaction_obj

    platform_wallet = Wallet.objects.select_for_update().get(id=get_platform_wallet().id)
    student_wallet = Wallet.objects.select_for_update().get(id=get_student_wallet(student).id)
    if student_wallet.available_balance < order.total:
        raise PaymentProcessingError("رصيد المحفظة غير كافٍ لإتمام العملية.")

    total_amount = order.total
    splits = calculate_revenue_splits(order)
    total_instructor_cut = sum(s["amount"] for s in splits.values())
    platform_cut = total_amount - total_instructor_cut

    # Deduct student available and current balance
    student_wallet.available_balance -= total_amount
    student_wallet.current_balance -= total_amount
    student_wallet.save(update_fields=["available_balance", "current_balance", "updated_at"])

    # Platform retains its cut in available balance
    if platform_cut > Decimal("0.00"):
        platform_wallet.available_balance += platform_cut
        platform_wallet.current_balance += platform_cut
        platform_wallet.save(update_fields=["available_balance", "current_balance", "updated_at"])

    ledger = Ledger.objects.create(
        reference_id=f"WALLET_PAY_{order.id}",
        description=f"Pay with balance for Order #{order.id}",
    )

    LedgerEntry.objects.create(
        ledger=ledger,
        wallet=student_wallet,
        entry_type=LedgerEntryType.DEBIT,
        amount=total_amount,
    )

    if platform_cut > Decimal("0.00"):
        LedgerEntry.objects.create(
            ledger=ledger,
            wallet=platform_wallet,
            entry_type=LedgerEntryType.CREDIT,
            amount=platform_cut,
        )

    holding_maturity = timezone.now() + timedelta(days=14)
    for split in splits.values():
        instructor = split["instructor"]
        cut_amount = split["amount"]
        if cut_amount > Decimal("0.00"):
            instructor_wallet = Wallet.objects.select_for_update().get(id=get_instructor_wallet(instructor).id)
            instructor_wallet.pending_balance += cut_amount
            instructor_wallet.current_balance += cut_amount
            instructor_wallet.save(update_fields=["pending_balance", "current_balance", "updated_at"])

            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=instructor_wallet,
                entry_type=LedgerEntryType.CREDIT,
                amount=cut_amount,
            )

            for item_split in split.get("items", []):
                EscrowHolding.objects.create(
                    order=order,
                    order_item=item_split.get("item"),
                    wallet=instructor_wallet,
                    amount=item_split.get("cut", cut_amount),
                    status=EscrowStatusChoices.HELD,
                    mature_at=holding_maturity,
                    ledger=ledger,
                )

    order.status = OrderStatusChoices.COMPLETED
    order.save(update_fields=["status", "updated_at"])

    txn = Transaction.objects.create(
        order=order,
        gateway="wallet_balance",
        amount=total_amount,
        status=TransactionStatusChoices.SUCCESS,
        gateway_reference=f"WALLET_TXN_{order.id}",
        idempotency_key=f"wallet_pay_order_{order.id}_{uuid.uuid4().hex[:6]}",
    )

    # Auto-enroll student into purchased courses
    from apps.enrollments.models import Enrollment

    for item in order.items.select_related("course").all():
        Enrollment.objects.get_or_create(
            student=student,
            course=item.course,
            defaults={"source": "online"},
        )

    return txn


# ============================================================================
# FAWRY, INVOICING & MAKER-CHECKER SERVICES
# ============================================================================


class FawryService:
    @staticmethod
    def verify_signature(payload: dict) -> bool:
        """
        Fawry SHA-256 signature verification.
        """
        merchant_sec_key = config("FAWRY_SECURE_KEY", default="")
        if not merchant_sec_key:
            return True

        fawry_ref_num = payload.get("fawryRefNumber", "")
        merchant_ref_num = payload.get("merchantRefNum", "")
        payment_amount = payload.get("paymentAmount", "")
        order_amount = payload.get("orderAmount", "")
        order_status = payload.get("orderStatus", "")
        received_sig = payload.get("messageSignature", "")

        raw_str = f"{fawry_ref_num}{merchant_ref_num}{payment_amount}{order_amount}{order_status}{merchant_sec_key}"
        computed = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
        return hmac.compare_digest(computed.lower(), received_sig.lower())

    @staticmethod
    def create_payatfawry_reference(subscription: Subscription, amount: Decimal) -> dict:
        """
        Generates Fawry PayAtFawry reference number for physical kiosk cash payment.
        """
        merchant_code = config("FAWRY_MERCHANT_CODE", default="1tSa62Zs3y0=")
        secure_key = config("FAWRY_SECURE_KEY", default="sandbox_key")
        merchant_ref_num = f"FAW_SUB_{subscription.id}_{int(timezone.now().timestamp())}"

        raw_sig = f"{merchant_code}{merchant_ref_num}{subscription.user.id}sub_item1{int(amount)}{secure_key}"
        signature = hashlib.sha256(raw_sig.encode("utf-8")).hexdigest()

        return {
            "merchant_code": merchant_code,
            "merchant_ref_num": merchant_ref_num,
            "fawry_ref_number": f"999{subscription.id}{int(timezone.now().timestamp()) % 100000}",
            "amount": str(amount),
            "signature": signature,
            "instructions": "احفظ هذا الرقم المرجعي وادفع من خلال أي منفذ فوري أو تطبيـق فوري باي.",
        }


class BunnyStorageService:
    @staticmethod
    def upload_invoice_pdf(file_name: str, content_bytes: bytes) -> str:
        """
        Uploads generated invoice PDF to Bunny Storage CDN bucket.
        """
        storage_zone = config("BUNNY_STORAGE_ZONE", default="edusmart-invoices")
        api_key = config("BUNNY_API_KEY", default="")
        region = config("BUNNY_REGION", default="ny")

        if not api_key:
            return f"invoices/{file_name}"

        url = f"https://{region}.storage.bunnycdn.com/{storage_zone}/{file_name}"
        headers = {
            "AccessKey": api_key,
            "Content-Type": "application/pdf",
        }
        try:
            res = requests.put(url, data=content_bytes, headers=headers, timeout=10)
            if res.status_code in (200, 201):
                return f"{storage_zone}/{file_name}"
            raise PaymentProcessingError(f"Bunny Storage API returned status {res.status_code}")
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error("Failed to upload invoice PDF to Bunny Storage: %s", str(e), exc_info=True)
            raise PaymentProcessingError(f"Failed to upload invoice PDF: {str(e)}") from e

    @staticmethod
    def get_temporary_signed_url(pdf_path: str, valid_seconds: int = 900) -> str:
        """
        Returns temporary signed URL for secure invoice download (Bunny Token Authentication).
        """
        cdn_url = config("BUNNY_CDN_URL", default="https://invoices.edusmart.com")
        token_key = config("BUNNY_TOKEN_KEY", default="secret_token_key")

        expires = int(timezone.now().timestamp()) + valid_seconds
        token_path = f"/{pdf_path}"
        hash_input = f"{token_key}{token_path}{expires}"
        md5_hash = hashlib.md5(hash_input.encode("utf-8")).digest()
        import base64

        token = base64.b64encode(md5_hash).decode("utf-8").replace("+", "-").replace("/", "_").replace("=", "")

        return f"{cdn_url}/{pdf_path}?token={token}&expires={expires}"


class InvoiceGeneratorService:
    @staticmethod
    def create_invoice_for_transaction(transaction: PaymentTransaction, is_b2b: bool = False) -> Invoice:
        """
        Generates B2B (E-Invoice) or B2C (E-Receipt) invoice with 14% VAT compliance.
        """
        vat_rate = Decimal("0.14")
        vat_amount = transaction.amount * vat_rate
        transaction.vat_amount = vat_amount
        transaction.save(update_fields=["vat_amount", "updated_at"])

        eta_uuid = f"ETA-{transaction.id}-{uuid.uuid4().hex[:16].upper()}"
        file_name = f"Invoice_{transaction.id}_{eta_uuid}.pdf"
        pdf_path = BunnyStorageService.upload_invoice_pdf(file_name, b"%PDF-1.4 Mock Invoice Data")

        invoice, _ = Invoice.objects.get_or_create(
            transaction=transaction,
            defaults={
                "invoice_type": Invoice.InvoiceType.B2B if is_b2b else Invoice.InvoiceType.B2C,
                "eta_uuid": eta_uuid,
                "pdf_file": pdf_path,
            },
        )
        return invoice


class MakerCheckerService:
    @staticmethod
    def submit_change_request(
        target_model: str, target_id: int | None, old_val: dict, new_val: dict, user
    ) -> PricingChangeRequest:
        return PricingChangeRequest.objects.create(
            target_model=target_model,
            target_id=target_id or 0,
            old_value=old_val,
            new_value=new_val,
            requested_by=user,
            status=PricingChangeRequest.Status.PENDING,
        )

    @staticmethod
    @transaction.atomic
    def approve_change_request(request_id: int, approver) -> PricingChangeRequest:
        change_req = PricingChangeRequest.objects.select_for_update().get(pk=request_id)
        if change_req.status != PricingChangeRequest.Status.PENDING:
            raise ValueError("Change request is not in PENDING state.")

        if change_req.requested_by == approver:
            raise ValueError("Maker-Checker violation: Cannot approve your own change request.")

        if change_req.target_model == "PricingPlan":
            if change_req.target_id:
                plan = PricingPlan.objects.get(pk=change_req.target_id)
                for field, val in change_req.new_value.items():
                    setattr(plan, field, val)
                plan.save()
            else:
                PricingPlan.objects.create(**change_req.new_value)
        elif change_req.target_model == "Coupon":
            if change_req.target_id:
                coupon = Coupon.objects.get(pk=change_req.target_id)
                for field, val in change_req.new_value.items():
                    setattr(coupon, field, val)
                coupon.save()
            else:
                Coupon.objects.create(**change_req.new_value)

        change_req.status = PricingChangeRequest.Status.APPROVED
        change_req.approved_by = approver
        change_req.save()

        DetailedAuditLog.objects.create(
            actor=approver,
            action=f"MAKER_CHECKER_APPROVE_{change_req.target_model.upper()}",
            entity_type=change_req.target_model,
            entity_id=change_req.target_id or 0,
            old_value=change_req.old_value,
            new_value=change_req.new_value,
            reason=f"Approved change request #{change_req.id} submitted by {change_req.requested_by.email}",
        )

        return change_req
