from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.certificates.models import Certificate
from apps.courses.models import Category, Course

User = get_user_model()


class CertificateVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Data Science", slug="data-science")
        self.instructor = User.objects.create_user(
            email="instructor_cert@edusmart.test",
            password="Password123!",
            first_name="Prof. Ahmed",
            last_name="Ali",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="student_cert@edusmart.test",
            password="Password123!",
            first_name="Omar",
            last_name="Khaled",
            role="student",
            profile_completed=True,
        )
        self.course = Course.objects.create(
            title="Advanced Machine Learning",
            category=self.category,
            instructor=self.instructor,
            status="published",
        )
        self.certificate = Certificate.objects.create(
            student=self.student,
            course=self.course,
            grade="A+",
        )

    def test_public_verify_endpoint_with_valid_serial(self):
        """Verify that public users can verify certificate by serial without auth."""
        url = f"/api/v1/certificates/verify/{self.certificate.serial}/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["valid"])
        self.assertEqual(res.data["certificate"]["serial"], self.certificate.serial)
        self.assertEqual(res.data["certificate"]["student_name"], "Omar Khaled")
        self.assertEqual(res.data["certificate"]["course_name"], "Advanced Machine Learning")

    def test_public_verify_endpoint_with_invalid_serial(self):
        """Verify that non-existent certificate serial returns 404."""
        url = "/api/v1/certificates/verify/INVALID-SERIAL-12345/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
