from decimal import Decimal
import pytest
from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.common.exceptions import custom_exception_handler
from apps.courses.models import Category, Course, CourseStatus


@pytest.mark.django_db
class TestBackendResilience:

    def test_custom_exception_handler_django_validation_error(self):
        exc = DjangoValidationError("Invalid value supplied.")
        context = {"view": None}
        response = custom_exception_handler(exc, context)
        assert response is not None
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
        assert response.data["error"]["status"] == 400

    def test_custom_exception_handler_object_does_not_exist(self):
        exc = ObjectDoesNotExist("Course matching query does not exist.")
        context = {"view": None}
        response = custom_exception_handler(exc, context)
        assert response is not None
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "error" in response.data
        assert response.data["error"]["status"] == 404

    def test_custom_exception_handler_integrity_error(self):
        exc = IntegrityError("UNIQUE constraint failed")
        context = {"view": None}
        response = custom_exception_handler(exc, context)
        assert response is not None
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_student_dashboard_resilience(self):
        client = APIClient()
        student = User.objects.create_user(
            email="student_dash@example.com",
            password="Password123!",
            role=UserRole.STUDENT,
            first_name="Student",
            last_name="Test",
        )
        client.force_authenticate(user=student)
        url = reverse("v1:dashboard-student")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "stats" in response.data
        assert "enrollments" in response.data

    def test_instructor_dashboard_resilience(self):
        client = APIClient()
        instructor = User.objects.create_user(
            email="instructor_dash@example.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
            first_name="Instructor",
            last_name="Test",
        )
        category = Category.objects.create(name="Development", slug="development")
        Course.objects.create(
            category=category,
            instructor=instructor,
            title="Resilience Course",
            price=Decimal("150.00"),
            status=CourseStatus.PUBLISHED,
        )
        client.force_authenticate(user=instructor)
        url = reverse("v1:dashboard-instructor")
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "stats" in response.data
        assert "courses" in response.data

    def test_checkout_invalid_course_id_returns_400_validation_error(self):
        client = APIClient()
        student = User.objects.create_user(
            email="buyer@example.com",
            password="Password123!",
            role=UserRole.STUDENT,
        )
        client.force_authenticate(user=student)
        url = reverse("v1:finance-checkout")
        response = client.post(url, {"course_id": 999999}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
