from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.assessments.models import Exam, QuestionBankItem, StudentExam, StudentExamStatus
from apps.courses.models import Category, Course

User = get_user_model()


class ServerSideGradingSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Computer Science", slug="cs")
        self.instructor = User.objects.create_user(
            email="instructor@edusmart.test",
            password="Password123!",
            first_name="Instructor",
            last_name="Test",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="student@edusmart.test",
            password="Password123!",
            first_name="Student",
            last_name="Test",
            role="student",
            profile_completed=True,
        )
        self.course = Course.objects.create(
            title="Python Masterclass",
            category=self.category,
            instructor=self.instructor,
            status="published",
            price=Decimal("500.00"),
        )
        self.exam = Exam.objects.create(
            title="Midterm Exam",
            course=None,  # Standalone public exam
            duration_minutes=30,
            max_score=20,
            attempts_allowed=2,
            is_published=True,
        )
        self.q1 = QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="What is 2 + 2?",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["2", "3", "4", "5"],
            correct_answer_json={"correct_option": "4"},
            points=Decimal("10.00"),
            order=1,
        )
        self.q2 = QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="Python is dynamically typed.",
            question_type=QuestionBankItem.QuestionType.TRUE_FALSE,
            options_json=["True", "False"],
            correct_answer_json={"correct_option": "True"},
            points=Decimal("10.00"),
            order=2,
        )

    def test_client_cannot_forge_score(self):
        """Verify that client passing arbitrary score=100 in submit is completely ignored and server-evaluated."""
        self.client.force_authenticate(user=self.student)

        # 1. Start exam
        start_res = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")
        self.assertEqual(start_res.status_code, status.HTTP_201_CREATED)

        # 2. Submit wrong answers but send fake client score=20
        submit_payload = {
            "score": 20,  # Malicious forged score attempt
            "answers": [
                {"question_id": self.q1.id, "answer": "3"},  # Wrong
                {"question_id": self.q2.id, "answer": "False"},  # Wrong
            ],
        }
        res = self.client.post(f"/api/v1/exams/{self.exam.id}/submit/", data=submit_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Server-evaluated score must be 0.00, NOT 20!
        attempt = StudentExam.objects.get(student=self.student, exam=self.exam, attempt_number=1)
        self.assertEqual(attempt.score, Decimal("0.00"))
        self.assertEqual(attempt.status, StudentExamStatus.GRADED)

    def test_correct_answers_earn_exact_points(self):
        """Verify correct answers calculate accurate server-side points."""
        self.client.force_authenticate(user=self.student)

        # 1. Start exam
        self.client.post(f"/api/v1/exams/{self.exam.id}/start/")

        # 2. Submit 1 right, 1 wrong
        submit_payload = {
            "answers": [
                {"question_id": self.q1.id, "answer": "4"},  # Correct (+10)
                {"question_id": self.q2.id, "answer": "False"},  # Wrong (0)
            ],
        }
        res = self.client.post(f"/api/v1/exams/{self.exam.id}/submit/", data=submit_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        attempt = StudentExam.objects.get(student=self.student, exam=self.exam, attempt_number=1)
        self.assertEqual(attempt.score, Decimal("10.00"))

    def test_multi_attempt_enforcement(self):
        """Verify that student can retry up to attempts_allowed, and blocked afterwards."""
        self.client.force_authenticate(user=self.student)

        # Attempt 1: Start & Submit
        self.client.post(f"/api/v1/exams/{self.exam.id}/start/")
        self.client.post(f"/api/v1/exams/{self.exam.id}/submit/", data={"answers": []}, format="json")

        # Attempt 2: Start & Submit
        start_2 = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")
        self.assertEqual(start_2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(start_2.data["attempt_number"], 2)
        self.client.post(f"/api/v1/exams/{self.exam.id}/submit/", data={"answers": []}, format="json")

        # Attempt 3: Should be BLOCKED because attempts_allowed == 2
        start_3 = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")
        self.assertEqual(start_3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("استنفدت", start_3.data["detail"])
