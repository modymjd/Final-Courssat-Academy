import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification, ParentConsent, ParentReportLog

User = get_user_model()


@pytest.mark.django_db
class TestPhase4Backend:

    @pytest.fixture
    def setup_data(self):
        instructor1 = User.objects.create_user(
            email="inst1_p4@example.com",
            password="Password123!",
            role="instructor",
            first_name="Dr. Chem",
        )
        instructor2 = User.objects.create_user(
            email="inst2_p4@example.com",
            password="Password123!",
            role="instructor",
            first_name="Dr. Bio",
        )
        student1 = User.objects.create_user(
            email="stud1_p4@example.com",
            password="Password123!",
            role="student",
            first_name="Daniel",
        )
        student2 = User.objects.create_user(
            email="stud2_p4@example.com",
            password="Password123!",
            role="student",
            first_name="Eva",
        )


        category = Category.objects.create(name="Chemistry", slug="chem")
        course1 = Course.objects.create(
            title="Organic Chemistry",
            instructor=instructor1,
            category=category,
            status="published",
            price=400.00,
        )


        Enrollment.objects.create(student=student1, course=course1)
        Enrollment.objects.create(student=student2, course=course1)

        return {
            "inst1": instructor1,
            "inst2": instructor2,
            "stud1": student1,
            "stud2": student2,
            "course1": course1,
        }

    def test_broadcast_announcement(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        payload = {
            "course_id": setup_data["course1"].id,
            "title": "تأجيل محاضرة الخميس",
            "message": "سيتم تأجبل محاضرة الكيمياء العضوية إلى يوم الجمعة الساعة 5 مساءً.",
        }
        res = client.post("/api/v1/notifications/broadcast/", payload)
        assert res.status_code == 201
        assert res.data["recipients_count"] == 2

        # Check notifications generated for both students
        n1 = Notification.objects.filter(user=setup_data["stud1"]).first()
        assert n1 is not None
        assert "Organic Chemistry" in n1.title or "تأجيل" in n1.message or "تأجيل" in n1.title

    def test_parent_report_dispatch(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        ParentConsent.objects.create(
            student=setup_data["stud1"],
            parent_name="Abu Daniel",
            parent_phone="01012345678",
            consent_given=True,
            telegram_chat_id="123456789",
        )

        payload = {
            "student_id": setup_data["stud1"].id,
            "channel": "TELEGRAM",
            "report_data": {"attendance": "95%", "grade_avg": "88%"},
        }
        with patch("apps.notifications.telegram_service.TelegramService.send_message", return_value=True):
            res = client.post("/api/v1/notifications/parent-reports/send/", payload, format="json")

        assert res.status_code == 200
        assert res.data["channel"] == "TELEGRAM"

        log = ParentReportLog.objects.filter(student=setup_data["stud1"]).first()
        assert log is not None
        assert log.channel == "TELEGRAM"

    def test_broadcast_permission_isolation(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst2"])

        payload = {
            "course_id": setup_data["course1"].id,
            "title": "Unauthorized broadcast",
            "message": "Test message",
        }
        res = client.post("/api/v1/notifications/broadcast/", payload)
        assert res.status_code == 403
