import io
import tempfile
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.assessments.models import Exam, ExamKind, QuestionBankItem
from apps.assessments.services.exam_attempt_service import start_exam
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment


User = get_user_model()


def make_png(name: str = "question.png", size: tuple[int, int] = (1200, 800)):
    payload = io.BytesIO()
    Image.new("RGB", size, color=(30, 120, 200)).save(payload, format="PNG")
    return SimpleUploadedFile(name, payload.getvalue(), content_type="image/png")


class QuestionImageTests(TestCase):
    def setUp(self):
        self.temp_media = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=Path(self.temp_media.name))
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.client = APIClient()
        self.instructor = User.objects.create_user(
            email="question-image-instructor@test.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        self.student = User.objects.create_user(
            email="question-image-student@test.com",
            password="Password123!",
            role=UserRole.STUDENT,
        )

    def test_instructor_upload_is_converted_to_webp(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            "/api/v1/assessments/questions/upload-image/",
            {"image": make_png()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["url"].startswith("/media/questions/webp/question_"))
        self.assertTrue(response.data["url"].endswith(".webp"))
        self.assertEqual(response.data["format"], "webp")

        relative_path = response.data["url"].removeprefix("/media/")
        stored_path = Path(self.temp_media.name) / relative_path
        self.assertTrue(stored_path.exists())
        with Image.open(stored_path) as saved:
            self.assertEqual(saved.format, "WEBP")

    def test_invalid_file_and_student_upload_are_rejected(self):
        self.client.force_authenticate(self.instructor)
        invalid = SimpleUploadedFile("not-image.txt", b"not an image", content_type="text/plain")
        bad_response = self.client.post(
            "/api/v1/assessments/questions/upload-image/",
            {"image": invalid},
            format="multipart",
        )
        self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.student)
        forbidden_response = self.client.post(
            "/api/v1/assessments/questions/upload-image/",
            {"image": make_png()},
            format="multipart",
        )
        self.assertEqual(forbidden_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_exam_create_and_student_snapshot_keep_image_without_answer(self):
        self.client.force_authenticate(self.instructor)
        upload = self.client.post(
            "/api/v1/assessments/questions/upload-image/",
            {"image": make_png()},
            format="multipart",
        )
        image_url = upload.data["url"]

        category = Category.objects.create(name="Question images", slug="question-images")
        course = Course.objects.create(
            title="Illustrated course",
            instructor=self.instructor,
            category=category,
            status="published",
            price=Decimal("0.00"),
        )
        Enrollment.objects.create(student=self.student, course=course)

        create_response = self.client.post(
            "/api/v1/assessments/exams/",
            {
                "course": course.id,
                "title": "Illustrated exam",
                "kind": ExamKind.GENERAL_EXAM,
                "questions": [
                    {
                        "text": "اختر الإجابة الصحيحة من الصورة",
                        "image_url": image_url,
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
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        exam = Exam.objects.get(id=create_response.data["id"])
        question = QuestionBankItem.objects.get(exam=exam)
        self.assertEqual(question.image_url, image_url)

        attempt = start_exam(self.student, exam, idempotency_key="question-image-attempt")
        snapshot = attempt.questions_snapshot_json[0]
        self.assertEqual(snapshot["image_url"], image_url)
        self.assertNotIn("correct_answer", snapshot)
        self.assertNotIn("correct_answer_json", snapshot)