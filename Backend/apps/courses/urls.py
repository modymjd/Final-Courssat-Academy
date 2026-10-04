from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .curriculum_api import CourseCurriculumSyncView
from .reorder_api import LessonReorderView, ModuleReorderView
from .views import (
    CategoryViewSet,
    CourseImageUploadView,
    CourseViewSet,
    DirectVideoUploadSignatureView,
    LessonSummaryViewSet,
    LessonViewSet,
    ModuleViewSet,
    SignedStreamURLView,
    VideoViewSet,
)
from .watermark_views import StudentFileConsentView, WatermarkDownloadView

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("courses", CourseViewSet, basename="course")
router.register("modules", ModuleViewSet, basename="module")
router.register("lessons", LessonViewSet, basename="lesson")
router.register("videos", VideoViewSet, basename="video")
router.register("summaries", LessonSummaryViewSet, basename="summary")

urlpatterns = [
    path("upload-image/", CourseImageUploadView.as_view(), name="course-image-upload"),
    path("courses/upload-image/", CourseImageUploadView.as_view(), name="course-image-upload-alias"),
    path(
        "courses/<int:course_id>/curriculum/",
        CourseCurriculumSyncView.as_view(),
        name="course-curriculum-sync",
    ),
    path("modules/<int:module_id>/reorder/", ModuleReorderView.as_view(), name="module-reorder"),
    path("lessons/<int:lesson_id>/reorder/", LessonReorderView.as_view(), name="lesson-reorder"),
    path("lessons/<int:lesson_id>/signed-stream-url/", SignedStreamURLView.as_view(), name="lesson-signed-stream-url"),
    path("lessons/<int:lesson_id>/watermarked-pdf/", WatermarkDownloadView.as_view(), name="lesson-watermarked-pdf"),
    path("courses/lessons/<int:lesson_id>/watermarked-pdf/", WatermarkDownloadView.as_view(), name="courses-lesson-watermarked-pdf"),
    path("student-file-consent/", StudentFileConsentView.as_view(), name="student-file-consent"),
    path("courses/student-file-consent/", StudentFileConsentView.as_view(), name="courses-student-file-consent"),
    path("student-file-consent/status/", StudentFileConsentView.as_view(), name="student-file-consent-status"),
    path("courses/student-file-consent/status/", StudentFileConsentView.as_view(), name="courses-student-file-consent-status"),
    path("instructor/video/upload-url/", DirectVideoUploadSignatureView.as_view(), name="instructor-video-upload-url"),
    path("", include(router.urls)),
]
