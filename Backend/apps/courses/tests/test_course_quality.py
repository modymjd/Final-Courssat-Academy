from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import User, UserRole
from apps.courses.models import (
    Category,
    Course,
    CourseStatus,
    Lesson,
    LessonType,
    Module,
    Video,
    VideoStatus,
)
from apps.courses.services.course_quality import validate_course_publish_quality


def _make_user(email):
    return User.objects.create_user(
        email=email,
        password="pw12345678",
        first_name="F",
        last_name="L",
        role=UserRole.INSTRUCTOR,
    )


class CoursePublishQualityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.instructor = _make_user("quality@example.com")
        cls.category = Category.objects.create(name="Quality", slug="quality")
        cls.course = Course.objects.create(
            title="Quality Course",
            instructor=cls.instructor,
            category=cls.category,
            status=CourseStatus.DRAFT,
            price=Decimal("100.00"),
        )

    def _module(self, title="Unit 1"):
        return Module.objects.create(course=self.course, title=title, order=1)

    def test_publish_requires_curriculum(self):
        errors = validate_course_publish_quality(self.course)
        self.assertIn("curriculum", errors)

    def test_publish_rejects_empty_module(self):
        self._module()
        errors = validate_course_publish_quality(self.course)
        self.assertIn("empty_modules", errors)

    def test_publish_rejects_video_without_ready_asset(self):
        module = self._module()
        video = Video.objects.create(
            title="Pending video",
            uploader=self.instructor,
            status=VideoStatus.PENDING,
        )
        Lesson.objects.create(
            module=module,
            title="Video lesson",
            type=LessonType.VIDEO,
            order=1,
            video=video,
        )
        errors = validate_course_publish_quality(self.course)
        self.assertIn("videos", errors)

    def test_publish_rejects_article_without_content(self):
        module = self._module()
        Lesson.objects.create(
            module=module,
            title="Article lesson",
            type=LessonType.ARTICLE,
            order=1,
        )
        errors = validate_course_publish_quality(self.course)
        self.assertIn("content", errors)

    def test_publish_rejects_quiz_lesson_without_published_quiz(self):
        module = self._module()
        Lesson.objects.create(
            module=module,
            title="Quiz lesson",
            type=LessonType.QUIZ,
            order=1,
        )
        errors = validate_course_publish_quality(self.course)
        self.assertIn("assessments", errors)

    def test_ready_video_course_passes_quality_gate(self):
        module = self._module()
        video = Video.objects.create(
            title="Ready video",
            uploader=self.instructor,
            status=VideoStatus.READY,
            duration_seconds=600,
        )
        Lesson.objects.create(
            module=module,
            title="Video lesson",
            type=LessonType.VIDEO,
            order=1,
            video=video,
        )
        self.assertEqual(validate_course_publish_quality(self.course), {})
