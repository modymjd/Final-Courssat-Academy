from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import StudentProfile, UserRole
from apps.analytics.models import DailyLearningLog, FocusSession
from apps.assessments.models import Exam, StudentExam, StudentExamStatus
from apps.certificates.models import Certificate
from apps.courses.models import Course
from apps.notifications.models import ParentConsent, ParentReportChannel, ParentReportLog
from apps.notifications.telegram_service import TelegramService

User = get_user_model()


class TelegramServiceTestCase(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            email="ahmed.student@example.com",
            password="SecurePassword123!",
            first_name="أحمد",
            last_name="علي",
            role=UserRole.STUDENT,
            phone="01012345678",
            national_id="30101011234567",
        )
        profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        profile.study_streak = 5
        profile.save(update_fields=["study_streak"])

        self.instructor = User.objects.create_user(
            email="instructor@example.com",
            password="SecurePassword123!",
            first_name="دكتور",
            last_name="سامح",
            role=UserRole.INSTRUCTOR,
            phone="01099998888",
            national_id="29001011234567",
        )

        from apps.courses.models import Category

        self.category = Category.objects.create(
            name="العلوم والفيزياء",
            slug="science-physics",
        )

        self.course = Course.objects.create(
            title="الفيزياء للثانوية العامة",
            price=Decimal("450.00"),
            instructor=self.instructor,
            category=self.category,
        )

        self.exam = Exam.objects.create(
            course=self.course,
            title="اختبار الميكانيكا الشامل",
            max_score=Decimal("20.00"),
            duration_minutes=45,
            attempts_allowed=2,
            is_published=True,
        )

        self.client = APIClient()

    def test_generate_and_retrieve_linking_code(self):
        code = TelegramService.generate_linking_code(self.student)
        self.assertTrue(code.startswith(f"EDU{self.student.id}"))

        # Verify idempotence
        code2 = TelegramService.generate_linking_code(self.student)
        self.assertEqual(code, code2)

        link_url = TelegramService.get_bot_direct_link(self.student)
        self.assertIn("EduSmartAcademyBot", link_url)
        self.assertIn(code, link_url)

    def test_link_and_unlink_parent(self):
        code = TelegramService.generate_linking_code(self.student)
        tg_user = {"first_name": "محمد", "last_name": "علي", "username": "mohamed_ali"}

        success, msg, student = TelegramService.link_parent(code, "987654321", tg_user)
        self.assertTrue(success)
        self.assertEqual(student.id, self.student.id)

        consent = ParentConsent.objects.get(student=self.student)
        self.assertEqual(consent.telegram_chat_id, "987654321")
        self.assertEqual(consent.telegram_username, "mohamed_ali")
        self.assertEqual(consent.parent_name, "محمد علي")

        # Test unlinking
        unlink_ok, unlink_msg = TelegramService.unlink_parent("987654321")
        self.assertTrue(unlink_ok)
        consent.refresh_from_db()
        self.assertEqual(consent.telegram_chat_id, "")

    def test_student_metrics_aggregation(self):
        # Create Daily Learning Log
        DailyLearningLog.objects.create(
            user=self.student,
            date=timezone.now().date(),
            minutes_spent=120,
            lessons_completed=4,
            quizzes_submitted=2,
        )

        # Create Focus Session
        FocusSession.objects.create(
            session_id="focus-test-1",
            student=self.student,
            start_time=timezone.now() - timezone.timedelta(minutes=50),
            end_time=timezone.now(),
            duration_seconds=3000,
            focus_score=95,
        )

        # Create Student Exam
        StudentExam.objects.create(
            student=self.student,
            exam=self.exam,
            score=Decimal("18.00"),
            status=StudentExamStatus.GRADED,
            attempt_number=1,
        )

        metrics = TelegramService.get_student_metrics(self.student, days=7)
        self.assertEqual(metrics["total_minutes"], 120)
        self.assertEqual(metrics["lessons_completed_count"], 4)
        self.assertEqual(metrics["focus_count"], 1)
        self.assertEqual(metrics["avg_focus_score"], 95)
        self.assertEqual(metrics["streak"], 5)
        self.assertEqual(len(metrics["exams"]), 1)
        self.assertEqual(metrics["exams"][0]["score"], 18.0)
        self.assertEqual(metrics["exams"][0]["percentage"], 90.0)

    def test_weekly_report_formatting(self):
        report_text, markup = TelegramService.format_weekly_report(self.student, "أ/ محمد علي")
        self.assertIn("EduSmart | تقرير الأداء والمتابعة الأسبوعي", report_text)
        self.assertIn("أحمد علي", report_text)
        self.assertIn("محمد علي", report_text)
        self.assertIn("inline_keyboard", markup)

    @patch.object(TelegramService, "send_message", return_value=True)
    def test_send_exam_graded_alert(self, mock_send):
        code = TelegramService.generate_linking_code(self.student)
        TelegramService.link_parent(code, "987654321", {"first_name": "محمد"})

        se = StudentExam.objects.create(
            student=self.student,
            exam=self.exam,
            score=Decimal("19.00"),
            status=StudentExamStatus.GRADED,
            attempt_number=1,
        )

        sent = TelegramService.send_exam_graded_alert(se.id)
        self.assertTrue(sent)
        mock_send.assert_called_once()
        self.assertTrue(
            ParentReportLog.objects.filter(student=self.student, channel=ParentReportChannel.TELEGRAM).exists()
        )

    @patch.object(TelegramService, "send_message", return_value=True)
    def test_send_certificate_earned_alert(self, mock_send):
        code = TelegramService.generate_linking_code(self.student)
        TelegramService.link_parent(code, "987654321", {"first_name": "محمد"})

        cert = Certificate.objects.create(
            student=self.student,
            course=self.course,
            grade="A+",
        )

        sent = TelegramService.send_certificate_earned_alert(cert.id)
        self.assertTrue(sent)
        mock_send.assert_called_once()

    @patch.object(TelegramService, "send_message", return_value=True)
    def test_webhook_flow_with_start_token(self, mock_send):
        code = TelegramService.generate_linking_code(self.student)

        update = {
            "message": {
                "chat": {"id": 987654321},
                "from": {"id": 987654321, "first_name": "محمد", "username": "parent_user"},
                "text": f"/start {code}",
            }
        }

        url = reverse("v1:telegram-webhook")
        secret = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
        headers = {"HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN": secret} if secret else {}
        response = self.client.post(url, data=update, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        consent = ParentConsent.objects.get(student=self.student)
        self.assertEqual(consent.telegram_chat_id, "987654321")

    def test_telegram_link_info_api_view(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:telegram-link-info")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["student_id"], self.student.id)
        self.assertIn("EDU", response.data["linking_code"])
        self.assertIn("https://t.me/EduSmartAcademyBot", response.data["bot_direct_link"])
        self.assertFalse(response.data["is_linked"])
