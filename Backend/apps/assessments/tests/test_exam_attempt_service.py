from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.assessments.models import Exam, ExamKind, ExamType, QuestionBankItem, StudentExamStatus
from apps.assessments.services.exam_attempt_service import start_exam, submit_exam
from apps.courses.models import Category, Course

User = get_user_model()


class ExamAttemptServiceTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="inst_att@test.com", password="Password123!", role="instructor"
        )
        self.student = User.objects.create_user(
            email="stud_att@test.com", password="Password123!", role="student"
        )
        self.category = Category.objects.create(name="Math", slug="math")
        self.course = Course.objects.create(
            title="Math 101",
            instructor=self.instructor,
            category=self.category,
            status="published",
            price=Decimal("0.00"),
        )
        self.quiz = Exam.objects.create(
            course=self.course,
            title="Algebra Quiz",
            kind=ExamKind.LESSON_QUIZ,
            exam_type=ExamType.EXAM,
            pass_threshold=70,
            cooldown_seconds=30,
            quiz_question_count=2,
            is_published=True,
        )
        self.unit_exam = Exam.objects.create(
            course=self.course,
            title="Unit 1 Exam",
            kind=ExamKind.UNIT_EXAM,
            exam_type=ExamType.EXAM,
            pass_threshold=70,
            attempts_allowed=3,
            is_published=True,
        )

        # Questions for Quiz
        self.q1 = QuestionBankItem.objects.create(
            instructor=self.instructor,
            exam=self.quiz,
            question_text="2 + 2 = ?",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["3", "4", "5"],
            correct_answer_json={"value": "4"},
            points=Decimal("10.00"),
        )
        self.q2 = QuestionBankItem.objects.create(
            instructor=self.instructor,
            exam=self.quiz,
            question_text="Is 7 a prime number?",
            question_type=QuestionBankItem.QuestionType.TRUE_FALSE,
            options_json=["صواب", "خطأ"],
            correct_answer_json={"value": "صواب"},
            points=Decimal("10.00"),
        )

        # Questions for Unit Exam
        self.q_unit = QuestionBankItem.objects.create(
            instructor=self.instructor,
            exam=self.unit_exam,
            question_text="Solve x: 2x = 10",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["2", "5", "10"],
            correct_answer_json={"value": "5"},
            points=Decimal("10.00"),
        )

    def test_start_exam_idempotency_and_snapshot_security(self):
        # 1. Start exam with idempotency key
        attempt1 = start_exam(self.student, self.quiz, idempotency_key="idemp-key-12345")
        self.assertEqual(attempt1.status, StudentExamStatus.IN_PROGRESS)

        # Re-calling with same idempotency key returns the same attempt
        attempt2 = start_exam(self.student, self.quiz, idempotency_key="idemp-key-12345")
        self.assertEqual(attempt1.id, attempt2.id)

        # 2. Verify questions_snapshot_json DOES NOT contain correct_answer
        for q_snap in attempt1.questions_snapshot_json:
            self.assertNotIn("correct_answer", q_snap)
            self.assertNotIn("correct_answer_json", q_snap)

        # 3. Verify correct_answers_snapshot_json DOES contain correct answers
        self.assertIn(str(self.q1.id), attempt1.correct_answers_snapshot_json)
        self.assertEqual(
            attempt1.correct_answers_snapshot_json[str(self.q1.id)]["correct_answer"]["value"],
            "4",
        )

    def test_submit_exam_server_grading_and_pass_threshold(self):
        attempt = start_exam(self.student, self.quiz, idempotency_key="submit-test-1")

        # Submit: q1 correct ("4"), q2 wrong ("خطأ")
        # Total points: 20, Earned: 10 => 50% < 70% threshold -> failed
        answers = {
            str(self.q1.id): "4",
            str(self.q2.id): "خطأ",
        }
        graded = submit_exam(attempt, answers_data=answers)

        self.assertEqual(graded.status, StudentExamStatus.GRADED)
        self.assertEqual(graded.score, Decimal("50.00"))
        self.assertFalse(graded.is_passed)

        # Cooldown check: attempting to immediately restart quiz raises ValidationError
        with self.assertRaises(ValidationError):
            start_exam(self.student, self.quiz, idempotency_key="submit-test-2")

        # Now test passing submission:
        # Create fresh attempt for unit exam
        unit_attempt = start_exam(self.student, self.unit_exam, idempotency_key="unit-test-1")
        unit_answers = {str(self.q_unit.id): "5"}
        unit_graded = submit_exam(unit_attempt, answers_data=unit_answers)

        self.assertEqual(unit_graded.score, Decimal("100.00"))
        self.assertTrue(unit_graded.is_passed)

    def test_unit_exam_24h_lockout_after_three_failures(self):
        for i in range(1, 4):
            attempt = start_exam(self.student, self.unit_exam, idempotency_key=f"unit-fail-{i}")
            # Submit wrong answer
            submit_exam(attempt, answers_data={str(self.q_unit.id): "wrong"})

        # On the 3rd failure, locked_until must be set
        last_attempt = StudentExamStatus.GRADED
        third_attempt = self.student.student_exams.filter(exam=self.unit_exam).order_by("-attempt_number").first()
        self.assertIsNotNone(third_attempt.locked_until)

        # Attempting to start a 4th attempt raises 24h lockout ValidationError
        with self.assertRaises(ValidationError) as ctx:
            start_exam(self.student, self.unit_exam, idempotency_key="unit-fail-4")
        self.assertIn("24 ساعة", str(ctx.exception))
