from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.courses.models import Category, Course, CourseStatus, Lesson, Module


def _make_user(email, role):
    return User.objects.create_user(
        email=email,
        password="pw12345678",
        first_name="F",
        last_name="L",
        role=role,
    )


class CourseOwnershipTests(APITestCase):
    """A non-owner instructor must not be able to mutate another instructor's course."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = _make_user("owner@example.com", UserRole.INSTRUCTOR)
        cls.other = _make_user("other@example.com", UserRole.INSTRUCTOR)
        cls.admin = _make_user("admin@example.com", UserRole.ADMIN)
        cls.category = Category.objects.create(name="Cat", slug="cat")
        cls.course = Course.objects.create(
            title="Owned",
            instructor=cls.owner,
            category=cls.category,
            status=CourseStatus.PUBLISHED,
        )
        cls.module = Module.objects.create(course=cls.course, title="M1", order=1)
        cls.lesson = Lesson.objects.create(module=cls.module, title="L1", order=1)

    def _url(self, name, **kwargs):
        return reverse(f"v1:{name}", kwargs=kwargs)

    # ---------------- Course ----------------

    def test_other_instructor_cannot_patch_course(self):
        self.client.force_authenticate(self.other)
        res = self.client.patch(
            self._url("course-detail", pk=self.course.pk),
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.course.refresh_from_db()
        self.assertEqual(self.course.title, "Owned")

    def test_other_instructor_cannot_delete_course(self):
        self.client.force_authenticate(self.other)
        res = self.client.delete(self._url("course-detail", pk=self.course.pk))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Course.objects.filter(pk=self.course.pk).exists())

    def test_owner_can_patch_course(self):
        self.client.force_authenticate(self.owner)
        res = self.client.patch(
            self._url("course-detail", pk=self.course.pk),
            {"title": "Renamed"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.title, "Renamed")

    def test_admin_can_patch_any_course(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            self._url("course-detail", pk=self.course.pk),
            {"title": "AdminEdit"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # ---------------- Module ----------------

    def test_other_instructor_cannot_patch_module(self):
        self.client.force_authenticate(self.other)
        res = self.client.patch(
            self._url("module-detail", pk=self.module.pk),
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_other_instructor_cannot_delete_foreign_module_or_leak_existence(self):
        self.client.force_authenticate(self.other)
        res = self.client.delete(self._url("module-detail", pk=self.module.pk))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Module.objects.filter(pk=self.module.pk).exists())

    def test_other_instructor_cannot_create_module_on_foreign_course(self):
        """WriteSerializer must reject a Module create pointing at a foreign course."""
        self.client.force_authenticate(self.other)
        res = self.client.post(
            self._url("module-list"),
            {"course": self.course.pk, "title": "Sneaky", "order": 99},
            format="json",
        )
        # Either 400 (serializer validation) or 403 — both prove the attack failed.
        self.assertIn(res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))
        self.assertFalse(Module.objects.filter(title="Sneaky").exists())

    # ---------------- Lesson ----------------

    def test_other_instructor_cannot_patch_lesson(self):
        self.client.force_authenticate(self.other)
        res = self.client.patch(
            self._url("lesson-detail", pk=self.lesson.pk),
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_other_instructor_cannot_delete_foreign_lesson_or_leak_existence(self):
        self.client.force_authenticate(self.other)
        res = self.client.delete(self._url("lesson-detail", pk=self.lesson.pk))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.pk).exists())

    def test_other_instructor_cannot_create_lesson_on_foreign_module(self):
        self.client.force_authenticate(self.other)
        res = self.client.post(
            self._url("lesson-list"),
            {"module": self.module.pk, "title": "Sneaky", "order": 99},
            format="json",
        )
        self.assertIn(res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))
        self.assertFalse(Lesson.objects.filter(title="Sneaky").exists())

    def test_student_cannot_hit_write_endpoints(self):
        student = _make_user("student@example.com", UserRole.STUDENT)
        self.client.force_authenticate(student)
        res = self.client.patch(
            self._url("course-detail", pk=self.course.pk),
            {"title": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
