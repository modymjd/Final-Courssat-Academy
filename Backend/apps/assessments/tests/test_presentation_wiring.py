import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.assessments.models import Exam, ExamKind, ExamType, QuestionBankItem, StudentExam, StudentExamStatus
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment

User = get_user_model()


class PresentationWiringTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.instructor = User.objects.create_user(
            email="inst_wire@test.com", password="Password123!", role=UserRole.INSTRUCTOR
        )
        self.student = User.objects.create_user(
            email="stud_wire@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.category = Category.objects.create(name="Chemistry", slug="chem")
        self.course = Course.objects.create(
            title="Chemistry 101",
            instructor=self.instructor,
            category=self.category,
            status="published",
            price=Decimal("0.00"),
        )
        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course)

        self.exam = Exam.objects.create(
            course=self.course,
            title="Periodic Table Exam",
            kind=ExamKind.LESSON_QUIZ,
            exam_type=ExamType.EXAM,
            pass_threshold=70,
            duration_minutes=30,
            is_published=True,
        )

        self.q1 = QuestionBankItem.objects.create(
            instructor=self.instructor,
            exam=self.exam,
            question_text="What is the symbol for Gold?",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["Au", "Ag", "Fe", "Cu"],
            correct_answer_json={"value": "Au"},
            points=Decimal("10.00"),
            video_timestamp_start=45,
            video_timestamp_end=90,
        )

    def test_question_import_endpoints(self):
        self.client.force_authenticate(user=self.instructor)

        # 1. Template
        res_tmpl = self.client.get("/api/v1/assessments/questions/template/")
        self.assertEqual(res_tmpl.status_code, status.HTTP_200_OK)
        self.assertTrue(isinstance(res_tmpl.data, list))
        self.assertTrue(len(res_tmpl.data) > 0)

        # 2. Dry Run
        sample_questions = [
            {
                "question_text": "ما هو الرمز الكيميائي للماء؟",
                "question_type": "MULTIPLE_CHOICE",
                "options": ["H2O", "CO2", "NaCl"],
                "correct_answer": "H2O",
                "points": 5,
            }
        ]
        res_dry = self.client.post(
            "/api/v1/assessments/questions/import/dry-run/",
            sample_questions,
            format="json",
        )
        self.assertEqual(res_dry.status_code, status.HTTP_200_OK)
        self.assertTrue(res_dry.data["is_valid"])
        self.assertEqual(res_dry.data["valid_count"], 1)

        # The production frontend sends the same questions inside a JSON envelope.
        res_wrapped = self.client.post(
            "/api/v1/assessments/questions/import/dry-run/",
            {"questions": sample_questions},
            format="json",
        )
        self.assertEqual(res_wrapped.status_code, status.HTTP_200_OK)
        self.assertTrue(res_wrapped.data["is_valid"])
        self.assertEqual(res_wrapped.data["valid_count"], 1)

        # 3. Commit Import
        res_import = self.client.post(
            f"/api/v1/assessments/questions/import/?exam_id={self.exam.id}",
            sample_questions,
            format="json",
        )
        self.assertEqual(res_import.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_import.data["imported_count"], 1)

    def test_exam_start_and_submit_actions(self):
        self.client.force_authenticate(user=self.student)

        # 1. Start Exam
        res_start = self.client.post(
            f"/api/v1/assessments/exams/{self.exam.id}/start/",
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="client-idem-1234",
        )
        self.assertIn(res_start.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertIn("attempt", res_start.data)

        # 2. Submit Exam (Wrong answer -> Failed)
        res_submit = self.client.post(
            f"/api/v1/assessments/exams/{self.exam.id}/submit/",
            {
                "answers": [{"question_id": self.q1.id, "answer": "Fe"}],
                "tab_switches_count": 1,
            },
            format="json",
        )
        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        self.assertFalse(res_submit.data["isPassed"])

        # 3. CRITICAL SECURITY: Verify correct_answer is None for failed student
        answers = res_submit.data["answers"]
        self.assertEqual(len(answers), 1)
        self.assertIsNone(answers[0]["correct_answer"])
        self.assertIsNone(answers[0]["correctAnswer"])
        self.assertEqual(answers[0]["explanation"], "")
        self.assertIsNotNone(answers[0]["video_review_timestamps"])

    def test_request_override_action(self):
        # Student has an attempt with lockout
        attempt = StudentExam.objects.create(
            student=self.student,
            exam=self.exam,
            attempt_number=3,
            is_passed=False,
            status=StudentExamStatus.GRADED,
        )

        # Instructor grants override
        self.client.force_authenticate(user=self.instructor)
        res = self.client.post(
            f"/api/v1/assessments/exams/{self.exam.id}/request-override/",
            {
                "student_id": self.student.id,
                "reason": "عطل فني في جهاز الطالب أثناء الاختبار",
                "attempts_granted": 2,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "success")
