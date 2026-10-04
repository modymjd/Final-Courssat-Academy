import io
from pathlib import Path
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import StudentProfile
from apps.accounts.services.crypto_service import encrypt_national_id
from apps.assessments.models import FileDownloadAuditLog
from apps.courses.models import Category, Course, Lesson, LessonSummary, Module
from apps.courses.services.watermark_service import (
    WatermarkPolicy,
    generate_watermark_text,
    stamp_pdf_for_student,
)

User = get_user_model()


class WatermarkServiceTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="inst_wm@test.com", password="Password123!", role="instructor"
        )
        self.student = User.objects.create_user(
            email="stud_wm@test.com",
            password="Password123!",
            first_name="أحمد",
            last_name="علي",
            role="student",
        )
        self.student.national_id_encrypted = encrypt_national_id("29901010101234")
        self.student.save()
        profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        profile.student_code = "STU-99881"
        profile.save()
        self.student.student_profile = profile

        self.category = Category.objects.create(name="Physics", slug="phys")
        self.course = Course.objects.create(
            title="Physics Course",
            instructor=self.instructor,
            category=self.category,
        )
        self.module = Module.objects.create(course=self.course, title="Unit 1", order=1)
        self.lesson = Lesson.objects.create(module=self.module, title="Lesson 1", order=1)
        self.summary = LessonSummary.objects.create(lesson=self.lesson, content="Lesson summary notes")

        # Minimal valid PDF bytes for testing
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        c.drawString(100, 100, "Source Lecture Notes")
        c.showPage()
        c.save()
        self.sample_pdf_bytes = buf.getvalue()

    def test_generate_watermark_text_policies(self):
        # 1. FULL: contains unmasked ID
        full_text = generate_watermark_text(self.student, policy=WatermarkPolicy.FULL)
        self.assertIn("29901010101234", full_text)
        self.assertIn("STU-99881", full_text)

        # 2. MASKED: contains masked ID (either standard or BiDi-ordered)
        masked_text = generate_watermark_text(self.student, policy=WatermarkPolicy.MASKED)
        self.assertTrue("2990101******4" in masked_text or "4******2990101" in masked_text)
        self.assertNotIn("29901010101234", masked_text)
        self.assertIn("STU-99881", masked_text)

        # 3. STUDENT_CODE: only student code and name
        code_text = generate_watermark_text(self.student, policy=WatermarkPolicy.STUDENT_CODE)
        self.assertNotIn("2990101", code_text)
        self.assertIn("STU-99881", code_text)

    def test_stamp_pdf_and_audit_log(self):
        path, trace_uuid = stamp_pdf_for_student(
            source_pdf_bytes=self.sample_pdf_bytes,
            student=self.student,
            lesson_summary=self.summary,
            policy=WatermarkPolicy.MASKED,
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 TestBrowser",
        )

        self.assertTrue(Path(path).exists())
        self.assertTrue(Path(path).stat().st_size > 0)

        # Verify audit log was written
        audit = FileDownloadAuditLog.objects.filter(trace_uuid=trace_uuid).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.student, self.student)
        self.assertEqual(audit.lesson_summary, self.summary)
        self.assertEqual(audit.ip_address, "192.168.1.100")

        # Second call returns cached file and logs again
        path2, trace_uuid2 = stamp_pdf_for_student(
            source_pdf_bytes=self.sample_pdf_bytes,
            student=self.student,
            lesson_summary=self.summary,
            policy=WatermarkPolicy.MASKED,
        )
        self.assertEqual(path, path2)
        self.assertNotEqual(trace_uuid, trace_uuid2)
