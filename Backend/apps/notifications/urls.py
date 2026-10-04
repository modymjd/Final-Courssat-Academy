from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BroadcastAnnouncementView,
    NotificationViewSet,
    ParentReportSendView,
    TelegramLinkInfoView,
    TelegramWebhookView,
)

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("notifications/broadcast/", BroadcastAnnouncementView.as_view(), name="notifications-broadcast"),
    path(
        "notifications/parent-reports/send/", ParentReportSendView.as_view(), name="notifications-parent-reports-send"
    ),
    path("notifications/telegram/webhook/", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("notifications/telegram/link-info/", TelegramLinkInfoView.as_view(), name="telegram-link-info"),
    path("", include(router.urls)),
]
