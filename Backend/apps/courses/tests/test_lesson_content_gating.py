from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.courses.models import Category, Course, CourseStatus, Lesson, Module
from apps.enrollments.models import Enrollment

SECRET_URL = "https://cdn.example.com/paid.m3u8"
SECRET_TEXT = "hidden article body"


def _make_user(email, role):
    return User.objects.create_user(
        email=email,
        password="pw12345678",
        first_name="F",
        last_name="L",
        role=role,
    )


class LessonContentGatingTests(APITestCase):
    """video_url/content must only leak to: enrolled student, owning instructor, admin, or free lesson."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = _make_user("owner@example.com", UserRole.INSTRUCTOR)
        cls.other_instructor = _make_user("other@example.com", UserRole.INSTRUCTOR)
        cls.enrolled = _make_user("enrolled@example.com", UserRole.STUDENT)
        cls.outsider = _make_user("outsider@example.com", UserRole.STUDENT)
        cls.admin = _make_user("admin@example.com", UserRole.ADMIN)

        cls.category = Category.objects.create(name="Cat", slug="cat")
        cls.course = Course.objects.create(
            title="C",
            instructor=cls.owner,
            category=cls.category,
            status=CourseStatus.PUBLISHED,
        )
        cls.module = Module.objects.create(course=cls.course, title="M", order=1)
        cls.paid_lesson = Lesson.objects.create(
            module=cls.module,
            title="Paid",
            order=1,
            is_free=False,
            video_url=SECRET_URL,
            content=SECRET_TEXT,
        )
        cls.free_lesson = Lesson.objects.create(
            module=cls.module,
            title="Free",
            order=2,
            is_free=True,
            video_url="https://cdn.example.com/free.m3u8",
            content="free body",
        )
        Enrollment.objects.create(student=cls.enrolled, course=cls.course)

    def _get_course(self):
        return self.client.get(reverse("v1:course-detail", kwargs={"pk": self.course.pk}))

    def _lesson_by_id(self, payload, lesson_id):
        for module in payload["modules"]:
            for lesson in module["lessons"]:
                if lesson["id"] == lesson_id:
                    return lesson
        raise AssertionError(f"lesson {lesson_id} not in response")

    def test_anonymous_gets_empty_paid_content(self):
        res = self._get_course()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        paid = self._lesson_by_id(res.json(), self.paid_lesson.pk)
        self.assertEqual(paid["videoUrl"], "")
        self.assertEqual(paid["content"], "")

    def test_anonymous_still_sees_free_lesson_content(self):
        res = self._get_course()
        free = self._lesson_by_id(res.json(), self.free_lesson.pk)
        self.assertNotEqual(free["videoUrl"], "")

    def test_non_enrolled_student_gets_empty_paid_content(self):
        self.client.force_authenticate(self.outsider)
        paid = self._lesson_by_id(self._get_course().json(), self.paid_lesson.pk)
        self.assertEqual(paid["videoUrl"], "")
        self.assertEqual(paid["content"], "")

    def test_enrolled_student_sees_paid_content(self):
        self.client.force_authenticate(self.enrolled)
        paid = self._lesson_by_id(self._get_course().json(), self.paid_lesson.pk)
        self.assertEqual(paid["videoUrl"], SECRET_URL)
        self.assertEqual(paid["content"], SECRET_TEXT)

    def test_owning_instructor_sees_paid_content(self):
        self.client.force_authenticate(self.owner)
        paid = self._lesson_by_id(self._get_course().json(), self.paid_lesson.pk)
        self.assertEqual(paid["videoUrl"], SECRET_URL)

    def test_other_instructor_does_not_see_paid_content(self):
        self.client.force_authenticate(self.other_instructor)
        paid = self._lesson_by_id(self._get_course().json(), self.paid_lesson.pk)
        self.assertEqual(paid["videoUrl"], "")
        self.assertEqual(paid["content"], "")

    def test_admin_sees_paid_content(self):
        self.client.force_authenticate(self.admin)
        paid = self._lesson_by_id(self._get_course().json(), self.paid_lesson.pk)
        self.assertEqual(paid["videoUrl"], SECRET_URL)
