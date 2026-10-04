from rest_framework import serializers

from apps.accounts.models import UserRole
from apps.activation_codes.models import ActivationCode, ActivationCodeBatch, CodeQuotaContract
from apps.courses.models import Course


class CoursePreviewSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(source="instructor.full_name", read_only=True)
    thumbnail = serializers.CharField(source="image_url", read_only=True, default="")

    class Meta:
        model = Course
        fields = ("id", "title", "instructor_name", "thumbnail", "image_url")


class ActivationCodeBatchCreateSerializer(serializers.ModelSerializer):
    course_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    target_instructor_id = serializers.IntegerField(required=False, allow_null=True)
    shelf_life_days = serializers.IntegerField(required=False, default=90, write_only=True)

    class Meta:
        model = ActivationCodeBatch
        fields = (
            "batch_type",
            "quantity",
            "price_per_code",
            "balance_amount",
            "course_ids",
            "target_instructor_id",
            "access_duration_days",
            "fixed_access_until",
            "shelf_life_days",
        )


class ActivationCodeBatchListSerializer(serializers.ModelSerializer):
    courses = CoursePreviewSerializer(many=True, read_only=True)
    target_instructor_id = serializers.IntegerField(source="target_instructor.id", read_only=True, default=None)
    target_instructor_name = serializers.CharField(source="target_instructor.full_name", read_only=True, default="")
    active_count = serializers.SerializerMethodField()
    redeemed_count = serializers.SerializerMethodField()
    expired_count = serializers.SerializerMethodField()
    unredeemed_count = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = ActivationCodeBatch
        fields = (
            "id", "batch_type", "quantity", "price_per_code", "balance_amount", "expires_at", "created_at",
            "courses", "target_instructor_id", "target_instructor_name", "pdf_file", "active_count",
            "redeemed_count", "expired_count", "unredeemed_count", "is_expired",
            "access_duration_days", "fixed_access_until",
        )

    def get_active_count(self, obj):
        from django.utils import timezone

        return obj.codes.filter(status=ActivationCode.CodeStatus.ACTIVE, batch__expires_at__gt=timezone.now()).count()

    def get_redeemed_count(self, obj):
        return obj.codes.filter(status=ActivationCode.CodeStatus.REDEEMED).count()

    def get_expired_count(self, obj):
        from django.utils import timezone

        return obj.codes.filter(status=ActivationCode.CodeStatus.ACTIVE, batch__expires_at__lt=timezone.now()).count()

    def get_unredeemed_count(self, obj):
        return obj.codes.filter(status=ActivationCode.CodeStatus.ACTIVE).count()

    def get_is_expired(self, obj):
        from django.utils import timezone

        return obj.expires_at < timezone.now() if obj.expires_at else False


class ActivationCodeItemSerializer(serializers.ModelSerializer):
    batch_id = serializers.IntegerField(source="batch.id", read_only=True)
    batch_type = serializers.CharField(source="batch.batch_type", read_only=True)
    expires_at = serializers.DateTimeField(source="batch.expires_at", read_only=True)
    redeemed_by_name = serializers.CharField(source="redeemed_by.full_name", read_only=True, default="")
    redeemed_by_email = serializers.CharField(source="redeemed_by.email", read_only=True, default="")
    target_instructor_name = serializers.CharField(source="batch.target_instructor.full_name", read_only=True, default="")
    course_names = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()

    class Meta:
        model = ActivationCode
        fields = (
            "id", "batch_id", "batch_type", "code", "password", "status", "display_status", "created_at",
            "expires_at", "redeemed_at", "redeemed_by_name", "redeemed_by_email", "target_instructor_name",
            "course_names",
        )

    def get_course_names(self, obj):
        return list(obj.batch.courses.values_list("title", flat=True))

    def get_display_status(self, obj):
        from django.utils import timezone

        if obj.status == ActivationCode.CodeStatus.REDEEMED:
            return "redeemed"
        if obj.batch.expires_at and obj.batch.expires_at < timezone.now():
            return "expired"
        return "active"


