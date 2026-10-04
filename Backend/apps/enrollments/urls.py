from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EnrollmentViewSet, StudentNoteViewSet

router = DefaultRouter()
router.register("enrollments", EnrollmentViewSet, basename="enrollment")
router.register("notes", StudentNoteViewSet, basename="student-note")

urlpatterns = [path("", include(router.urls))]
