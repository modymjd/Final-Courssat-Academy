from rest_framework import serializers

from apps.accounts.models import User, UserRole
from apps.common.models import AuditLog
from apps.courses.models import Course
from apps.finance.models import Order


class SuperAdminUserListSerializer(serializers.ModelSerializer):
    """Safe list serializer for Super Admin user management table. Excludes all credentials."""

    fullName = serializers.SerializerMethodField("get_full_name")
    dateJoined = serializers.DateTimeField(source="created_at", read_only=True)
    lastLogin = serializers.DateTimeField(source="last_login_at", read_only=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "fullName",
            "role",
            "phone",
            "avatar",
            "isActive",
            "is_staff",
            "is_superuser",
            "lastLogin",
            "dateJoined",
        )
        read_only_fields = fields

    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email


class CourseSummarySnippetSerializer(serializers.ModelSerializer):
    categoryName = serializers.CharField(source="category.name", default="", read_only=True)

    class Meta:
        model = Course
        fields = ("id", "title", "status", "price", "categoryName", "created_at")
        read_only_fields = fields


class PaymentSummarySnippetSerializer(serializers.ModelSerializer):
    courseTitle = serializers.SerializerMethodField("get_course_title")
    amount = serializers.DecimalField(source="total", max_digits=10, decimal_places=2, read_only=True)
    order_number = serializers.SerializerMethodField("get_order_number")
    payment_method = serializers.SerializerMethodField("get_payment_method")

    class Meta:
        model = Order
        fields = ("id", "order_number", "amount", "status", "payment_method", "courseTitle", "created_at")
        read_only_fields = fields

    def get_order_number(self, obj) -> str:
        return f"ORD-{obj.id:06d}"

    def get_course_title(self, obj) -> str:
        item = obj.items.select_related("course").first()
        return item.course.title if item and item.course else "Platform Service"

    def get_payment_method(self, obj) -> str:
        tx = obj.transactions.first()
        return tx.payment_gateway if tx else "card"


class AuditLogSnippetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ("id", "action_type", "target_model", "target_id", "ip_address", "created_at")
        read_only_fields = fields


class SuperAdminUserDetailSerializer(serializers.ModelSerializer):
    """Enriched user profile serializer including courses, payments, and audit logs."""

    fullName = serializers.SerializerMethodField("get_full_name")
    dateJoined = serializers.DateTimeField(source="created_at", read_only=True)
    lastLogin = serializers.DateTimeField(source="last_login_at", read_only=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)

    coursesEnrolled = serializers.SerializerMethodField("get_courses_enrolled")
    coursesTaught = serializers.SerializerMethodField("get_courses_taught")
    paymentHistory = serializers.SerializerMethodField("get_payment_history")
    recentAuditLogs = serializers.SerializerMethodField("get_recent_audit_logs")

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "fullName",
            "role",
            "phone",
            "bio",
            "avatar",
            "isActive",
            "is_staff",
            "is_superuser",
            "lastLogin",
            "dateJoined",
            "coursesEnrolled",
            "coursesTaught",
            "paymentHistory",
            "recentAuditLogs",
        )
        read_only_fields = fields

    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

    def get_courses_enrolled(self, obj):
        if hasattr(obj, "enrollments"):
            courses = [e.course for e in obj.enrollments.select_related("course", "course__category")[:10]]
            return CourseSummarySnippetSerializer(courses, many=True).data
        return []

    def get_courses_taught(self, obj):
        if obj.role in (UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN):
            qs = Course.objects.filter(instructor=obj).select_related("category")[:10]
            return CourseSummarySnippetSerializer(qs, many=True).data
        return []

    def get_payment_history(self, obj):
        qs = Order.objects.filter(student=obj).prefetch_related("items__course", "transactions")[:10]
        return PaymentSummarySnippetSerializer(qs, many=True).data

    def get_recent_audit_logs(self, obj):
        qs = AuditLog.objects.filter(actor=obj).order_by("-created_at")[:10]
        return AuditLogSnippetSerializer(qs, many=True).data


class UserSuspendSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="Admin action")


class UserRoleChangeSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserRole.choices)


class UserDeleteConfirmationSerializer(serializers.Serializer):
    confirm_email = serializers.EmailField(required=True)

    def validate_confirm_email(self, value):
        user = self.context.get("user")
        if user and value.strip().lower() != user.email.strip().lower():
            raise serializers.ValidationError(f"Confirmation email does not match target user email '{user.email}'.")
        return value
