from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.finance.models import (
    Coupon,
    PricingChangeRequest,
    PricingPlan,
    Subscription,
)
from apps.finance.services import MakerCheckerService

User = get_user_model()


@pytest.mark.django_db
class TestPricingAndSubscriptions:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="student_sub@edusmart.com",
            password="Password123!",
            first_name="Ahmed",
            last_name="Ali",
        )
        self.admin1 = User.objects.create_superuser(
            email="admin1_sub@edusmart.com",
            password="Password123!",
        )
        self.admin2 = User.objects.create_superuser(
            email="admin2_sub@edusmart.com",
            password="Password123!",
        )
        self.plan = PricingPlan.objects.create(
            name="الخطة الاحترافية",
            slug="pro-sub",
            price_monthly=Decimal("399.00"),
            price_yearly=Decimal("3830.00"),
            currency="EGP",
            is_featured=True,
            is_active=True,
        )

    def test_pricing_plans_list_public(self):
        url = reverse("v1:pricing-plans-list")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        if isinstance(res.data, dict) and "data" in res.data:
            results = res.data["data"]
        elif isinstance(res.data, dict) and "results" in res.data:
            results = res.data["results"]
        elif isinstance(res.data, list):
            results = res.data
        else:
            results = [res.data]
        assert len(results) >= 1

    def test_coupon_validation_success(self):
        self.client.force_authenticate(user=self.user)
        Coupon.objects.create(
            code="EDUSMART20",
            discount_type=Coupon.DiscountType.PERCENT,
            discount_value=Decimal("20.00"),
            is_active=True,
        )
        url = reverse("v1:coupon-validate")
        payload = {
            "code": "EDUSMART20",
            "plan_id": self.plan.id,
            "billing_cycle": "monthly",
        }
        res = self.client.post(url, payload)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["valid"] is True
        assert Decimal(res.data["discount_amount"]) == Decimal("79.80")
        assert Decimal(res.data["final_price"]) == Decimal("319.20")

    def test_subscription_checkout_idempotency_and_snapshot(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("v1:subscription-checkout")
        payload = {
            "plan_id": self.plan.id,
            "billing_cycle": "monthly",
            "payment_gateway": "kashier",
        }

        headers = {"HTTP_IDEMPOTENCY_KEY": "test-uuid-key-12345"}
        res1 = self.client.post(url, payload, **headers)
        assert res1.status_code == status.HTTP_201_CREATED
        assert "checkout_url" in res1.data

        # Check Subscription Price Snapshot created
        sub = Subscription.objects.get(pk=res1.data["subscription_id"])
        assert sub.price_at_subscription == Decimal("399.00")
        assert sub.currency_at_subscription == "EGP"

        # Repeat request with same idempotency key -> returns cached response
        res2 = self.client.post(url, payload, **headers)
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data["subscription_id"] == res1.data["subscription_id"]

    def test_maker_checker_workflow(self):
        # Admin 1 submits change request
        change_req = MakerCheckerService.submit_change_request(
            target_model="PricingPlan",
            target_id=self.plan.id,
            old_val={"price_monthly": "399.00"},
            new_val={"price_monthly": "499.00"},
            user=self.admin1,
        )
        assert change_req.status == PricingChangeRequest.Status.PENDING

        # Admin 1 tries self-approval -> raises ValueError
        with pytest.raises(ValueError, match="Cannot approve your own change request"):
            MakerCheckerService.approve_change_request(change_req.id, self.admin1)

        # Admin 2 approves -> Success
        approved_req = MakerCheckerService.approve_change_request(change_req.id, self.admin2)
        assert approved_req.status == PricingChangeRequest.Status.APPROVED
        self.plan.refresh_from_db()
        assert self.plan.price_monthly == Decimal("499.00")

    def test_pay_with_balance_with_coupon(self):
        from apps.courses.models import Course, Category
        from apps.finance.services import get_student_wallet
        from apps.enrollments.models import Enrollment

        category = Category.objects.create(name="لغات", slug="languages")
        course = Course.objects.create(
            title="دورة اللغة الإنجليزية المكثفة",
            instructor=self.admin1,
            category=category,
            price=Decimal("300.00"),
            status="published",
        )
        Coupon.objects.create(
            code="DISCOUNT50",
            discount_type=Coupon.DiscountType.FIXED,
            discount_value=Decimal("50.00"),
            is_active=True,
        )

        wallet = get_student_wallet(self.user)
        wallet.available_balance = Decimal("400.00")
        wallet.current_balance = Decimal("400.00")
        wallet.save(update_fields=["available_balance", "current_balance"])

        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            "/api/v1/finance/orders/pay-with-balance/",
            {"course_id": course.id, "coupon_code": "DISCOUNT50"},
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "paid_with_balance"
        assert res.data["enrolled"] is True
        assert Decimal(res.data["remaining_balance"]) == Decimal("150.00")
        assert Enrollment.objects.filter(student=self.user, course=course).exists()

