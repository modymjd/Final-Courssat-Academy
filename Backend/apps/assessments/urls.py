from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .import_views import (
    QuestionImportCommitView,
    QuestionImportDryRunView,
    QuestionImportTemplateView,
    QuestionImageUploadView,
)
from .views import AssignmentViewSet, ExamViewSet, GradeViewSet, QuestionBankViewSet

router = DefaultRouter()
router.register("assignments", AssignmentViewSet, basename="assignment")
router.register("grades", GradeViewSet, basename="grade")
router.register("exams", ExamViewSet, basename="exam")
router.register("question-bank", QuestionBankViewSet, basename="question-bank")

urlpatterns = [
    path("questions/upload-image/", QuestionImageUploadView.as_view(), name="question-image-upload"),
    path("questions/import/dry-run/", QuestionImportDryRunView.as_view(), name="question-import-dry-run"),
    path("questions/import/", QuestionImportCommitView.as_view(), name="question-import-commit"),
    path("questions/template/", QuestionImportTemplateView.as_view(), name="question-import-template"),
    path("", include(router.urls)),
]
