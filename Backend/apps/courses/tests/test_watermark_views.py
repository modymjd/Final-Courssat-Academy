import io
from pathlib import Path
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import StudentProfile
from apps.assessments.models import StudentFileConsent
from apps.courses.models import Category, Course, Lesson, LessonSummary, Module
from apps.enrollments.models import Enrollment

User = get_user_model()


class WatermarkViewsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.instructor = User.objects.create_user(
            email="inst_wmv@test.com", password="Password123!", role="instructor"
        )
        self.student = User.objects.create_user(
            email="stud_wmv@test.com", password="Password123!", role="student"
        )
        StudentProfile.objects.filter(user=self.student).update(student_code="STU-12345")

        self.category = Category.objects.create(name="Biology", slug="bio")
        self.course = Course.objects.create(
            title="Bio Course",
            instructor=self.instructor,
            category=self.category,
        )
        self.module = Module.objects.create(course=self.course, title="Unit 1", order=1)
        self.lesson = Lesson.objects.create(module=self.module, title="Lesson 1", order=1)

        # Create a sample PDF attachment
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        c.drawString(100, 100, "Biology Lecture Notes")
        c.showPage()
        c.save()
        pdf_content = buf.getvalue()

        pdf_file = SimpleUploadedFile("notes.pdf", pdf_content, content_type="application/pdf")
        self.summary = LessonSummary.objects.create(
            lesson=self.lesson,
            content="Summary content",
            attachment=pdf_file,
        )

        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course)

    def test_student_file_consent_flow(self):
        self.client.force_authenticate(user=self.student)

        # Initial status: False
        res = self.client.get("/api/v1/courses/student-file-consent/status/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["has_consented"])

        # Consent via POST
        post_res = self.client.post(
            "/api/v1/courses/student-file-consent/",
            {"terms_version": "1.0"},
            format="json",
        )
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)
        self.assertTrue(post_res.data["has_consented"])

        # Status is now True
        res_after = self.client.get("/api/v1/courses/student-file-consent/status/")
        self.assertTrue(res_after.data["has_consented"])

    def test_watermark_download_requires_consent(self):
        self.client.force_authenticate(user=self.student)

        # Without consent -> 403 CONSENT_REQUIRED
        res = self.client.post(f"/api/v1/courses/lessons/{self.lesson.id}/watermarked-pdf/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.data.get("code"), "CONSENT_REQUIRED")

        # Give consent
        StudentFileConsent.objects.create(student=self.student, terms_version="1.0")

        # Now download succeeds with 200 OK and PDF content
        res_ok = self.client.post(f"/api/v1/courses/lessons/{self.lesson.id}/watermarked-pdf/")
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok["Content-Type"], "application/pdf")
        self.assertIn("attachment", res_ok["Content-Disposition"])
