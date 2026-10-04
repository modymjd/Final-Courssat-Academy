from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .academic_pricing_views import (
    AcademicPricingCalculateView,
    AcademicQuotationApproveView,
    AcademicQuotationCreateView,
    AcademicQuotationListView,
)
from .instructor_earnings_views import InstructorAuthoritativeEarningsView
from .views import (
    CenterQuotaSummaryView,
    CheckoutView,
    CouponValidateView,
    CustomPlanCheckoutView,
    CustomPlanQuoteView,
    GatewayStatusView,
    InstructorCouponViewSet,
    KashierCheckoutSessionView,
    OrderViewSet,
    PayoutRequestViewSet,
    PricingPlanListView,
    SubscriptionCheckoutView,
    SuperAdminChangeRequestViewSet,
    SuperAdminCouponViewSet,
    SuperAdminGatewayConfigView,
    SuperAdminPayoutViewSet,
    SuperAdminPricingViewSet,
    WalletViewSet,
    fawry_webhook_view,
    kashier_callback_view,
    kashier_order_status_view,
    kashier_webhook_view,
    payment_webhook,
    super_admin_mrr_stats,
)
from .wallet_api import SecureWalletTopUpView

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="user-orders")
router.register("wallets", WalletViewSet, basename="user-wallets")
router.register("payouts", PayoutRequestViewSet, basename="user-payouts")
router.register("instructor/coupons", InstructorCouponViewSet, basename="instructor-coupons")

router.register("super-admin/pricing", SuperAdminPricingViewSet, basename="super-admin-pricing")
router.register("super-admin/coupons", SuperAdminCouponViewSet, basename="super-admin-coupons")
router.register("super-admin/payouts", SuperAdminPayoutViewSet, basename="super-admin-payouts")
router.register("super-admin/change-requests", SuperAdminChangeRequestViewSet, basename="super-admin-change-requests")

urlpatterns = [
    # Academic Dynamic Pricing & WhatsApp Support Invoicing
    path("academic-pricing/calculate/", AcademicPricingCalculateView.as_view(), name="academic-pricing-calculate"),
    path(
        "academic-pricing/create-quotation/",
        AcademicQuotationCreateView.as_view(),
        name="academic-pricing-create-quotation",
    ),
    path("academic-pricing/quotations/", AcademicQuotationListView.as_view(), name="academic-pricing-quotations-list"),
    path(
        "academic-pricing/quotations/<int:pk>/approve/",
        AcademicQuotationApproveView.as_view(),
        name="academic-pricing-quotations-approve",
    ),
    # Canonical Kashier payment flow.
    path("gateway-status/", GatewayStatusView.as_view(), name="gateway-status"),
    path("super-admin/gateway-config/", SuperAdminGatewayConfigView.as_view(), name="super-admin-gateway-config"),
    path("checkout/session/", KashierCheckoutSessionView.as_view(), name="kashier-checkout-session"),
    path("webhooks/kashier/", kashier_webhook_view, name="kashier-webhook"),
    path("kashier/callback/", kashier_callback_view, name="kashier-callback"),
    path("checkout/status/<str:merchant_order_id>/", kashier_order_status_view, name="kashier-order-status"),
    # Checkout and payment flows
    path("checkout/", CheckoutView.as_view(), name="finance-checkout"),
    path("webhook/", payment_webhook, name="finance-webhook"),
    # Pricing and subscription flows.
    path("pricing/", PricingPlanListView.as_view(), name="pricing-plans-list"),
    path("custom-plan/quote/", CustomPlanQuoteView.as_view(), name="custom-plan-quote"),
    path("custom-plan/checkout/", CustomPlanCheckoutView.as_view(), name="custom-plan-checkout"),
    path("center/quotas/", CenterQuotaSummaryView.as_view(), name="center-quotas-summary"),
    path("coupons/validate/", CouponValidateView.as_view(), name="coupon-validate"),
    path("subscriptions/checkout/", SubscriptionCheckoutView.as_view(), name="subscription-checkout"),
    path("webhooks/fawry/", fawry_webhook_view, name="fawry-webhook"),
    path("instructor/earnings/", InstructorAuthoritativeEarningsView.as_view(), name="instructor-earnings"),
    path("instructor-earnings/", InstructorAuthoritativeEarningsView.as_view(), name="finance-instructor-earnings"),
    path("super-admin/mrr-stats/", super_admin_mrr_stats, name="super-admin-mrr-stats"),
    # Must precede router.urls so the legacy direct-credit action is unreachable over HTTP.
    path("wallets/top-up/", SecureWalletTopUpView.as_view(), name="wallet-top-up-secure"),
    path("", include(router.urls)),
]
