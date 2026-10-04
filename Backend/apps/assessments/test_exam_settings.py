from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.assessments.models import (
    Exam,
    ExamType,
    QuestionBankItem,
    StudentExam,
    StudentExamStatus,
)
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment


User = get_user_model()


class InstructorExamSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            email="exam-settings-instructor@example.test",
            password="Password123!",
            first_name="Exam",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="exam-settings-student@example.test",
            password="Password123!",
            first_name="Exam",
            last_name="Student",
            role="student",
            profile_completed=True,
        )
        category = Category.objects.create(name="Exam Settings", slug="exam-settings")
        self.course = Course.objects.create(
            title="Exam Settings Course",
            category=category,
            instructor=self.instructor,
            status="published",
            price=0,
            is_free=True,
        )
        Enrollment.objects.create(student=self.student, course=self.course)

    def create_exam(self):
        self.client.force_authenticate(self.instructor)
        return self.client.post(
            "/api/v1/exams/",
            {
                "title": "اختبار الإعدادات",
                "description": "اختبار تكاملي لإعدادات صفحة المدرس",
                "course": self.course.id,
                "exam_type": "PRACTICE",
                "duration_minutes": 30,
                "pass_threshold": 60,
                "attempts_allowed": 3,
                "shuffle_questions": False,
                "tab_switch_limit": 0,
                "quiz_question_count": 3,
                "is_published": True,
                "questions": [
                    {
                        "text": "اختر الرقم الصحيح",
                        "type": "MULTIPLE_CHOICE",
                        "difficulty": "HARD",
                        "points": 10,
                        "explanation": "الرقم الصحيح هو 2.",
                        "options": [
                            {"text": "1", "isCorrect": False},
                            {"text": "2", "isCorrect": True},
                        ],
                    },
                    {
                        "text": "الأرض مسطحة",
                        "type": "TRUE_FALSE",
                        "difficulty": "EASY",
                        "points": 5,
                        "explanation": "الأرض شبه كروية.",
                        "options": [
                            {"text": "صواب", "isCorrect": False},
                            {"text": "خطأ", "isCorrect": True},
                        ],
                    },
                    {
                        "text": "اشرح السبب",
                        "type": "ESSAY",
                        "difficulty": "MEDIUM",
                        "points": 5,
                        "explanation": "",
                        "options": [],
                    },
                ],
            },
            format="json",
        )

    def test_teacher_settings_false_answer_and_difficulty_are_persisted(self):
        response = self.create_exam()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        exam = Exam.objects.get(pk=response.data["id"])
        self.assertEqual(exam.attempts_allowed, 3)
        self.assertEqual(exam.pass_threshold, 60)
        self.assertFalse(exam.shuffle_questions)
        self.assertEqual(exam.tab_switch_limit, 0)
        self.assertEqual(exam.quiz_question_count, 3)

        questions = list(exam.questions.order_by("order"))
        self.assertEqual(questions[0].difficulty, QuestionBankItem.Difficulty.HARD)
        self.assertEqual(
            questions[1].correct_answer_json,
            {"correct_option": "خطأ"},
        )
        self.assertFalse(questions[1].options_json[0]["isCorrect"])
        self.assertTrue(questions[1].options_json[1]["isCorrect"])

        detail = self.client.get(f"/api/v1/exams/{exam.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["attempts_allowed"], 3)
        self.assertEqual(detail.data["tab_switch_limit"], 0)

    def test_question_assignment_type_and_deadline_are_persisted(self):
        self.client.force_authenticate(self.instructor)
        starts_at = timezone.now() + timedelta(hours=1)
        ends_at = starts_at + timedelta(days=2)
        response = self.client.post(
            "/api/v1/exams/",
            {
                "title": "واجب الفصل الأول",
                "course": self.course.id,
                "exam_type": ExamType.ASSIGNMENT,
                "start_time": starts_at.isoformat(),
                "end_time": ends_at.isoformat(),
                "pass_threshold": 75,
                "attempts_allowed": 2,
                "questions": [
                    {
                        "text": "اختر الإجابة الصحيحة",
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
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        assignment = Exam.objects.get(pk=response.data["id"])
        self.assertEqual(assignment.exam_type, ExamType.ASSIGNMENT)
        self.assertEqual(assignment.pass_threshold, 75)
        self.assertEqual(assignment.attempts_allowed, 2)
        self.assertEqual(assignment.end_time, ends_at)

        invalid = self.client.patch(
            f"/api/v1/exams/{assignment.id}/",
            {"start_time": ends_at.isoformat(), "end_time": starts_at.isoformat()},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_time", invalid.data["error"]["errors"])

    def test_attempt_payload_hides_answer_flags_and_essay_waits_for_grading(self):
        response = self.create_exam()
        exam = Exam.objects.get(pk=response.data["id"])
        questions = list(exam.questions.order_by("order"))

        self.client.force_authenticate(self.student)
        started = self.client.post(f"/api/v1/exams/{exam.id}/start/", format="json")
        self.assertEqual(started.status_code, status.HTTP_201_CREATED, started.data)

        snapshot = started.data["attempt"]["questions_snapshot_json"]
        self.assertEqual([item["question_text"] for item in snapshot], [q.question_text for q in questions])
        self.assertEqual(snapshot[0]["explanation"], "الرقم الصحيح هو 2.")
        for item in snapshot:
            for option in item.get("options", []):
                self.assertNotIn("isCorrect", option)
                self.assertNotIn("is_correct", option)

        submitted = self.client.post(
            f"/api/v1/exams/{exam.id}/submit/",
            {
                "answers": {
                    str(questions[0].id): "2",
                    str(questions[1].id): "خطأ",
                    str(questions[2].id): "لأن الأدلة العلمية تؤكد ذلك.",
                },
                "tab_switches_count": 2,
            },
            format="json",
        )
        self.assertEqual(submitted.status_code, status.HTTP_200_OK, submitted.data)
        self.assertEqual(submitted.data["status"], StudentExamStatus.SUBMITTED)

        attempt = StudentExam.objects.get(student=self.student, exam=exam)
        self.assertEqual(attempt.tab_switches_count, 2)
        self.assertEqual(attempt.score, Decimal("15.00"))
        self.assertFalse(attempt.is_passed)
        essay_answer = attempt.answers.get(question=questions[2])
        self.assertFalse(essay_answer.is_graded)

        self.client.force_authenticate(self.instructor)
        graded = self.client.post(
            f"/api/v1/exams/{exam.id}/grade-essay/",
            {
                "student_exam_id": attempt.id,
                "score": 20,
                "feedback": "إجابة جيدة.",
            },
            format="json",
        )
        self.assertEqual(graded.status_code, status.HTTP_200_OK, graded.data)
        attempt.refresh_from_db()
        essay_answer.refresh_from_db()
        self.assertEqual(attempt.status, StudentExamStatus.GRADED)
        self.assertTrue(attempt.is_passed)
        self.assertTrue(essay_answer.is_graded)

    def test_rejects_multiple_choice_with_more_than_one_correct_answer(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            "/api/v1/exams/",
            {
                "title": "اختبار غير صالح",
                "course": self.course.id,
                "questions": [
                    {
                        "text": "اختر",
                        "type": "MULTIPLE_CHOICE",
                        "points": 5,
                        "options": [
                            {"text": "أ", "isCorrect": True},
                            {"text": "ب", "isCorrect": True},
                        ],
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Exam.objects.filter(title="اختبار غير صالح").exists())

    def test_published_exam_requires_questions_and_string_false_unpublishes(self):
        self.client.force_authenticate(self.instructor)
        empty = self.client.post(
            "/api/v1/exams/",
            {
                "title": "اختبار فارغ",
                "course": self.course.id,
                "is_published": True,
                "questions": [],
            },
            format="json",
        )
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("questions", empty.data["error"]["errors"])
        self.assertFalse(Exam.objects.filter(title="اختبار فارغ").exists())

        created = self.create_exam()
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        exam = Exam.objects.get(pk=created.data["id"])
        unpublished = self.client.post(
            f"/api/v1/exams/{exam.id}/publish/",
            {"is_published": "false"},
            format="json",
        )
        self.assertEqual(unpublished.status_code, status.HTTP_200_OK, unpublished.data)
        exam.refresh_from_db()
        self.assertFalse(exam.is_published)

    def test_assignment_attempt_limit_is_enforced(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            "/api/v1/exams/",
            {
                "title": "واجب بمحاولة واحدة",
                "course": self.course.id,
                "exam_type": ExamType.ASSIGNMENT,
                "attempts_allowed": 1,
                "is_published": True,
                "questions": [
                    {
                        "text": "2 + 2",
                        "type": "MULTIPLE_CHOICE",
                        "points": 5,
                        "options": [
                            {"text": "4", "isCorrect": True},
                            {"text": "5", "isCorrect": False},
                        ],
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        exam = Exam.objects.get(pk=response.data["id"])

        self.client.force_authenticate(self.student)
        started = self.client.post(f"/api/v1/exams/{exam.id}/start/", format="json")
        self.assertEqual(started.status_code, status.HTTP_201_CREATED, started.data)
        submitted = self.client.post(
            f"/api/v1/exams/{exam.id}/submit/",
            {"answers": {}},
            format="json",
        )
        self.assertEqual(submitted.status_code, status.HTTP_200_OK, submitted.data)
        blocked = self.client.post(f"/api/v1/exams/{exam.id}/start/", format="json")
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST, blocked.data)
        self.assertIn("استنفدت", blocked.data["detail"])

    def test_expired_enrollment_cannot_start_or_submit(self):
        exam_response = self.create_exam()
        self.assertEqual(exam_response.status_code, status.HTTP_201_CREATED, exam_response.data)
        exam = Exam.objects.get(pk=exam_response.data["id"])
        enrollment = Enrollment.objects.get(student=self.student, course=self.course)
        enrollment.expires_at = timezone.now() - timedelta(days=Enrollment.GRACE_PERIOD_DAYS + 1)
        enrollment.save(update_fields=["expires_at"])

        self.client.force_authenticate(self.student)
        blocked = self.client.post(f"/api/v1/exams/{exam.id}/start/", format="json")
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN, blocked.data)
        self.assertEqual(blocked.data["code"], "subscription_expired")

        StudentExam.objects.create(
            student=self.student,
            exam=exam,
            attempt_number=1,
            status=StudentExamStatus.IN_PROGRESS,
            started_at=timezone.now(),
        )
        blocked_submit = self.client.post(
            f"/api/v1/exams/{exam.id}/submit/",
            {"answers": {}},
            format="json",
        )
        self.assertEqual(
            blocked_submit.status_code,
            status.HTTP_403_FORBIDDEN,
            blocked_submit.data,
        )
        self.assertEqual(blocked_submit.data["code"], "subscription_expired")