class CenterQuotaRequestSerializer(serializers.ModelSerializer):
    center_id = serializers.IntegerField(source="center.id", read_only=True, allow_null=True, default=None)
    center_name = serializers.CharField(source="center.institution_name", read_only=True, default="")
    requested_by_email = serializers.CharField(source="requested_by.email", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.full_name", read_only=True, default="")
    requested_by_role = serializers.CharField(source="requested_by.role", read_only=True, default="")
    reviewed_by_name = serializers.CharField(source="reviewed_by.full_name", read_only=True, default="")

    class Meta:
        from apps.activation_codes.models import CenterQuotaRequest

        model = CenterQuotaRequest
        fields = (
            "id", "center_id", "center_name", "requested_by_email", "requested_by_name", "requested_by_role",
            "requested_quantity", "current_quota", "reason", "status", "reviewed_by_name", "reviewed_at",
            "admin_notes", "created_at",
        )
        read_only_fields = (
            "id", "center_id", "center_name", "requested_by_email", "requested_by_name", "requested_by_role",
            "current_quota", "status", "reviewed_by_name", "reviewed_at", "admin_notes", "created_at",
        )


class CodeQuotaContractSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    owner_role = serializers.CharField(source="owner.role", read_only=True)
    current_generated = serializers.SerializerMethodField()
    current_available = serializers.SerializerMethodField()

    class Meta:
        model = CodeQuotaContract
        fields = (
            "id", "owner", "owner_email", "owner_name", "owner_role", "monthly_code_limit", "billing_unit_size",
            "price_per_billing_unit", "currency", "effective_from", "effective_to", "is_active", "notes",
            "current_generated", "current_available", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "created_at", "updated_at", "owner_email", "owner_name", "owner_role",
            "current_generated", "current_available",
        )

    def _get_snapshot(self, obj):
        if not hasattr(obj, "_cached_quota_snapshot"):
            from apps.activation_codes.services.quota import QuotaService
            obj._cached_quota_snapshot = QuotaService.get_quota_snapshot(obj.owner)
        return obj._cached_quota_snapshot

    def get_current_generated(self, obj):
        return self._get_snapshot(obj)["generated"]

    def get_current_available(self, obj):
        return self._get_snapshot(obj)["available"]

    def validate_owner(self, owner):
        if owner.role not in (UserRole.INSTRUCTOR, UserRole.CENTER):
            raise serializers.ValidationError("Quota contracts can only target instructors or centers.")
        if self.instance is not None and owner.pk != self.instance.owner_id:
            raise serializers.ValidationError("A quota contract cannot be transferred to another owner.")
        return owner

    def validate_currency(self, value):
        normalized = str(value).strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise serializers.ValidationError("Currency must be a 3-letter ISO-style code.")
        return normalized

    def validate(self, attrs):
        from django.utils import timezone

        effective_from = attrs.get("effective_from", getattr(self.instance, "effective_from", None))
        effective_to = attrs.get("effective_to", getattr(self.instance, "effective_to", None))
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        if effective_from and effective_to and effective_to < effective_from:
            raise serializers.ValidationError({"effective_to": "effective_to cannot be before effective_from."})
        if is_active and effective_from and effective_from > timezone.localdate():
            raise serializers.ValidationError({"effective_from": "An active quota contract cannot start in the future."})
        return attrs


class CodeQuotaPeriodSerializer(serializers.ModelSerializer):
    owner = serializers.IntegerField(source="contract.owner_id", read_only=True)
    owner_email = serializers.EmailField(source="contract.owner.email", read_only=True)
    billed_units = serializers.IntegerField(read_only=True)
    billed_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    available_count = serializers.IntegerField(read_only=True)

    class Meta:
        from apps.activation_codes.models import CodeQuotaPeriod

        model = CodeQuotaPeriod
        fields = (
            "id", "contract", "owner", "owner_email", "period_start", "period_end", "monthly_code_limit_snapshot",
            "billing_unit_size_snapshot", "price_per_billing_unit_snapshot", "generated_count", "available_count",
            "billed_units", "billed_amount", "status", "created_at", "updated_at",
        )
        read_only_fields = fields


class CodeValidationRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)
    password = serializers.CharField(max_length=20)
    course_id = serializers.IntegerField(required=False, allow_null=True, default=None)


class CodeRedemptionRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)
    password = serializers.CharField(max_length=20)
    course_id = serializers.IntegerField(required=False, allow_null=True, default=None)
