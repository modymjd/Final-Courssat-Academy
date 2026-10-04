from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.activation_codes.quota_api_views import ActivationCodeQuotaStatusView
from apps.activation_codes.views import (
    ActivationCodeBatchViewSet,
    ActivationCodeItemViewSet,
    ActivationCodeViewSet,
    CenterQuotaRequestViewSet,
)

router = DefaultRouter()
router.register(r"batches", ActivationCodeBatchViewSet, basename="activation-code-batch")
router.register(r"codes", ActivationCodeItemViewSet, basename="activation-code-item")
router.register(r"quota-requests", CenterQuotaRequestViewSet, basename="center-quota-request")

urlpatterns = [
    path("quota/status/", ActivationCodeQuotaStatusView.as_view(), name="activation-code-quota-status"),
    path("validate/", ActivationCodeViewSet.as_view({"post": "validate"}), name="activation-code-validate"),
    path("redeem/", ActivationCodeViewSet.as_view({"post": "redeem"}), name="activation-code-redeem"),
    path("", include(router.urls)),
]
