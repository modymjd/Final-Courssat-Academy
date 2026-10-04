from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.activation_codes.quota_admin_views import (
    SuperAdminCodeQuotaContractViewSet,
    SuperAdminCodeQuotaPeriodViewSet,
)
from apps.common.settings_views import SuperAdminPlatformSettingsView, super_admin_invalidate_cdn
from apps.finance.views import (
    SuperAdminChangeRequestViewSet,
    SuperAdminCouponViewSet,
    SuperAdminPayoutViewSet,
    SuperAdminPricingViewSet,
    super_admin_mrr_stats,
)
from apps.platform_content.views import (
    SuperAdminAboutView,
    SuperAdminPartnershipViewSet,
    SuperAdminTeamMemberViewSet,
)

from .overview_views import super_admin_overview
from .super_admin_views import AuditLogViewSet, super_admin_session_check, super_admin_verify_2fa
from .user_management_views import SuperAdminUserViewSet

router = DefaultRouter()
router.register("audit-logs", AuditLogViewSet, basename="super-admin-audit-logs")
router.register("users", SuperAdminUserViewSet, basename="super-admin-users")
router.register("content/about/team-members", SuperAdminTeamMemberViewSet, basename="super-admin-about-team-members")
router.register("content/about/partnerships", SuperAdminPartnershipViewSet, basename="super-admin-about-partnerships")
router.register("pricing", SuperAdminPricingViewSet, basename="super-admin-pricing-direct")
router.register("coupons", SuperAdminCouponViewSet, basename="super-admin-coupons-direct")
router.register("payouts", SuperAdminPayoutViewSet, basename="super-admin-payouts-direct")
router.register("change-requests", SuperAdminChangeRequestViewSet, basename="super-admin-change-requests-direct")
router.register("quota-contracts", SuperAdminCodeQuotaContractViewSet, basename="super-admin-quota-contracts")
router.register("quota-periods", SuperAdminCodeQuotaPeriodViewSet, basename="super-admin-quota-periods")
router.register("finance/pricing", SuperAdminPricingViewSet, basename="super-admin-finance-pricing")
router.register("finance/coupons", SuperAdminCouponViewSet, basename="super-admin-finance-coupons")
router.register("finance/payouts", SuperAdminPayoutViewSet, basename="super-admin-finance-payouts")
router.register(
    "finance/change-requests", SuperAdminChangeRequestViewSet, basename="super-admin-finance-change-requests"
)

urlpatterns = [
    path("auth/verify-2fa/", super_admin_verify_2fa, name="super-admin-verify-2fa"),
    path("auth/session/", super_admin_session_check, name="super-admin-session"),
    path("overview/", super_admin_overview, name="super-admin-overview"),
    path("mrr-stats/", super_admin_mrr_stats, name="super-admin-mrr-stats-direct"),
    path("finance/mrr-stats/", super_admin_mrr_stats, name="super-admin-finance-mrr-stats"),
    path("settings/", SuperAdminPlatformSettingsView.as_view(), name="super-admin-settings"),
    path("settings/invalidate-cdn/", super_admin_invalidate_cdn, name="super-admin-invalidate-cdn"),
    path("content/about/", SuperAdminAboutView.as_view(), name="super-admin-about-content"),
    path("", include(router.urls)),
]
