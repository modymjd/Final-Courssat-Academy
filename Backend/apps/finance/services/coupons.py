from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.finance.models import (
    Coupon,
    CouponUsage,
    Order,
    OrderStatusChoices,
    Subscription,
    SubscriptionStatusChoices,
)


class CouponCalculationResult:
    def __init__(
        self,
        is_valid: bool,
        discount_amount: Decimal = Decimal("0.00"),
        final_price: Decimal = Decimal("0.00"),
        coupon: Coupon | None = None,
        error_message: str = "",
    ):
        self.is_valid = is_valid
        self.discount_amount = discount_amount
        self.final_price = final_price
        self.coupon = coupon
        self.error_message = error_message

    def to_dict(self):
        return {
            "valid": self.is_valid,
            "discount_amount": str(self.discount_amount),
            "final_price": str(self.final_price),
            "coupon_code": self.coupon.code if self.coupon else None,
            "error_message": self.error_message,
        }


class CouponService:
    @staticmethod
    def validate_and_calculate(
        coupon_code: str,
        user=None,
        base_amount: Decimal = Decimal("0.00"),
        item_type: str = "general",
        item_obj=None,
    ) -> CouponCalculationResult:
        if not coupon_code:
            return CouponCalculationResult(
                is_valid=True,
                discount_amount=Decimal("0.00"),
                final_price=base_amount,
            )

        clean_code = coupon_code.strip().upper()
        coupon = Coupon.objects.filter(code=clean_code, is_active=True).first()
        if not coupon:
            coupon = Coupon.objects.filter(code=coupon_code, is_active=True).first()

        if not coupon:
            return CouponCalculationResult(
                is_valid=False,
                discount_amount=Decimal("0.00"),
                final_price=base_amount,
                error_message="كود الخصم غير صحيح أو غير مفعّل.",
            )

        # 1. Check Expiry
        if coupon.expires_at and coupon.expires_at < timezone.now():
            return CouponCalculationResult(
                is_valid=False,
                discount_amount=Decimal("0.00"),
                final_price=base_amount,
                coupon=coupon,
                error_message="كود الخصم منتهي الصلاحية.",
            )

        # 2. Check Max Uses
        if coupon.max_uses and coupon.used_count >= coupon.max_uses:
            return CouponCalculationResult(
                is_valid=False,
                discount_amount=Decimal("0.00"),
                final_price=base_amount,
                coupon=coupon,
                error_message="تم الوصول إلى الحد الأقصى لاستخدام هذا الكود.",
            )

        # 3. Check User Specific Restrictions
        if user and getattr(user, "is_authenticated", False):
            user_uses = CouponUsage.objects.filter(coupon=coupon, user=user).count()
            if user_uses >= coupon.per_user_limit:
                return CouponCalculationResult(
                    is_valid=False,
                    discount_amount=Decimal("0.00"),
                    final_price=base_amount,
                    coupon=coupon,
                    error_message="لقد استخدمت هذا الكود بالحد الأقصى المسموح لك.",
                )

            if coupon.new_users_only:
                has_completed_orders = Order.objects.filter(student=user, status=OrderStatusChoices.COMPLETED).exists()
                has_active_subs = Subscription.objects.filter(
                    user=user, status=SubscriptionStatusChoices.ACTIVE
                ).exists()
                if has_completed_orders or has_active_subs:
                    return CouponCalculationResult(
                        is_valid=False,
                        discount_amount=Decimal("0.00"),
                        final_price=base_amount,
                        coupon=coupon,
                        error_message="هذا الكود مخصص للمستخدمين الجدد فقط.",
                    )

        # 4. Check Applicability
        if item_type == "plan" and coupon.applicable_plans.exists():
            if not item_obj or not coupon.applicable_plans.filter(pk=item_obj.pk).exists():
                return CouponCalculationResult(
                    is_valid=False,
                    discount_amount=Decimal("0.00"),
                    final_price=base_amount,
                    coupon=coupon,
                    error_message="هذا الكود غير قابل للتطبيق على هذه الخطة.",
                )
        elif item_type == "course" and coupon.applicable_courses.exists():
            if not item_obj or not coupon.applicable_courses.filter(pk=item_obj.pk).exists():
                return CouponCalculationResult(
                    is_valid=False,
                    discount_amount=Decimal("0.00"),
                    final_price=base_amount,
                    coupon=coupon,
                    error_message="هذا الكود غير قابل للتطبيق على هذا الكورس.",
                )

        # 5. Check Minimum Amount
        if coupon.minimum_amount and base_amount < coupon.minimum_amount:
            return CouponCalculationResult(
                is_valid=False,
                discount_amount=Decimal("0.00"),
                final_price=base_amount,
                coupon=coupon,
                error_message=f"الحد الأقصى للاستفادة يتطلب مبلغ لا يقل عن {coupon.minimum_amount} ج.م",
            )

        # 6. Calculate Discount Amount
        if coupon.discount_type == Coupon.DiscountType.PERCENT:
            raw_discount = (base_amount * coupon.discount_value) / Decimal("100.00")
            if coupon.maximum_discount and raw_discount > coupon.maximum_discount:
                discount_amount = coupon.maximum_discount
            else:
                discount_amount = raw_discount
        else:
            discount_amount = min(coupon.discount_value, base_amount)

        discount_amount = discount_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        final_price = max(Decimal("0.00"), base_amount - discount_amount)

        return CouponCalculationResult(
            is_valid=True,
            discount_amount=discount_amount,
            final_price=final_price,
            coupon=coupon,
            error_message="",
        )

    @staticmethod
    @transaction.atomic
    def record_coupon_usage(
        coupon: Coupon,
        user,
        order=None,
        subscription=None,
        discount_applied: Decimal = Decimal("0.00"),
    ) -> CouponUsage | None:
        if not coupon:
            return None

        # Lock the coupon row for update
        locked_coupon = Coupon.objects.select_for_update().get(pk=coupon.pk)
        locked_coupon.used_count += 1
        locked_coupon.save(update_fields=["used_count", "updated_at"])

        if user and getattr(user, "is_authenticated", False):
            return CouponUsage.objects.create(
                coupon=locked_coupon,
                user=user,
                order=order,
                subscription=subscription,
                discount_applied=discount_applied,
            )
        return None
