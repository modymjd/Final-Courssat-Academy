from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.assessments.models import Exam, StudentExam
from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollments.models import Enrollment


class ProgressionQueryTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create(email="inst@test.com", role="instructor")
        self.instructor.set_password("pass")
        self.instructor.save()

        self.student = User.objects.create(email="stu@test.com", role="student")
        self.student.set_password("pass")
        self.student.save()

        self.category = Category.objects.create(name="CatTest", slug="cattest")
        self.course = Course.objects.create(
            title="Performance Course",
            instructor=self.instructor,
            category=self.category,
            status="published",
            enforce_quiz_gate=True
        )

        Enrollment.objects.create(student=self.student, course=self.course)

        for m in range(3):
            mod = Module.objects.create(course=self.course, title=f"Mod {m}", order=m)
            unit_exam = Exam.objects.create(title=f"Unit {m}", unit=mod, is_published=True)
            StudentExam.objects.create(student=self.student, exam=unit_exam, is_passed=True, score=90)
            for lesson_idx in range(10):
                lesson = Lesson.objects.create(module=mod, title=f"Less {m}-{lesson_idx}", order=lesson_idx)
                quiz = Exam.objects.create(title=f"Quiz {m}-{lesson_idx}", lesson=lesson, is_published=True)
                StudentExam.objects.create(student=self.student, exam=quiz, is_passed=True, score=100)

    def test_course_detail_constant_queries(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:course-detail", kwargs={"pk": self.course.id})

        # Use CaptureQueriesContext to assert a small upper bound independently of N
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(url)

        self.assertLessEqual(len(ctx.captured_queries), 12, "Should take O(1) queries regardless of course size")
        self.assertEqual(response.status_code, 200)

        # Verify the structure contains unit_exams and quiz
        data = response.json()
        self.assertEqual(len(data["modules"]), 3)
        self.assertEqual(len(data["modules"][0]["lessons"]), 10)

        lesson_data = data["modules"][0]["lessons"][0]
        quiz = lesson_data.get("quiz")
        self.assertIsNotNone(quiz)
        is_passed = quiz.get("isPassed") if "isPassed" in quiz else quiz.get("is_passed")
        self.assertEqual(is_passed, True)

        module_data = data["modules"][0]
        unit_exams = module_data.get("unitExams") if "unitExams" in module_data else module_data.get("unit_exams")
        self.assertIsNotNone(unit_exams)
        unit_is_passed = unit_exams[0].get("isPassed") if "isPassed" in unit_exams[0] else unit_exams[0].get("is_passed")
        self.assertEqual(unit_is_passed, True)

