from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.assessments.models import ExamKind
from apps.courses.models import Category, Course, Lesson, Module

User = get_user_model()


class ExamContextInheritanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            email="exam-context@edusmart.test",
            password="Password123!",
            first_name="Exam",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        self.category = Category.objects.create(name="علوم", slug="science")
        self.course = Course.objects.create(
            title="العلوم المتكاملة",
            category=self.category,
            instructor=self.instructor,
            status="draft",
            educational_stage="secondary",
            educational_grade="secondary_1",
            educational_track="",
            subject="integrated_sciences",
            subject_branch="",
            price=Decimal("100.00"),
        )
        self.module = Module.objects.create(course=self.course, title="الوحدة الأولى", order=1)
        self.lesson = Lesson.objects.create(module=self.module, title="الدرس الأول", order=1)

        self.client.force_authenticate(user=self.instructor)

    def test_lesson_context_infers_course_kind_and_academic_identity(self):
        response = self.client.post(
            "/api/v1/exams/",
            {
                "title": "اختبار الدرس الأول",
                "lesson": self.lesson.id,
                "questions": [
                    {
                        "text": "سؤال تجريبي",
                        "type": "MULTIPLE_CHOICE",
                        "points": 5,
                        "options": [
                            {"text": "أ", "isCorrect": True},
                            {"text": "ب", "isCorrect": False},
                        ],
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["course"], self.course.id)
        self.assertEqual(response.data["lesson"], self.lesson.id)
        self.assertEqual(response.data["kind"], ExamKind.LESSON_QUIZ)
        self.assertEqual(response.data["educational_stage"], self.course.educational_stage)
        self.assertEqual(response.data["educational_grade"], self.course.educational_grade)
        self.assertEqual(response.data["subject"], self.course.subject)

    def test_unit_context_infers_course_and_unit_exam_kind(self):
        response = self.client.post(
            "/api/v1/exams/",
            {
                "title": "امتحان الوحدة الأولى",
                "unit": self.module.id,
                "questions": [
                    {
                        "text": "سؤال تجريبي",
                        "type": "MULTIPLE_CHOICE",
                        "points": 5,
                        "options": [
                            {"text": "أ", "isCorrect": True},
                            {"text": "ب", "isCorrect": False},
                        ],
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["course"], self.course.id)
        self.assertEqual(response.data["unit"], self.module.id)
        self.assertEqual(response.data["kind"], ExamKind.UNIT_EXAM)
