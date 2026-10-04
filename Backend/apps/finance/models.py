from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import CheckConstraint, Q
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimestampedModel
from apps.courses.models import Course


class RevenueModelChoices(models.TextChoices):
    PERCENTAGE = "percentage", _("Percentage Base")
    FIXED_FEE = "fixed_fee", _("Fixed Fee per Sale")
    HYBRID = "hybrid", _("Hybrid (Percentage + Guarantee)")


class InstructorContract(TimestampedModel):
    instructor = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="financial_contract",
        limit_choices_to={"role": "instructor"},
    )
    revenue_model = models.CharField(
        max_length=20, choices=RevenueModelChoices.choices, default=RevenueModelChoices.PERCENTAGE
    )
    revenue_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("70.00"), help_text="e.g. 70.00 for 70%"
    )
    minimum_guarantee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    auto_renewal = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    special_agreement = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Contract: {self.instructor.email} - {self.revenue_percentage}%"


class WalletTypeChoices(models.TextChoices):
    INSTRUCTOR = "instructor", _("Instructor Wallet")
    PLATFORM = "platform", _("Platform Holding Wallet")
    STUDENT = "student", _("Student Wallet")
    CENTER = "center", _("Center Wallet")


class Wallet(TimestampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="wallet",
    )
    wallet_type = models.CharField(max_length=20, choices=WalletTypeChoices.choices)
    currency = models.CharField(max_length=3, default="EGP")

    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pending_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    available_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    withdrawn_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        constraints = [
            CheckConstraint(
                condition=Q(available_balance__gte=Decimal("0.00")),
                name="wallet_available_balance_non_negative",
            ),
            CheckConstraint(
                condition=Q(current_balance__gte=Decimal("0.00")),
                name="wallet_current_balance_non_negative",
            ),
            CheckConstraint(
                condition=Q(pending_balance__gte=Decimal("0.00")),
                name="wallet_pending_balance_non_negative",
            ),
            CheckConstraint(
                condition=Q(withdrawn_balance__gte=Decimal("0.00")),
                name="wallet_withdrawn_balance_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "wallet_type"]),
        ]

    def __str__(self):
        return f"Wallet {self.id} - {self.wallet_type}"


class OrderStatusChoices(models.TextChoices):
    PENDING = "pending", _("Pending")
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")
    REFUNDED = "refunded", _("Refunded")


class Order(TimestampedModel):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    status = models.CharField(max_length=20, choices=OrderStatusChoices.choices, default=OrderStatusChoices.PENDING)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id} - {self.status}"


