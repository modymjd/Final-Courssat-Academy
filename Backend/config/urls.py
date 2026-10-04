from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("accounts/", include("apps.accounts.urls")),
    path("super-admin/", include("apps.accounts.super_admin_urls")),
    path("", include("apps.courses.urls")),
    path("", include("apps.enrollments.urls")),
    path("", include("apps.assessments.urls")),
    path("assessments/", include("apps.assessments.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.messaging.urls")),
    path("", include("apps.live_sessions.urls")),
    path("", include("apps.calendar_events.urls")),
    path("", include("apps.certificates.urls")),
    path("", include("apps.common.urls")),
    path("", include("apps.platform_content.urls")),
    path("finance/", include("apps.finance.urls")),
    path("analytics/", include("apps.analytics.urls")),
    path("", include("apps.academic_tools.urls")),
    path("activation-codes/", include("apps.activation_codes.urls")),
]


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Serve HLS video segments at /hls/ in development (matches signed_url paths)
    urlpatterns += static("/hls/", document_root=str(settings.MEDIA_ROOT / "hls"))
