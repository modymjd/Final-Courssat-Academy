from django.urls import path

from .dashboard import AdminDashboardView, InstructorDashboardView, StudentDashboardView
from .metrics_views import MetricsView
from .settings_views import PublicPlatformSettingsView
from .views import HealthView, LivenessProbeView, ReadinessProbeView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("health/liveness/", LivenessProbeView.as_view(), name="liveness-probe"),
    path("health/readiness/", ReadinessProbeView.as_view(), name="readiness-probe"),
    path("metrics/", MetricsView.as_view(), name="metrics"),
    path("settings/", PublicPlatformSettingsView.as_view(), name="public-settings"),
    path("common/settings/", PublicPlatformSettingsView.as_view(), name="common-public-settings"),
    path("dashboard/student/", StudentDashboardView.as_view(), name="dashboard-student"),
    path("dashboard/instructor/", InstructorDashboardView.as_view(), name="dashboard-instructor"),
    path("dashboard/admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
]