class OrderItem(TimestampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    course = models.ForeignKey(Course, on_delete=models.PROTECT)
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"Item {self.id} for Order #{self.order.id}"


class TransactionStatusChoices(models.TextChoices):
    INITIATED = "initiated", _("Initiated")
    SUCCESS = "success", _("Success")
    FAILED = "failed", _("Failed")
    REFUNDED = "refunded", _("Refunded")


class Transaction(TimestampedModel):
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="transactions")
    gateway = models.CharField(max_length=50, help_text="e.g. kashier, fawry, wallet")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=TransactionStatusChoices.choices, default=TransactionStatusChoices.INITIATED
    )
    gateway_reference = models.CharField(max_length=120, blank=True)
    idempotency_key = models.CharField(max_length=120, unique=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"TXN #{self.id} - {self.gateway}"


class Ledger(TimestampedModel):
    reference_id = models.CharField(max_length=120, unique=True, help_text="e.g. Order #123 Payout")
    description = models.CharField(max_length=255)

    def __str__(self):
        return self.reference_id


class LedgerEntryType(models.TextChoices):
    DEBIT = "debit", _("Debit (-)")
    CREDIT = "credit", _("Credit (+)")


class LedgerEntry(TimestampedModel):
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name="entries")
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="ledger_entries")
    entry_type = models.CharField(max_length=10, choices=LedgerEntryType.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    def __str__(self):
        return f"{self.entry_type.upper()} {self.amount} - Wallet {self.wallet_id}"


class FinancialAuditLog(TimestampedModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50, help_text="e.g. Wallet, Contract")
    entity_id = models.PositiveIntegerField()
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.CharField(max_length=255)

    class Meta:
        ordering = ["-created_at"]


# ============================================================================
# ESCROW HOLDING ENGINE (14-DAY REFUND RISK PERIOD)
# ============================================================================


class EscrowStatusChoices(models.TextChoices):
    HELD = "held", _("Held in Escrow")
    RELEASED = "released", _("Released to Available")
    REFUNDED = "refunded", _("Refunded")
    CLAWED_BACK = "clawed_back", _("Clawed Back")


class EscrowHolding(TimestampedModel):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="escrow_holdings",
        null=True,
        blank=True,
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="escrow_holdings",
        null=True,
        blank=True,
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name="escrow_holdings",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=EscrowStatusChoices.choices,
        default=EscrowStatusChoices.HELD,
        db_index=True,
    )
    mature_at = models.DateTimeField(db_index=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    ledger = models.ForeignKey(
        Ledger,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escrow_holdings",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "mature_at"]),
            models.Index(fields=["wallet", "status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"EscrowHolding #{self.id} - {self.amount} EGP ({self.status}) for Wallet #{self.wallet_id}"


# ============================================================================
# PRICING, SUBSCRIPTION & DUAL PAYMENT GATEWAY MODELS
# ============================================================================


class PlanTypeChoices(models.TextChoices):
    STUDENT = "student", _("Student Plan")
    INSTRUCTOR = "instructor", _("Instructor Plan")
    CENTER = "center", _("Educational Center Plan")
    CUSTOM = "custom", _("Custom Enterprise Plan")


class PricingPlan(TimestampedModel):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    plan_type = models.CharField(
        max_length=20,
        choices=PlanTypeChoices.choices,
        default=PlanTypeChoices.STUDENT,
        db_index=True,
    )
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="EGP")
    is_featured = models.BooleanField(default=False, help_text="Most Popular plan badge")
    is_active = models.BooleanField(default=True)
    trial_days = models.PositiveIntegerField(default=0)
    max_students = models.PositiveIntegerField(default=0, help_text="Maximum allowed students (0 for unlimited)")
    max_instructors = models.PositiveIntegerField(default=0, help_text="Maximum allowed instructors in center")
    video_hours_per_student = models.PositiveIntegerField(default=0, help_text="Video watch quota hours per student")
    features_config = models.JSONField(default=dict, blank=True, help_text="Configured feature toggles")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["is_active", "order"]),
            models.Index(fields=["plan_type", "is_active"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.price_monthly} EGP/mo)"


class PlanFeature(TimestampedModel):
    plan = models.ForeignKey(PricingPlan, related_name="features", on_delete=models.CASCADE)
    label = models.CharField(max_length=200)
    is_included = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.plan.name} - {self.label}"


class Coupon(TimestampedModel):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "%"
        FIXED = "fixed", "EGP"

    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=10, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    minimum_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    maximum_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    per_user_limit = models.PositiveIntegerField(default=1)
    stackable = models.BooleanField(default=False)
    new_users_only = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    applicable_plans = models.ManyToManyField(PricingPlan, blank=True, related_name="coupons")
    applicable_courses = models.ManyToManyField(Course, blank=True, related_name="coupons")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["code", "is_active"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"Coupon {self.code} ({self.discount_value} {self.discount_type})"


class CouponUsage(TimestampedModel):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="usages")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="coupon_usages")
    order = models.ForeignKey("finance.Order", null=True, blank=True, on_delete=models.SET_NULL)
    subscription = models.ForeignKey("finance.Subscription", null=True, blank=True, on_delete=models.SET_NULL)
    discount_applied = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["coupon", "user"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"Usage of {self.coupon.code} by {self.user.email} (-{self.discount_applied} EGP)"


class BulkLicensePack(TimestampedModel):
    center = models.ForeignKey("accounts.CenterProfile", on_delete=models.CASCADE, related_name="license_packs")
    course = models.ForeignKey(
        Course, on_delete=models.PROTECT, related_name="center_license_packs", null=True, blank=True
    )
    total_seats = models.PositiveIntegerField(default=100)
    assigned_seats = models.PositiveIntegerField(default=0)
    price_per_seat = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("15000.00"))
    is_active = models.BooleanField(default=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["center", "is_active"]),
        ]

    def __str__(self):
        return f"BulkLicensePack #{self.id} for {self.center.institution_name} ({self.assigned_seats}/{self.total_seats} seats)"

    @property
    def remaining_seats(self) -> int:
        return max(0, self.total_seats - self.assigned_seats)


