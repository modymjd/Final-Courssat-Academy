import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.courses.models import Category, Course, CourseStatus, Lesson, LessonType, Module, Video
from apps.enrollments.models import Enrollment, StudentNote

User = get_user_model()


class StudentNoteTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Mathematics", slug="math")
        self.instructor = User.objects.create_user(
            email="teacher@test.com", password="Password123!", role=UserRole.INSTRUCTOR
        )
        self.student_a = User.objects.create_user(
            email="student_a_notes@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.student_b = User.objects.create_user(
            email="student_b_notes@test.com", password="Password123!", role=UserRole.STUDENT
        )

        self.course_1 = Course.objects.create(
            title="Algebra Basics",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("100.00"),
            educational_stage="secondary",
            educational_grade="secondary_1",
            subject="math",
        )
        self.module_1 = Module.objects.create(course=self.course_1, title="Unit 1", order=1)
        self.video_1 = Video.objects.create(
            title="Intro Video",
            uploader=self.instructor,
            duration_seconds=300,
        )
        self.lesson_1 = Lesson.objects.create(
            module=self.module_1,
            title="Lesson 1: Intro",
            type=LessonType.VIDEO,
            duration="5:00",
            order=1,
            video=self.video_1,
        )

        self.course_2 = Course.objects.create(
            title="Geometry Basics",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("100.00"),
            educational_stage="secondary",
            educational_grade="secondary_1",
            subject="math",
        )
        self.module_2 = Module.objects.create(course=self.course_2, title="Unit 1 Geo", order=1)
        self.lesson_2 = Lesson.objects.create(
            module=self.module_2,
            title="Lesson 1: Shapes",
            type=LessonType.VIDEO,
            duration="10:00",
            order=1,
        )

        # Enroll Student A in Course 1
        self.enrollment_a = Enrollment.objects.create(student=self.student_a, course=self.course_1)

    def test_notes_idor_isolation_returns_404(self):
        """Student B cannot view, edit, or delete Student A's note — returns 404 Not Found."""
        note = StudentNote.objects.create(
            student=self.student_a,
            course=self.course_1,
            lesson=self.lesson_1,
            title="Student A Secret Note",
            content="Private study note",
            timestamp_seconds=60,
        )

        self.client.force_authenticate(user=self.student_b)

        # GET detail returns 404
        response = self.client.get(f"/api/v1/notes/{note.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # PUT returns 404
        response = self.client.put(
            f"/api/v1/notes/{note.id}/",
            {"title": "Hacked Title", "content": "Hacked Content"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # DELETE returns 404
        response = self.client.delete(f"/api/v1/notes/{note.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Note is unchanged in database
        note.refresh_from_db()
        self.assertEqual(note.title, "Student A Secret Note")

    def test_note_creation_unenrolled_course_forbidden(self):
        """Student B cannot add a note to Course 1 without active enrollment."""
        self.client.force_authenticate(user=self.student_b)

        response = self.client.post(
            "/api/v1/notes/",
            {
                "course_id": self.course_1.id,
                "title": "Unauthorized note",
                "content": "Trying to write to course 1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("course_id", errors)

    def test_note_creation_mismatched_lesson_and_course(self):
        """Specifying a lesson from course 2 with course 1 must fail validation."""
        self.client.force_authenticate(user=self.student_a)

        response = self.client.post(
            "/api/v1/notes/",
            {
                "course_id": self.course_1.id,
                "lesson_id": self.lesson_2.id,  # lesson_2 belongs to course_2
                "title": "Mismatched note",
                "content": "This should fail",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("lesson_id", errors)

    def test_bulk_import_idempotency_with_client_id(self):
        """Importing the same batch of notes twice with client_id must upsert without duplicates."""
        self.client.force_authenticate(user=self.student_a)

        cid_1 = str(uuid.uuid4())
        cid_2 = str(uuid.uuid4())

        payload = {
            "notes": [
                {
                    "client_id": cid_1,
                    "course_id": self.course_1.id,
                    "lesson_id": self.lesson_1.id,
                    "title": "First Import Note 1",
                    "content": "Content 1",
                    "timestamp_seconds": 45,
                    "tags": ["summary", "math"],
                    "color": "#3b82f6",
                    "is_pinned": True,
                },
                {
                    "client_id": cid_2,
                    "title": "General Unbound Note",
                    "content": "Freeform notebook content",
                    "tags": ["personal"],
                    "color": "#10b981",
                    "is_pinned": False,
                },
            ]
        }

        # First import
        res1 = self.client.post("/api/v1/notes/bulk-import/", payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["imported_count"], 2)
        self.assertIn(cid_1, res1.data["mapping"])
        self.assertIn(cid_2, res1.data["mapping"])
        self.assertEqual(StudentNote.objects.filter(student=self.student_a).count(), 2)

        # Second import with same client_ids (updated content)
        payload["notes"][0]["content"] = "Content 1 Updated"
        res2 = self.client.post("/api/v1/notes/bulk-import/", payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["imported_count"], 2)
        # Total count in DB is still 2!
        self.assertEqual(StudentNote.objects.filter(student=self.student_a).count(), 2)

        note_1 = StudentNote.objects.get(student=self.student_a, client_id=cid_1)
        self.assertEqual(note_1.content, "Content 1 Updated")

    def test_reject_future_creation_dates(self):
        """Notes with created_at > 5 minutes in the future are rejected."""
        self.client.force_authenticate(user=self.student_a)

        future_date = (timezone.now() + timedelta(days=2)).isoformat()

        response = self.client.post(
            "/api/v1/notes/",
            {
                "course_id": self.course_1.id,
                "title": "Time Traveler Note",
                "content": "From the future",
                "created_at": future_date,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("created_at", errors)

    def test_bulk_import_max_500_limit(self):
        """Bulk import payload exceeding 500 items returns 400 Bad Request."""
        self.client.force_authenticate(user=self.student_a)

        oversized_notes = [
            {
                "client_id": str(uuid.uuid4()),
                "title": f"Note {i}",
                "content": f"Content {i}",
            }
            for i in range(501)
        ]

        response = self.client.post(
            "/api/v1/notes/bulk-import/",
            {"notes": oversized_notes},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_content_plain_text_and_5000_limit(self):
        """HTML tags are stripped and text exceeding 5,000 chars is rejected."""
        self.client.force_authenticate(user=self.student_a)

        # 1. HTML stripping
        response = self.client.post(
            "/api/v1/notes/",
            {
                "course_id": self.course_1.id,
                "title": "HTML Note",
                "content": "<script>alert('xss')</script><b>Bold Note</b>",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["content"], "alert('xss')Bold Note")

        # 2. Exceeding 5,000 characters
        long_content = "A" * 5001
        response = self.client.post(
            "/api/v1/notes/",
            {
                "course_id": self.course_1.id,
                "title": "Long Note",
                "content": long_content,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("content", errors)

    def test_notes_list_num_queries_pagination(self):
        """Fetching notes list is efficient and uses constant queries with select_related."""
        self.client.force_authenticate(user=self.student_a)

        # Create 15 notes for Student A
        notes = [
            StudentNote(
                student=self.student_a,
                course=self.course_1,
                lesson=self.lesson_1,
                title=f"Note {i}",
                content=f"Content {i}",
                client_id=uuid.uuid4(),
            )
            for i in range(15)
        ]
        StudentNote.objects.bulk_create(notes)

        # 1 query for session/user (if any), 1 for count, 1 for notes with select_related (course, lesson)
        with self.assertNumQueries(2):  # 1 count query + 1 select_related query
            response = self.client.get("/api/v1/notes/?pageSize=10")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(response.data["data"]), 10)
            self.assertEqual(response.data["total"], 15)
