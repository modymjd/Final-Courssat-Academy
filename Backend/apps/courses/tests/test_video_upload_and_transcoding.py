import os
import shutil
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.models import Category, Course, Lesson, Module, Video, VideoStatus
from apps.courses.tasks import transcode_video_to_hls_task
from apps.enrollments.models import Enrollment

User = get_user_model()


class VideoUploadAndTranscodingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            email="instructor@coursat.online",
            password="Password123!",
            first_name="Instructor",
            last_name="One",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="student@coursat.online",
            password="Password123!",
            first_name="Student",
            last_name="One",
            role="student",
            profile_completed=True,
        )
        self.category = Category.objects.create(name="Web Dev", slug="web-dev")
        self.course = Course.objects.create(
            title="Fullstack React & Django",
            category=self.category,
            instructor=self.instructor,
            status="published",
            price=100,
        )
        self.module = Module.objects.create(course=self.course, title="Module 1", order=1)
        self.lesson = Lesson.objects.create(
            module=self.module,
            title="Lesson 1: Introduction",
            order=1,
            is_free=True,
        )

    def tearDown(self):
        # Cleanup test directories
        scratch_dir = Path(settings.MEDIA_ROOT) / "scratch"
        if scratch_dir.exists():
            shutil.rmtree(scratch_dir, ignore_errors=True)
        hls_dir = Path(settings.MEDIA_ROOT) / "hls"
        if hls_dir.exists():
            shutil.rmtree(hls_dir, ignore_errors=True)

    def test_student_cannot_upload_video(self):
        """RBAC: Student cannot access video upload endpoints."""
        self.client.force_authenticate(user=self.student)
        chunk = SimpleUploadedFile("chunk_0.part", b"data", content_type="application/octet-stream")
        res = self.client.post(
            "/api/v1/videos/upload-chunk/",
            {"upload_id": "test_up_1", "chunk_index": 0, "total_chunks": 1, "chunk": chunk},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @patch("apps.courses.tasks.shutil.which", return_value=None)
    def test_chunked_upload_and_transcoding_pipeline(self, mock_which):
        """Full end-to-end flow: upload chunks -> complete -> Celery transcode -> ready state."""
        self.client.force_authenticate(user=self.instructor)
        upload_id = "test_chunk_flow_123"

        # 1. Upload Chunk 0
        chunk_0_data = b"CHUNK0_" * 100
        chunk_0 = SimpleUploadedFile("chunk0.bin", chunk_0_data, content_type="application/octet-stream")
        res_0 = self.client.post(
            "/api/v1/videos/upload-chunk/",
            {"upload_id": upload_id, "chunk_index": 0, "total_chunks": 2, "chunk": chunk_0},
            format="multipart",
        )
        self.assertEqual(res_0.status_code, status.HTTP_200_OK)

        # 2. Upload Chunk 1
        chunk_1_data = b"CHUNK1_" * 100
        chunk_1 = SimpleUploadedFile("chunk1.bin", chunk_1_data, content_type="application/octet-stream")
        res_1 = self.client.post(
            "/api/v1/videos/upload-chunk/",
            {"upload_id": upload_id, "chunk_index": 1, "total_chunks": 2, "chunk": chunk_1},
            format="multipart",
        )
        self.assertEqual(res_1.status_code, status.HTTP_200_OK)

        # 3. Complete Upload
        res_complete = self.client.post(
            "/api/v1/videos/upload-complete/",
            {
                "upload_id": upload_id,
                "title": "Intro Video Lesson",
                "total_chunks": 2,
                "file_name": "intro_lesson.mp4",
            },
            format="json",
        )
        self.assertEqual(res_complete.status_code, status.HTTP_201_CREATED)
        video_id = res_complete.data["id"]

        video = Video.objects.get(id=video_id)
        self.assertEqual(video.uploader, self.instructor)
        self.assertEqual(video.status, VideoStatus.READY)
        self.assertEqual(video.hls_master_playlist, f"/hls/{video.id}/master.m3u8")
        self.assertIn("720p", video.resolutions)
        self.assertIn("480p", video.resolutions)
        self.assertIn("360p", video.resolutions)

        # Verify master.m3u8 exists
        hls_dir = Path(settings.MEDIA_ROOT) / "hls" / str(video.id)
        master_file = hls_dir / "master.m3u8"
        self.assertTrue(master_file.exists())
        self.assertIn("720p.m3u8", master_file.read_text(encoding="utf-8"))


    def test_signed_stream_url_generation(self):
        """Verify Nginx secure_link token is generated and bound to student IP with 2-hour expiry."""
        video = Video.objects.create(
            title="Sample Video",
            uploader=self.instructor,
            status=VideoStatus.READY,
            hls_master_playlist="/hls/1/master.m3u8",
        )
        self.lesson.video = video
        self.lesson.save()

        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            f"/api/v1/lessons/{self.lesson.id}/signed-stream-url/",
            REMOTE_ADDR="197.35.40.12",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("signed_url", res.data)
        self.assertIn("token=", res.data["signed_url"])
        self.assertIn("expires=", res.data["signed_url"])
        self.assertEqual(res.data["expires_in_seconds"], 7200)
