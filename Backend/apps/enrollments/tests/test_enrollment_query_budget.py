from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollments.models import Enrollment, LessonCompletion


class EnrollmentQueryBudgetTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.student = User.objects.create_user(
            email="nplus1-student@example.com",
            password="pw12345678",
            role="student",
            first_name="NPlus",
            last_name="One",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.student)
        self.category = Category.objects.create(name="N+1 Category", slug="n-plus-one-category")

    def _create_enrollment(self, index: int) -> Enrollment:
        instructor = get_user_model().objects.create_user(
            email=f"nplus1-instructor-{index}@example.com",
            password="pw12345678",
            role="instructor",
            first_name="Instructor",
            last_name=str(index),
        )
        course = Course.objects.create(
            title=f"N+1 Course {index}",
            instructor=instructor,
            category=self.category,
            status="published",
        )
        module = Module.objects.create(course=course, title="Unit", order=1)
        lesson = Lesson.objects.create(module=module, title="Lesson", order=1, type="article")
        enrollment = Enrollment.objects.create(student=self.student, course=course)
        LessonCompletion.objects.create(enrollment=enrollment, lesson=lesson)
        return enrollment

    def _request_query_count(self):
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get("/api/v1/enrollments/")
        self.assertEqual(response.status_code, 200, response.data)
        return len(captured)

    def test_enrollment_list_query_count_does_not_grow_per_enrollment(self):
        self._create_enrollment(1)
        one_query_count = self._request_query_count()

        self._create_enrollment(2)
        self._create_enrollment(3)
        three_query_count = self._request_query_count()

        # Adding two enrollments may change pagination/count work, but must not
        # add a query for every enrollment's progress/curriculum/certificate.
        self.assertLessEqual(
            three_query_count,
            one_query_count + 3,
            msg=f"Enrollment list regressed to per-row queries: {one_query_count} -> {three_query_count}",
        )
