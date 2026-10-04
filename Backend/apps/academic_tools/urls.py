from rest_framework.routers import DefaultRouter

from apps.academic_tools.views import AcademicTaskViewSet

router = DefaultRouter()
router.register(r"academic-tools/tasks", AcademicTaskViewSet, basename="academic-task")

urlpatterns = router.urls
