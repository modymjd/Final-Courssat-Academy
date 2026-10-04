from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.assessments.models import Exam, ExamKind, StudentExam, StudentExamStatus
from apps.courses.models import Category, Course, CourseStatus, Lesson, LessonType, Module, Video
from apps.enrollments.models import Enrollment, LessonCompletion


class LessonProgressionAccessTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.instructor = User.objects.create_user(
            email="gate-instructor@example.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        cls.student = User.objects.create_user(
            email="gate-student@example.com",
            password="Password123!",
            role=UserRole.STUDENT,
        )
        category = Category.objects.create(name="Gate Category", slug="gate-category")
        cls.course = Course.objects.create(
            title="Gated Course",
            instructor=cls.instructor,
            category=category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("0.00"),
            is_free=True,
            enforce_quiz_gate=True,
        )
        module = Module.objects.create(course=cls.course, title="Unit 1", order=1)
        video = Video.objects.create(
            title="Gate Video",
            uploader=cls.instructor,
            status="ready",
            duration_seconds=100,
        )
        cls.first_lesson = Lesson.objects.create(
            module=module,
            title="First Lesson",
            type=LessonType.VIDEO,
            video=video,
            order=1,
        )
        cls.second_lesson = Lesson.objects.create(
            module=module,
            title="Second Lesson",
            type=LessonType.VIDEO,
            video=video,
            video_url="https://cdn.example.com/locked.m3u8",
            content="locked lesson content",
            order=2,
        )
        cls.quiz = Exam.objects.create(
            course=cls.course,
            lesson=cls.first_lesson,
            title="First Lesson Quiz",
            kind=ExamKind.LESSON_QUIZ,
            pass_threshold=70,
            is_published=True,
        )
        cls.enrollment = Enrollment.objects.create(student=cls.student, course=cls.course)

    def setUp(self):
        self.client.force_authenticate(self.student)

    def _unlock_second_lesson(self):
        LessonCompletion.objects.create(
            enrollment=self.enrollment,
            lesson=self.first_lesson,
        )
        StudentExam.objects.create(
            student=self.student,
            exam=self.quiz,
            score=Decimal("70.00"),
            is_passed=True,
            status=StudentExamStatus.GRADED,
        )

    def test_locked_lesson_cannot_be_retrieved_directly(self):
        response = self.client.get(f"/api/v1/lessons/{self.second_lesson.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "lesson_locked")

    def test_locked_lesson_cannot_be_retrieved_through_course_nested_route(self):
        response = self.client.get(
            f"/api/v1/courses/{self.course.id}/lessons/{self.second_lesson.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "lesson_locked")

    def test_locked_lesson_cannot_issue_stream_url(self):
        response = self.client.post(
            f"/api/v1/lessons/{self.second_lesson.id}/signed-stream-url/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "lesson_locked")

    def test_locked_lesson_cannot_accept_progress(self):
        response = self.client.put(
            f"/api/v1/lessons/{self.second_lesson.id}/progress/",
            {"position_seconds": 20},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "lesson_locked")

    def test_course_detail_exposes_lock_state_and_reason(self):
        response = self.client.get(f"/api/v1/courses/{self.course.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        second = response.data["modules"][0]["lessons"][1]
        self.assertTrue(second["is_locked"])
        self.assertIn("الدرس السابق", second["lock_reason"])
        self.assertEqual(second["video_url"], "")
        self.assertEqual(second["content"], "")
        self.assertTrue(response.data["enforce_quiz_gate"])

    def test_passing_previous_quiz_unlocks_next_lesson(self):
        self._unlock_second_lesson()

        response = self.client.get(f"/api/v1/lessons/{self.second_lesson.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)