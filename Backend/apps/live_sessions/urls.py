from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LiveSessionViewSet

router = DefaultRouter()
router.register("live-sessions", LiveSessionViewSet, basename="live-session")

urlpatterns = [path("", include(router.urls))]
