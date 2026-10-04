from rest_framework import serializers

from apps.courses.models import Course

from .models import (
    Coupon,
    EscrowHolding,
    Invoice,
    LedgerEntry,
    Order,
    OrderItem,
    PaymentMethod,
    PlanFeature,
    PricingChangeRequest,
    PricingPlan,
    Subscription,
    Transaction,
    Wallet,
)


class CheckoutSerializer(serializers.Serializer):
    course_id = serializers.IntegerField(required=True, help_text="ID of the course to purchase")
    gateway = serializers.CharField(required=False, default="stripe", help_text="Payment gateway identifier")

    def validate_course_id(self, value):
        try:
            Course.objects.get(pk=value, status="published")
        except Course.DoesNotExist as err:
            raise serializers.ValidationError("Course not found or is not currently published.") from err
        return value


class OrderItemSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "course", "course_title", "price_at_purchase"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "status",
            "status_display",
            "subtotal",
            "discount_amount",
            "tax_amount",
            "total",
            "items",
            "created_at",
        ]
        read_only_fields = ["id", "status", "subtotal", "discount_amount", "tax_amount", "total", "created_at"]


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = [
            "id",
            "wallet_type",
            "currency",
            "current_balance",
            "pending_balance",
            "available_balance",
            "withdrawn_balance",
            "updated_at",
        ]
        read_only_fields = fields


class LedgerEntrySerializer(serializers.ModelSerializer):
    reference_id = serializers.CharField(source="ledger.reference_id", read_only=True)
    description = serializers.CharField(source="ledger.description", read_only=True)

    class Meta:
        model = LedgerEntry
        fields = [
            "id",
            "ledger",
            "reference_id",
            "description",
            "wallet",
            "entry_type",
            "amount",
            "created_at",
        ]
        read_only_fields = fields


class EscrowHoldingSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = EscrowHolding
        fields = [
            "id",
            "order",
            "order_item",
            "wallet",
            "amount",
            "status",
            "status_display",
            "mature_at",
            "settled_at",
            "created_at",
        ]
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            "id",
            "order",
            "gateway",
            "amount",
            "status",
            "gateway_reference",
            "created_at",
        ]
        read_only_fields = fields


# ============================================================================
# PRICING, COUPON & SUBSCRIPTION SERIALIZERS
# ============================================================================


class PlanFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanFeature
        fields = ["id", "label", "is_included", "order"]


class PricingPlanSerializer(serializers.ModelSerializer):
    features = PlanFeatureSerializer(many=True, required=False)
    yearly_savings_percentage = serializers.SerializerMethodField()

    class Meta:
        model = PricingPlan
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "price_monthly",
            "price_yearly",
            "currency",
            "is_featured",
            "is_active",
            "trial_days",
            "order",
            "features",
            "yearly_savings_percentage",
        ]

    def get_yearly_savings_percentage(self, obj) -> int:
        if not obj.price_monthly or obj.price_monthly == 0:
            return 0
        full_yearly = obj.price_monthly * 12
        if full_yearly <= 0:
            return 0
        savings = ((full_yearly - obj.price_yearly) / full_yearly) * 100
        return max(0, int(round(savings)))

    def create(self, validated_data):
        features_data = validated_data.pop("features", [])
        plan = PricingPlan.objects.create(**validated_data)
        for idx, feat in enumerate(features_data):
            PlanFeature.objects.create(
                plan=plan,
                label=feat.get("label", ""),
                is_included=feat.get("is_included", True),
                order=feat.get("order", idx),
            )
        return plan

    def update(self, instance, validated_data):
        features_data = validated_data.pop("features", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if features_data is not None:
            instance.features.all().delete()
            for idx, feat in enumerate(features_data):
                PlanFeature.objects.create(
                    plan=instance,
                    label=feat.get("label", ""),
                    is_included=feat.get("is_included", True),
                    order=feat.get("order", idx),
                )
        return instance


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "discount_type",
            "discount_value",
            "minimum_amount",
            "maximum_discount",
            "max_uses",
            "used_count",
            "per_user_limit",
            "stackable",
            "new_users_only",
            "expires_at",
            "applicable_plans",
            "is_active",
        ]


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField(required=True)
    plan_id = serializers.IntegerField(required=True)
    billing_cycle = serializers.ChoiceField(choices=["monthly", "yearly"], default="monthly")


class SubscriptionCheckoutSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField(required=True)
    billing_cycle = serializers.ChoiceField(choices=["monthly", "yearly"], default="monthly")
    payment_gateway = serializers.ChoiceField(choices=["kashier", "fawry"], default="kashier")
    coupon_code = serializers.CharField(required=False, allow_blank=True)


class KashierCheckoutSessionSerializer(serializers.Serializer):
    resource_type = serializers.ChoiceField(
        choices=["course", "exam", "subscription", "wallet_deposit"],
        default="course",
        help_text="Resource type: course, exam, subscription, or wallet_deposit",
    )
    resource_id = serializers.CharField(
        required=True,
        help_text="ID of the course, exam, subscription plan, or wallet",
    )
    billing_cycle = serializers.ChoiceField(
        choices=["monthly", "yearly"],
        default="monthly",
        required=False,
        help_text="Billing cycle if purchasing a subscription (monthly/yearly)",
    )
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        help_text="Custom amount (required for wallet_deposit)",
    )
    coupon_code = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional discount coupon code",
    )
    return_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="Optional custom frontend return URL",
    )


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = [
            "id",
            "gateway",
            "gateway_ref",
            "payment_channel",
            "card_brand",
            "masked_pan",
            "is_active",
            "created_at",
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PricingPlanSerializer(read_only=True)
    payment_methods = PaymentMethodSerializer(many=True, read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "plan",
            "price_at_subscription",
            "currency_at_subscription",
            "status",
            "billing_cycle",
            "current_period_end",
            "auto_renew",
            "grace_period_ends_at",
            "dunning_attempt_count",
            "payment_methods",
            "created_at",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    signed_download_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "transaction",
            "invoice_type",
            "eta_uuid",
            "signed_download_url",
            "created_at",
        ]

    def get_signed_download_url(self, obj) -> str:
        from .services import BunnyStorageService

        if obj.pdf_file:
            return BunnyStorageService.get_temporary_signed_url(obj.pdf_file.name)
        return ""


class PricingChangeRequestSerializer(serializers.ModelSerializer):
    requested_by_email = serializers.EmailField(source="requested_by.email", read_only=True)
    approved_by_email = serializers.EmailField(source="approved_by.email", read_only=True, default=None)

    class Meta:
        model = PricingChangeRequest
        fields = [
            "id",
            "target_model",
            "target_id",
            "old_value",
            "new_value",
            "requested_by",
            "requested_by_email",
            "approved_by",
            "approved_by_email",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "requested_by", "approved_by", "status", "created_at"]


# ============================================================================
# PAYOUT REQUEST & MAKER-CHECKER SERIALIZERS
# ============================================================================


class PayoutRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        from .models import PayoutRequest

        model = PayoutRequest
        fields = [
            "id",
            "user",
            "user_email",
            "wallet",
            "amount",
            "channel",
            "channel_display",
            "account_details",
            "status",
            "status_display",
            "admin_notes",
            "transaction_reference",
            "created_at",
            "processed_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "user_email",
            "wallet",
            "status",
            "status_display",
            "admin_notes",
            "transaction_reference",
            "created_at",
            "processed_at",
        ]

    def validate_amount(self, value):
        from decimal import Decimal

        if value < Decimal("500.00"):
            raise serializers.ValidationError("الحد الأدنى لطلب سحب الأرباح هو 500 جنيه مصري.")
        return value


class PayoutApprovalSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject", "disburse"], required=True)
    admin_notes = serializers.CharField(required=False, allow_blank=True, default="")
    transaction_reference = serializers.CharField(required=False, allow_blank=True, default="")
