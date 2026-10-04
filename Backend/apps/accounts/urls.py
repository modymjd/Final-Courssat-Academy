from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .admin_views import AdminApprovalListView, AdminApprovalView, SuperAdminCenterGovernanceView
from .center_dashboard_views import CenterOverviewView, CenterReportsView, CenterSettingsView
from .center_instructor_views import (
    CenterInstructorDetailView,
    CenterInstructorLinkExistingView,
    CenterInstructorListView,
    CenterInstructorProvisionNewView,
)
from .guardian_dashboard_views import GuardianDashboardView
from .student_management_views import CenterStudentListView, InstructorPrivateStudentListView
from .views import (
    AdminFeatureControlView,
    AdminUserViewSet,
    ChangePasswordView,
    CompleteProfileView,
    GoogleAuthView,
    InstructorPublicViewSet,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
    UserAvatarUploadView,
    UserEntitlementsView,
)

router = DefaultRouter()
router.register("admin/users", AdminUserViewSet, basename="admin-users")
router.register("instructors", InstructorPublicViewSet, basename="public-instructors")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("google/", GoogleAuthView.as_view(), name="auth-google"),
    path("complete-profile/", CompleteProfileView.as_view(), name="auth-complete-profile"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("me/avatar/", UserAvatarUploadView.as_view(), name="user-avatar-upload"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("entitlements/", UserEntitlementsView.as_view(), name="auth-entitlements"),
    path("guardian/dashboard/", GuardianDashboardView.as_view(), name="guardian-dashboard"),
    path("admin/feature-control/", AdminFeatureControlView.as_view(), name="admin-feature-control"),
    path("admin/approvals/", AdminApprovalListView.as_view(), name="admin-approvals-list"),
    path("admin/approvals/<str:model_type>/<int:obj_id>/", AdminApprovalView.as_view(), name="admin-approvals"),
    path("admin/centers/", SuperAdminCenterGovernanceView.as_view(), name="admin-centers-list"),
    path(
        "admin/centers/<int:center_id>/override-quota/",
        SuperAdminCenterGovernanceView.as_view(),
        name="admin-centers-override-quota",
    ),
    path("center/overview/", CenterOverviewView.as_view(), name="center-overview"),
    path("center/reports/", CenterReportsView.as_view(), name="center-reports"),
    path("center/settings/", CenterSettingsView.as_view(), name="center-settings"),
    path("center/students/", CenterStudentListView.as_view(), name="center-students-list"),
    path("center/instructors/", CenterInstructorListView.as_view(), name="center-instructors-list"),
    path("center/instructors/link/", CenterInstructorLinkExistingView.as_view(), name="center-instructors-link"),
    path(
        "center/instructors/create-and-link/",
        CenterInstructorProvisionNewView.as_view(),
        name="center-instructors-create-and-link",
    ),
    path("center/instructors/<int:pk>/", CenterInstructorDetailView.as_view(), name="center-instructors-detail"),
    path(
        "instructor/private-students/",
        InstructorPrivateStudentListView.as_view(),
        name="instructor-private-students-list",
    ),
    path("", include(router.urls)),
]
