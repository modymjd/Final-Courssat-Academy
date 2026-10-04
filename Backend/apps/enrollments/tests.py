from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.courses.models import Category, Course, CourseStatus, Lesson, LessonType, Module, Video
from apps.enrollments.models import Enrollment, LessonCompletion, LessonProgress

User = get_user_model()


class EnrollmentIsolationSecurityTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Sciences", slug="sciences")
        self.instructor = User.objects.create_user(
            email="ins@test.com", password="Password123!", role=UserRole.INSTRUCTOR
        )
        self.student_a = User.objects.create_user(
            email="student_a@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.student_b = User.objects.create_user(
            email="student_b@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.course_1 = Course.objects.create(
            title="Physics Course",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("150.00"),
            educational_stage="secondary",
            educational_grade="secondary_1",
            subject="physics",
        )
        self.course_2 = Course.objects.create(
            title="Chemistry Course",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("200.00"),
            educational_stage="secondary",
            educational_grade="secondary_1",
            subject="chemistry",
        )
        # Enroll Student A in Course 1
        self.enrollment_a = Enrollment.objects.create(
            student=self.student_a, course=self.course_1
        )

    def test_student_a_sees_own_enrollment(self):
        self.client.force_authenticate(user=self.student_a)
        response = self.client.get("/api/v1/enrollments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["course"]["id"], self.course_1.id)

    def test_student_b_does_not_see_student_a_enrollment(self):
        self.client.force_authenticate(user=self.student_b)
        response = self.client.get("/api/v1/enrollments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(len(results), 0)

    def test_student_b_course_id_query_param_returns_empty(self):
        self.client.force_authenticate(user=self.student_b)
        response = self.client.get(f"/api/v1/enrollments/?course_id={self.course_1.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(len(results), 0)

    def test_security_cache_control_headers_present(self):
        self.client.force_authenticate(user=self.student_a)
        response = self.client.get("/api/v1/enrollments/")
        self.assertIn("no-store", response.get("Cache-Control", ""))
        self.assertIn("private", response.get("Cache-Control", ""))


class LessonProgressSecurityAndThresholdTests(APITestCase):
    def setUp(self):
        from apps.courses.models import Lesson, LessonType, Module

        self.category = Category.objects.create(name="Sciences 2", slug="sciences-2")
        self.instructor = User.objects.create_user(
            email="ins2@test.com", password="Password123!", role=UserRole.INSTRUCTOR
        )
        self.student_a = User.objects.create_user(
            email="student_a2@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.student_b = User.objects.create_user(
            email="student_b2@test.com", password="Password123!", role=UserRole.STUDENT
        )

        # Course 1
        self.course_1 = Course.objects.create(
            title="Physics Course 2",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("150.00"),
        )
        self.module_1 = Module.objects.create(course=self.course_1, title="Unit 1", order=1)
        self.video_1 = Video.objects.create(
            title="Lesson 1 Video",
            uploader=self.instructor,
            duration_seconds=100,
        )
        self.lesson_1 = Lesson.objects.create(
            module=self.module_1,
            title="Lesson 1",
            type=LessonType.VIDEO,
            duration="01:40",
            video=self.video_1,
            order=1,
        )

        # Course 2 (Student A is NOT enrolled)
        self.course_2 = Course.objects.create(
            title="Chemistry Course 2",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("200.00"),
        )
        self.module_2 = Module.objects.create(course=self.course_2, title="Unit 2", order=1)
        self.lesson_2 = Lesson.objects.create(
            module=self.module_2,
            title="Lesson 2",
            type=LessonType.VIDEO,
            duration="02:00",
            order=1,
        )

        # Enroll Student A in Course 1 only
        self.enrollment_a = Enrollment.objects.create(
            student=self.student_a, course=self.course_1
        )

    def test_first_write_capped_to_30_seconds(self):
        self.client.force_authenticate(user=self.student_a)
        response = self.client.put(
            f"/api/v1/lessons/{self.lesson_1.id}/progress/",
            {"position_seconds": 90, "final": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        # Resume position preserves actual location (90s)
        self.assertEqual(response.data["last_position_seconds"], 90)
        # Anti-cheat: max position is strictly capped to <= 30 seconds
        self.assertEqual(response.data["max_position_seconds"], 30)

    def test_seeking_to_end_is_anti_cheat_clamped(self):
        self.client.force_authenticate(user=self.student_a)

        # Establish first write
        self.client.put(
            f"/api/v1/lessons/{self.lesson_1.id}/progress/",
            {"position_seconds": 10, "final": False},
            format="json",
        )

        # Attempt to jump to 99 seconds immediately
        response = self.client.put(
            f"/api/v1/lessons/{self.lesson_1.id}/progress/",
            {"position_seconds": 99, "final": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Resume point records actual seek (99)
        self.assertEqual(response.data["last_position_seconds"], 99)
        # Anti-cheat clamp: max position capped to ~13-15s (10 + min(elapsed, 120)*2.5 + 3), far below 99
        self.assertLess(response.data["max_position_seconds"], 35)

    def test_spammed_final_true_is_also_clamped(self):
        self.client.force_authenticate(user=self.student_a)
        # First write
        self.client.put(
            f"/api/v1/lessons/{self.lesson_1.id}/progress/",
            {"position_seconds": 15, "final": True},
            format="json",
        )
        # Spam final immediately
        response = self.client.put(
            f"/api/v1/lessons/{self.lesson_1.id}/progress/",
            {"position_seconds": 100, "final": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLess(response.data["max_position_seconds"], 40)

    def test_unenrolled_student_returns_403(self):
        self.client.force_authenticate(user=self.student_b)
        response = self.client.put(
            f"/api/v1/lessons/{self.lesson_1.id}/progress/",
            {"position_seconds": 10},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_course_idor_returns_403(self):
        # Student A tries to update lesson 2 from Course 2 where they are not enrolled
        self.client.force_authenticate(user=self.student_a)
        response = self.client.put(
            f"/api/v1/lessons/{self.lesson_2.id}/progress/",
            {"position_seconds": 10},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_legacy_lesson_completion_backward_compatibility(self):
        # Create legacy completion without LessonProgress
        LessonCompletion.objects.create(enrollment=self.enrollment_a, lesson=self.lesson_1)

        self.client.force_authenticate(user=self.student_a)
        response = self.client.post(
            f"/api/v1/enrollments/{self.enrollment_a.id}/complete-lesson/",
            {"lesson_id": self.lesson_1.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_complete_lesson_enforces_90_percent_when_enabled(self):
        from django.test import override_settings

        self.client.force_authenticate(user=self.student_a)

        # Set progress to 40 seconds out of 100s video
        LessonProgress.objects.create(
            enrollment=self.enrollment_a,
            lesson=self.lesson_1,
            last_position_seconds=40,
            max_position_seconds=40,
        )

        with override_settings(ENFORCE_WATCH_THRESHOLD=True):
            # Attempt to complete with only 40% watched
            response = self.client.post(
                f"/api/v1/enrollments/{self.enrollment_a.id}/complete-lesson/",
                {"lesson_id": self.lesson_1.id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.data.get("watched_percent"), 40)

            # Advance progress to 95 seconds
            LessonProgress.objects.filter(enrollment=self.enrollment_a, lesson=self.lesson_1).update(
                max_position_seconds=95
            )

            # Attempt to complete with 95% watched
            response_ok = self.client.post(
                f"/api/v1/enrollments/{self.enrollment_a.id}/complete-lesson/",
                {"lesson_id": self.lesson_1.id},
                format="json",
            )
            self.assertEqual(response_ok.status_code, status.HTTP_200_OK)

    def test_lesson_without_duration_allows_completion(self):
        from django.test import override_settings
        # Create lesson with 0 duration
        lesson_nodur = Lesson.objects.create(
            module=self.module_1,
            title="Lesson No Duration",
            type=LessonType.VIDEO,
            duration="",
            video=None,
            order=2,
        )

        self.client.force_authenticate(user=self.student_a)
        with override_settings(ENFORCE_WATCH_THRESHOLD=True):
            response = self.client.post(
                f"/api/v1/enrollments/{self.enrollment_a.id}/complete-lesson/",
                {"lesson_id": lesson_nodur.id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_course_detail_18_lessons_no_n_plus_one_queries(self):
        bulk_course = Course.objects.create(
            title="Massive Course 18 Lessons",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("100.00"),
            educational_stage="secondary",
            educational_grade="secondary_1",
            subject="physics",
        )
        mod1 = Module.objects.create(course=bulk_course, title="Module A", order=1)
        mod2 = Module.objects.create(course=bulk_course, title="Module B", order=2)
        lessons = []
        for i in range(1, 10):
            lessons.append(Lesson(module=mod1, title=f"L1-{i}", type=LessonType.VIDEO, order=i, duration="10:00"))
        for i in range(1, 10):
            lessons.append(Lesson(module=mod2, title=f"L2-{i}", type=LessonType.VIDEO, order=i, duration="10:00"))
        Lesson.objects.bulk_create(lessons)

        Enrollment.objects.create(student=self.student_a, course=bulk_course)

        self.client.force_authenticate(user=self.student_a)
        # Total queries must not scale with 18 lessons (no N+1 queries, exactly 8 queries total)
        with self.assertNumQueries(8):
            response = self.client.get(f"/api/v1/courses/{bulk_course.id}/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            modules_data = response.data.get("modules", [])
            total_serialized_lessons = sum(len(m.get("lessons", [])) for m in modules_data)
            self.assertEqual(total_serialized_lessons, 18)

    def test_put_progress_query_count_write_and_throttled(self):
        self.client.force_authenticate(user=self.student_a)

        # 1. Write path: exactly 4 application queries (3 SELECTs + 1 INSERT) + 2 transaction savepoints = 6
        with self.assertNumQueries(6):
            response = self.client.put(
                f"/api/v1/lessons/{self.lesson_1.id}/progress/",
                {"position_seconds": 15, "final": False},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["status"], "ok")

        # 2. Throttled path: exactly 3 application SELECT queries + 2 transaction savepoints = 5 (0 writes)
        with self.assertNumQueries(5):
            response_throttled = self.client.put(
                f"/api/v1/lessons/{self.lesson_1.id}/progress/",
                {"position_seconds": 18, "final": False},
                format="json",
            )
            self.assertEqual(response_throttled.status_code, status.HTTP_200_OK)
            self.assertEqual(response_throttled.data["status"], "throttled")

