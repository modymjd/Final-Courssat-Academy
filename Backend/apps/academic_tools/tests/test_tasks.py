import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from apps.academic_tools.models import AcademicTask
from apps.courses.models import Course, Category

User = get_user_model()


@pytest.mark.django_db
class TestAcademicTaskAPI:
    def setup_method(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            email="instructor@example.com",
            password="password123",
            role="instructor",
            first_name="دكتور",
            last_name="أحمد",
        )
        self.category = Category.objects.create(name="علوم الحاسب", slug="cs")
        self.course = Course.objects.create(
            title="مقدمة في البرمجة",
            instructor=self.instructor,
            category=self.category,
            status="published",
            price=500.0,
        )

        self.student = User.objects.create_user(
            email="student@example.com",
            password="password123",
            role="student",
            first_name="محمود",
            last_name="علي",
        )


    def test_create_task(self):
        self.client.force_authenticate(user=self.instructor)
        response = self.client.post(
            "/api/v1/academic-tools/tasks/",
            {
                "title": "تصحيح مشروع البرمجة",
                "description": "تصحيح 15 مشروع لطلاب الدورة",
                "priority": "HIGH",
                "status": "PENDING",
                "task_type": "GRADING",
                "course": self.course.id,
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "تصحيح مشروع البرمجة"
        assert response.data["priority"] == "HIGH"
        assert AcademicTask.objects.filter(user=self.instructor).count() == 1

    def test_update_task_status(self):
        self.client.force_authenticate(user=self.instructor)
        task = AcademicTask.objects.create(
            user=self.instructor,
            title="مراجعة المحاضرة",
            status="PENDING",
            priority="MEDIUM",
        )
        response = self.client.patch(
            f"/api/v1/academic-tools/tasks/{task.id}/",
            {"status": "COMPLETED"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "COMPLETED"
        task.refresh_from_db()
        assert task.completed_at is not None

    def test_idempotent_at_risk_task_creation(self):
        # Call 1: Creates new AT_RISK_ALERT task
        task1, created1 = AcademicTask.create_or_update_at_risk_task(
            instructor=self.instructor,
            student=self.student,
            course=self.course,
            reason_text="الطالب متغيب منذ 8 أيام",
        )
        assert created1 is True
        assert AcademicTask.objects.filter(user=self.instructor, task_type="AT_RISK_ALERT").count() == 1

        # Call 2: Same student & course -> Updates existing task description instead of duplicating
        task2, created2 = AcademicTask.create_or_update_at_risk_task(
            instructor=self.instructor,
            student=self.student,
            course=self.course,
            reason_text="الطالب متغيب منذ 9 أيام وانخفضت درجاته",
        )
        assert created2 is False
        assert task1.id == task2.id
        assert AcademicTask.objects.filter(user=self.instructor, task_type="AT_RISK_ALERT").count() == 1
        assert task2.description == "الطالب متغيب منذ 9 أيام وانخفضت درجاته"

    def test_daily_brief_endpoint_with_cache(self):
        cache.clear()
        self.client.force_authenticate(user=self.instructor)

        # Create sample task
        AcademicTask.objects.create(
            user=self.instructor,
            title="تصحيح اختبار منتصف الفصل",
            task_type="GRADING",
            priority="URGENT",
            status="PENDING",
        )

        response = self.client.get("/api/v1/analytics/instructor/daily-brief/")
        assert response.status_code == status.HTTP_200_OK
        assert "kpis" in response.data
        assert "morning_brief" in response.data
        assert response.data["kpis"]["active_courses"] == 1
        assert response.data["morning_brief"]["pending_grading_count"] == 1

        # Test Redis cache key existence
        cache_key = f"instructor_daily_brief_{self.instructor.id}"
        assert cache.get(cache_key) is not None
