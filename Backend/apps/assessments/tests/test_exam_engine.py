from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.assessments.models import Exam, ExamType, QuestionBankItem, StudentAnswer, StudentExam, StudentExamStatus
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment

User = get_user_model()


class ExamEngineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            email="instructor_exam@coursat.online",
            password="Password123!",
            first_name="Instructor",
            last_name="Exam",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="student_exam@coursat.online",
            password="Password123!",
            first_name="Student",
            last_name="Exam",
            role="student",
            profile_completed=True,
        )
        self.category = Category.objects.create(name="Science", slug="science")
        self.course = Course.objects.create(
            title="Physics 101",
            category=self.category,
            instructor=self.instructor,
            status="published",
            price=0,
            is_free=True,
        )
        Enrollment.objects.create(student=self.student, course=self.course)
        self.exam = Exam.objects.create(
            course=self.course,
            title="Midterm Exam",
            exam_type=ExamType.EXAM,
            duration_minutes=60,
            max_score=100,
            pass_threshold=60,
            attempts_allowed=2,
            is_published=True,
        )

        # 1. Multiple Choice (25 pts)
        self.q_mc = QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="What is the unit of force?",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["Joule", "Newton", "Pascal", "Watt"],
            correct_answer_json={"correct_option": "Newton"},
            points=Decimal("25.00"),
            order=1,
        )

        # 2. True / False (25 pts)
        self.q_tf = QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="Energy cannot be created or destroyed.",
            question_type=QuestionBankItem.QuestionType.TRUE_FALSE,
            options_json=["صواب", "خطأ"],
            correct_answer_json={"correct_option": "صواب"},
            points=Decimal("25.00"),
            order=2,
        )

        # 3. Fill in the Blank (25 pts)
        self.q_fib = QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="Speed of light in vacuum is approximately ___ km/s.",
            question_type=QuestionBankItem.QuestionType.FILL_BLANK,
            correct_answer_json={"accepted_answers": ["300000", "300,000", "3x10^5"]},
            points=Decimal("25.00"),
            order=3,
        )

        # 4. Matching (25 pts)
        self.q_match = QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="Match law with scientist:",
            question_type=QuestionBankItem.QuestionType.MATCHING,
            correct_answer_json={"Gravity": "Newton", "Relativity": "Einstein"},
            points=Decimal("25.00"),
            order=4,
        )

    def test_start_and_submit_auto_grading_pass(self):
        """Student starts exam, submits correct answers, passes server-side auto grading."""
        self.client.force_authenticate(user=self.student)

        # Start exam
        res_start = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")
        self.assertEqual(res_start.status_code, status.HTTP_201_CREATED)

        # Submit all correct answers (100% score -> should pass since threshold is 60%)
        res_submit = self.client.post(
            f"/api/v1/exams/{self.exam.id}/submit/",
            {
                "answers": [
                    {"question_id": self.q_mc.id, "answer": "Newton"},
                    {"question_id": self.q_tf.id, "answer": "صواب"},
                    {"question_id": self.q_fib.id, "answer": "300000"},
                    {"question_id": self.q_match.id, "answer": {"Gravity": "Newton", "Relativity": "Einstein"}},
                ],
                "tab_switches_count": 1,
            },
            format="json",
        )

        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_submit.data["score"], "100.00")
        self.assertTrue(res_submit.data["is_passed"])
        self.assertEqual(res_submit.data["status"], StudentExamStatus.GRADED)

        attempt = StudentExam.objects.get(student=self.student, exam=self.exam)
        self.assertEqual(attempt.score, Decimal("100.00"))
        self.assertTrue(attempt.is_passed)
        self.assertEqual(attempt.tab_switches_count, 1)

    def test_submit_partial_and_fail_threshold(self):
        """Student gets only 1 question right (25% < 60% threshold) -> fails exam."""
        self.client.force_authenticate(user=self.student)

        # Start exam
        self.client.post(f"/api/v1/exams/{self.exam.id}/start/")

        # Submit: only 1 correct
        res_submit = self.client.post(
            f"/api/v1/exams/{self.exam.id}/submit/",
            {
                "answers": [
                    {"question_id": self.q_mc.id, "answer": "Newton"},  # +25
                    {"question_id": self.q_tf.id, "answer": "خطأ"},    # 0
                    {"question_id": self.q_fib.id, "answer": "999999"}, # 0
                    {"question_id": self.q_match.id, "answer": {"Gravity": "Einstein", "Relativity": "Newton"}}, # 0
                ]
            },
            format="json",
        )

        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_submit.data["score"], "25.00")
        self.assertFalse(res_submit.data["is_passed"])

    def test_instructor_attempts_list(self):
        """Instructor can retrieve list of student attempts for the exam."""
        # Have student take exam first
        self.client.force_authenticate(user=self.student)
        self.client.post(f"/api/v1/exams/{self.exam.id}/start/")
        self.client.post(
            f"/api/v1/exams/{self.exam.id}/submit/",
            {"answers": [{"question_id": self.q_mc.id, "answer": "Newton"}]},
            format="json",
        )

        # Authenticate as instructor
        self.client.force_authenticate(user=self.instructor)
        res = self.client.get(f"/api/v1/exams/{self.exam.id}/attempts/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("data", res.data.get("results", res.data))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["student_name"], self.student.full_name)
        self.assertEqual(results[0]["score"], "25.00")
