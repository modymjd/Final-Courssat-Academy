from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import TimestampedModel
from apps.courses.models import Course


class CodeQuotaContract(TimestampedModel):
    """Commercial capacity contract for monthly activation-code generation.

    The contract is intentionally separate from student subscription plans and
    instructor revenue-sharing contracts. Its unit of billing is code capacity,
    not redeemed codes.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="code_quota_contracts",
        on_delete=models.PROTECT,
        limit_choices_to=Q(role__in=["instructor", "center"]),
    )
    monthly_code_limit = models.PositiveIntegerField(default=10)
    billing_unit_size = models.PositiveIntegerField(default=100)
    price_per_billing_unit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="EGP")
    effective_from = models.DateField(default=timezone.localdate)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-effective_from", "-created_at"]
        indexes = [
            models.Index(fields=["owner", "is_active", "effective_from"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(monthly_code_limit__gt=0),
                name="quota_contract_monthly_limit_positive",
            ),
            models.CheckConstraint(
                condition=Q(billing_unit_size__gt=0),
                name="quota_contract_billing_unit_positive",
            ),
            models.CheckConstraint(
                condition=Q(price_per_billing_unit__gte=Decimal("0.00")),
                name="quota_contract_price_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")),
                name="quota_contract_valid_date_range",
            ),
            models.UniqueConstraint(
                fields=["owner"],
                condition=Q(is_active=True),
                name="quota_contract_one_active_per_owner",
            ),
        ]

    def __str__(self):
        return f"Quota contract: {self.owner.email} - {self.monthly_code_limit} codes/month"


class CodeQuotaPeriod(TimestampedModel):
    """Immutable monthly commercial snapshot plus concurrency-safe usage counter.

    A period is created on first usage/read for the active contract and copies
    the contract values. Later contract changes therefore cannot rewrite a
    month's commercial terms.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        FINALIZED = "finalized", "Finalized"
        PAID = "paid", "Paid"
        VOID = "void", "Void"

    contract = models.ForeignKey(
        CodeQuotaContract,
        related_name="periods",
        on_delete=models.PROTECT,
    )
    period_start = models.DateField()
    period_end = models.DateField()
    monthly_code_limit_snapshot = models.PositiveIntegerField()
    billing_unit_size_snapshot = models.PositiveIntegerField()
    price_per_billing_unit_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    generated_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN, db_index=True)

    class Meta:
        ordering = ["-period_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "period_start"],
                name="quota_period_one_per_contract_month",
            ),
            models.CheckConstraint(
                condition=Q(period_end__gte=models.F("period_start")),
                name="quota_period_valid_date_range",
            ),
            models.CheckConstraint(
                condition=Q(generated_count__gte=0),
                name="quota_period_generated_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["contract", "period_start"]),
            models.Index(fields=["status", "period_start"]),
        ]

    @property
    def billed_units(self):
        # Capacity billing is block-based: ceil(limit / billing unit).
        return (self.monthly_code_limit_snapshot + self.billing_unit_size_snapshot - 1) // self.billing_unit_size_snapshot

    @property
    def billed_amount(self):
        return Decimal(self.billed_units) * Decimal(str(self.price_per_billing_unit_snapshot))

    @property
    def available_count(self):
        return max(0, self.monthly_code_limit_snapshot - self.generated_count)

    def __str__(self):
        return f"Quota period: {self.contract.owner.email} {self.period_start}"


class ActivationCodeBatch(TimestampedModel):
    class BatchType(models.TextChoices):
        COURSE_ACCESS = "course_access", "وصول لكورس"
        DIGITAL_BALANCE = "digital_balance", "شحن رصيد محفظة"
        INSTRUCTOR_JOIN = "instructor_join", "انضمام مدرس"
        CENTER_STUDENT = "center_student", "طالب مؤسسة"
        INSTRUCTOR_STUDENT = "instructor_student", "طالب مدرس"

    batch_type = models.CharField(max_length=25, choices=BatchType.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="created_code_batches", on_delete=models.CASCADE
    )
    target_instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="assigned_code_batches",
        on_delete=models.SET_NULL,
        limit_choices_to={"role": "instructor"},
        help_text="المدرس المخصص له هذه الدفعة من الأكواد (في حال توليدها من سنتر)",
    )
    courses = models.ManyToManyField(Course, blank=True, related_name="code_batches")
    quantity = models.PositiveIntegerField()
    price_per_code = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    balance_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, help_text="Wallet credit amount for digital balance vouchers"
    )
    access_duration_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="مدة صلاحية الكورس بالأيام بعد التفعيل (مثال: 30 للشهر، 120 للترم). اترك فارغاً إذا كان مدى الحياة.",
    )
    fixed_access_until = models.DateField(
        null=True,
        blank=True,
        help_text="تاريخ محدد ثابت لانتهاء وصول جميع الطلاب (مثال: 30 يونيو).",
    )
    expires_at = models.DateTimeField()
    pdf_file = models.FileField(upload_to="activation_codes/pdfs/", null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Batch #{self.id} ({self.get_batch_type_display()}) by {self.created_by.email}"


class ActivationCode(TimestampedModel):
    class CodeStatus(models.TextChoices):
        ACTIVE = "active", "نشط"
        REDEEMED = "redeemed", "مُستخدم"
        REVOKED = "revoked", "ملغي"

    batch = models.ForeignKey(ActivationCodeBatch, related_name="codes", on_delete=models.CASCADE)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    password = models.CharField(max_length=128)
    pin_hash = models.CharField(max_length=128, blank=True, default="", help_text="PBKDF2/Argon2 hash of PIN")
    status = models.CharField(max_length=10, choices=CodeStatus.choices, default=CodeStatus.ACTIVE)

    redeemed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="redeemed_codes", on_delete=models.SET_NULL
    )
    redeemed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["code", "password"]),
            models.Index(fields=["status", "code"]),
            models.Index(fields=["batch", "status"]),
        ]

    def __str__(self):
        return f"Code {self.code} ({self.get_status_display()})"

    @property
    def is_expired(self):
        return self.status == self.CodeStatus.ACTIVE and self.batch.expires_at < timezone.now()


class CenterQuotaRequest(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "قيد المراجعة"
        APPROVED = "approved", "معتمد"
        REJECTED = "rejected", "مرفوض"

    center = models.ForeignKey(
        "accounts.CenterProfile",
        related_name="quota_requests",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="center_quota_requests",
        on_delete=models.CASCADE,
    )
    requested_quantity = models.PositiveIntegerField(help_text="عدد الأكواد الإضافية المطلوبة")
    current_quota = models.PositiveIntegerField(default=0)
    reason = models.TextField(blank=True, help_text="سبب أو مبرر طلب زيادة الكوتة")
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="reviewed_quota_requests",
        on_delete=models.SET_NULL,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["center", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        owner_label = self.center.institution_name if self.center else (self.requested_by.email if self.requested_by else "Unknown")
        return f"QuotaRequest #{self.id} ({self.requested_quantity} codes) for {owner_label} - {self.get_status_display()}"
