import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment
from apps.finance.models import Coupon

User = get_user_model()


@pytest.mark.django_db
class TestPhase2Backend:

    @pytest.fixture
    def setup_data(self):
        instructor1 = User.objects.create_user(
            email="inst1@example.com",
            password="Password123!",
            role="instructor",
            first_name="Dr. One",
        )
        instructor2 = User.objects.create_user(
            email="inst2@example.com",
            password="Password123!",
            role="instructor",
            first_name="Dr. Two",
        )
        student1 = User.objects.create_user(
            email="stud1@example.com",
            password="Password123!",
            role="student",
            first_name="Alice",
        )
        student2 = User.objects.create_user(
            email="stud2@example.com",
            password="Password123!",
            role="student",
            first_name="Bob",
        )


        category = Category.objects.create(name="Computer Science", slug="cs")
        course1 = Course.objects.create(
            title="Intro to Python",
            instructor=instructor1,
            category=category,
            status="published",
            price=450.00,
        )
        course2 = Course.objects.create(
            title="Advanced Django",
            instructor=instructor2,
            category=category,
            status="published",
            price=600.00,
        )

        enrollment1 = Enrollment.objects.create(student=student1, course=course1)
        enrollment2 = Enrollment.objects.create(student=student2, course=course2)

        return {
            "inst1": instructor1,
            "inst2": instructor2,
            "stud1": student1,
            "stud2": student2,
            "course1": course1,
            "course2": course2,
            "enrollment1": enrollment1,
            "enrollment2": enrollment2,
        }

    def test_student_management_permission_isolation(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        # Inst1 should only see their own enrolled students
        res = client.get("/api/v1/enrollments/")
        assert res.status_code == 200
        data = res.data
        if isinstance(data, dict) and "results" in data:
            items = data["results"]
        elif isinstance(data, list):
            items = data
        else:
            items = []
        student_ids = [e.get("student_id") or e.get("studentId") for e in items if isinstance(e, dict)]
        assert setup_data["stud1"].id in student_ids
        assert setup_data["stud2"].id not in student_ids

    def test_student_search_and_course_filter(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        res = client.get(f"/api/v1/enrollments/?course_id={setup_data['course1'].id}&search=Alice")
        assert res.status_code == 200
        data = res.data
        if isinstance(data, dict) and "results" in data:
            items = data["results"]
        elif isinstance(data, list):
            items = data
        else:
            items = []
        assert len(items) == 1
        name = items[0].get("student_name") or items[0].get("studentName")
        assert name == setup_data["stud1"].full_name

    def test_instructor_earnings_permission_isolation(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        res = client.get("/api/v1/finance/instructor/earnings/")
        assert res.status_code == 200
        assert "gross_revenue" in res.data or "grossRevenue" in res.data
        assert "net_earnings" in res.data or "netEarnings" in res.data

    def test_instructor_coupon_crud(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        # Create coupon
        payload = {
            "code": "PROMO2026",
            "discount_type": "percent",
            "discount_value": "15.00",
            "max_uses": 50,
            "is_active": True,
        }
        res_create = client.post("/api/v1/finance/instructor/coupons/", payload)
        assert res_create.status_code == 201
        assert res_create.data["code"] == "PROMO2026"

        # List coupons
        res_list = client.get("/api/v1/finance/instructor/coupons/")
        assert res_list.status_code == 200
        data = res_list.data
        if isinstance(data, dict) and "results" in data:
            coupons = data["results"]
        elif isinstance(data, list):
            coupons = data
        else:
            coupons = []
        codes = [c["code"] for c in coupons if isinstance(c, dict)]
        assert "PROMO2026" in codes

    def test_course_video_dropoff_analytics(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        res = client.get(f"/api/v1/analytics/instructor/courses/{setup_data['course1'].id}/analytics/")
        assert res.status_code == 200
        assert "funnel" in res.data
        assert "video_drop_off" in res.data
        assert len(res.data["video_drop_off"]) == 5