class SeatAllocation(TimestampedModel):
    license_pack = models.ForeignKey(BulkLicensePack, on_delete=models.CASCADE, related_name="allocations")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seat_allocations")
    activation_code = models.ForeignKey(
        "activation_codes.ActivationCode", null=True, blank=True, on_delete=models.SET_NULL
    )
    is_active = models.BooleanField(default=True, db_index=True)
    allocated_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-allocated_at"]
        indexes = [
            models.Index(fields=["license_pack", "is_active"]),
            models.Index(fields=["student", "is_active"]),
        ]

    def __str__(self):
        return f"SeatAllocation #{self.id} ({self.student.email}) - {'Active' if self.is_active else 'Revoked'}"


class SubscriptionStatusChoices(models.TextChoices):
    TRIALING = "trialing", _("Trial")
    ACTIVE = "active", _("Active")
    PAST_DUE = "past_due", _("Past Due")
    CANCELED = "canceled", _("Canceled")
    EXPIRED = "expired", _("Expired")


class BillingCycleChoices(models.TextChoices):
    MONTHLY = "monthly", _("شهري")
    YEARLY = "yearly", _("سنوي")


class Subscription(TimestampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(PricingPlan, on_delete=models.PROTECT, related_name="subscriptions")
    price_at_subscription = models.DecimalField(max_digits=10, decimal_places=2)
    currency_at_subscription = models.CharField(max_length=3, default="EGP")
    status = models.CharField(
        max_length=20, choices=SubscriptionStatusChoices.choices, default=SubscriptionStatusChoices.ACTIVE
    )
    billing_cycle = models.CharField(
        max_length=10, choices=BillingCycleChoices.choices, default=BillingCycleChoices.MONTHLY
    )
    current_period_end = models.DateTimeField(db_index=True)
    auto_renew = models.BooleanField(default=True, help_text="Automatic recurring billing flag")
    grace_period_ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    dunning_attempt_count = models.PositiveSmallIntegerField(default=0)
    last_dunning_attempt = models.DateTimeField(null=True, blank=True)
    pre_due_notified = models.BooleanField(
        default=False, help_text="True if pre-due renewal notice sent for current period"
    )
    custom_quota_students = models.PositiveIntegerField(
        default=0, help_text="Custom override student limit (0 means use plan default)"
    )
    custom_quota_instructors = models.PositiveIntegerField(default=0, help_text="Custom override instructor limit")
    custom_features = models.JSONField(default=dict, blank=True, help_text="Custom override feature flags")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["user"]),
            models.Index(fields=["current_period_end"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["grace_period_ends_at"]),
        ]

    def __str__(self):
        return f"Subscription #{self.id} - {self.user.email} - {self.plan.name} ({self.status})"


class PaymentMethod(TimestampedModel):
    class GatewayChoices(models.TextChoices):
        KASHIER = "kashier", "Kashier"
        FAWRY = "fawry", "Fawry"

    class ChannelChoices(models.TextChoices):
        CARD = "card", "Credit/Debit Card"
        MEEZA = "meeza", "Meeza Card"
        MOBILE_WALLET = "mobile_wallet", "Mobile Wallet"
        VALU = "valu", "ValU Installments"

    subscription = models.ForeignKey(Subscription, related_name="payment_methods", on_delete=models.CASCADE)
    gateway = models.CharField(max_length=15, choices=GatewayChoices.choices, default=GatewayChoices.KASHIER)
    gateway_ref = models.CharField(max_length=255, help_text="cardDataToken from gateway or payment reference")
    payment_channel = models.CharField(max_length=20, choices=ChannelChoices.choices, default=ChannelChoices.CARD)
    card_brand = models.CharField(max_length=30, blank=True, default="", help_text="VISA, MASTERCARD, MEEZA, etc.")
    masked_pan = models.CharField(max_length=30, blank=True, default="", help_text="e.g. 411111******1111")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["subscription", "is_active"]),
            models.Index(fields=["gateway_ref"]),
        ]

    def __str__(self):
        return f"{self.gateway} ({self.gateway_ref}) - Active: {self.is_active}"


class TransactionStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    AUTHORIZED = "authorized", _("Authorized")
    PAID = "paid", _("Paid")
    FAILED = "failed", _("Failed")
    REFUNDED = "refunded", _("Refunded")
    PARTIALLY_REFUNDED = "partially_refunded", _("Partially Refunded")
    EXPIRED = "expired", _("Expired")
    VOIDED = "voided", _("Voided")


class PaymentTransaction(TimestampedModel):
    subscription = models.ForeignKey(Subscription, related_name="transactions", on_delete=models.CASCADE)
    gateway = models.CharField(max_length=50)
    gateway_transaction_id = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=TransactionStatus.choices, default=TransactionStatus.PENDING)
    raw_webhook_payload = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["gateway"]),
            models.Index(fields=["gateway_transaction_id"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"PaymentTxn #{self.id} - {self.gateway_transaction_id} ({self.status})"


class Refund(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        PROCESSED = "processed", _("Processed")
        FAILED = "failed", _("Failed")

    class RefundType(models.TextChoices):
        FULL = "full", _("كامل")
        PARTIAL = "partial", _("جزئي")

    transaction = models.ForeignKey(PaymentTransaction, related_name="refunds", on_delete=models.CASCADE)
    refund_type = models.CharField(max_length=10, choices=RefundType.choices, default=RefundType.FULL)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Refund #{self.id} for Txn #{self.transaction_id} - {self.amount} EGP"


class Invoice(TimestampedModel):
    class InvoiceType(models.TextChoices):
        B2B = "b2b", _("فاتورة إلكترونية")
        B2C = "b2c", _("إيصال إلكتروني")

    transaction = models.OneToOneField(PaymentTransaction, on_delete=models.CASCADE, related_name="invoice")
    invoice_type = models.CharField(max_length=5, choices=InvoiceType.choices, default=InvoiceType.B2C)
    eta_uuid = models.CharField(max_length=100, blank=True)
    pdf_file = models.FileField(upload_to="invoices/", blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invoice #{self.id} ({self.invoice_type.upper()}) - ETA: {self.eta_uuid or 'N/A'}"


class PricingChangeRequest(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    target_model = models.CharField(max_length=50, help_text="PricingPlan or Coupon")
    target_id = models.PositiveIntegerField(null=True, blank=True, help_text="ID of target if updating/deleting")
    old_value = models.JSONField(default=dict, blank=True)
    new_value = models.JSONField(default=dict)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="requested_changes", on_delete=models.CASCADE
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="approved_changes", null=True, blank=True, on_delete=models.SET_NULL
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ChangeReq #{self.id} for {self.target_model} by {self.requested_by.email} ({self.status})"


class DetailedAuditLog(TimestampedModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.PositiveIntegerField()
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["actor"]),
            models.Index(fields=["action"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Audit: {self.action} on {self.entity_type}#{self.entity_id} by {self.actor}"


# ============================================================================
# PAYOUT REQUEST & DISBURSEMENT ENGINE (MAKER-CHECKER GOVERNANCE)
# ============================================================================


class PayoutStatusChoices(models.TextChoices):
    PENDING = "pending", _("قيد المراجعة")
    APPROVED = "approved", _("تمت الموافقة")
    REJECTED = "rejected", _("مرفوض")
    DISBURSED = "disbursed", _("تم التحويل")


class PayoutChannelChoices(models.TextChoices):
    INSTAPAY = "instapay", _("إنستاباي (InstaPay)")
    MOBILE_WALLET = "mobile_wallet", _("محفظة إلكترونية (Vodafone/Orange/Etisalat/WE)")
    BANK_WIRE = "bank_wire", _("تحويل بنكي (Bank Wire / IBAN)")


class PayoutRequest(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payout_requests",
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name="payout_requests",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    channel = models.CharField(
        max_length=20,
        choices=PayoutChannelChoices.choices,
        default=PayoutChannelChoices.INSTAPAY,
    )
    account_details = models.JSONField(
        default=dict, help_text="e.g. {'phone': '010...', 'iban': 'EG...', 'instapay_address': 'user@instapay'}"
    )
    status = models.CharField(
        max_length=20,
        choices=PayoutStatusChoices.choices,
        default=PayoutStatusChoices.PENDING,
        db_index=True,
    )
    admin_notes = models.TextField(blank=True, default="")
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="processed_payouts",
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    transaction_reference = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"Payout #{self.id} - {self.user.email} - {self.amount} EGP ({self.status})"


class AcademicInvoiceStatus(models.TextChoices):
    PENDING_PAYMENT_CONFIRMATION = "pending_payment_confirmation", _("Pending Payment Confirmation")
    APPROVED_ACTIVE = "approved_active", _("Approved & Active")
    REJECTED = "rejected", _("Rejected")
    CANCELLED = "cancelled", _("Cancelled")


class AcademicQuotationInvoice(TimestampedModel):
    """
    Model for Academic Center dynamic pricing quotations, pro-forma invoices,
    and support-assisted WhatsApp payments.
    """

    invoice_number = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="academic_invoices",
        null=True,
        blank=True,
    )
    center_profile = models.ForeignKey(
        "accounts.CenterProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="academic_invoices",
    )
    institution_name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")

    plan_type = models.CharField(
        max_length=20,
        choices=[
            ("monthly", "Monthly"),
            ("term", "Term Plan"),
            ("full_year", "Full Academic Year"),
        ],
        default="term",
    )
    student_count = models.PositiveIntegerField(default=100)
    student_tiers = models.PositiveIntegerField(default=1)
    calculated_months = models.PositiveIntegerField(default=1)
    monthly_base_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("3000.00"))
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_percentage = models.PositiveIntegerField(default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    target_end_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=32,
        choices=AcademicInvoiceStatus.choices,
        default=AcademicInvoiceStatus.PENDING_PAYMENT_CONFIRMATION,
        db_index=True,
    )
    payment_method_note = models.CharField(max_length=100, blank=True, default="InstaPay / Vodafone Cash / Bank")
    admin_notes = models.TextField(blank=True, default="")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_academic_invoices",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["invoice_number"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"Invoice #{self.invoice_number} - {self.institution_name} - {self.net_total} EGP ({self.status})"


class PaymentGatewayConfig(TimestampedModel):
    """
    Authoritative configuration for electronic payment gateways (e.g. Kashier).
    Managed by Super Admin. When inactive or missing credentials, public checkout
    surfaces dynamic 'Coming Soon' (قريباً) states across courses and pricing pages.
    """

    gateway_name = models.CharField(max_length=50, unique=True, default="kashier")
    display_name = models.CharField(max_length=100, default="Kashier Payment Gateway")
    is_active = models.BooleanField(
        default=False,
        help_text=_("Whether electronic payment is active. If false, public pages show 'coming soon'."),
    )
    mode = models.CharField(
        max_length=20,
        choices=[("test", _("Test Mode")), ("live", _("Live / Production"))],
        default="test",
    )
    merchant_id = models.CharField(max_length=255, blank=True, default="")
    api_key = models.CharField(max_length=255, blank=True, default="")
    iframe_key = models.CharField(max_length=255, blank=True, default="")
    extra_config = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _("Payment Gateway Configuration")
        verbose_name_plural = _("Payment Gateway Configurations")

    def __str__(self):
        status_str = "Active" if self.is_enabled else "Inactive (Coming Soon)"
        return f"{self.display_name} ({self.mode}) - {status_str}"

    @property
    def is_enabled(self) -> bool:
        """Returns True only when the gateway is active AND credentials are provided."""
        return bool(self.is_active and self.merchant_id.strip() and self.api_key.strip())

