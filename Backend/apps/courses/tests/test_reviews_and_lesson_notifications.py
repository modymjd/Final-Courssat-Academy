from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import StudentProfile, UserRole
from apps.courses.models import Category, Course, CourseStatus, Lesson, Module, Review
from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification, NotificationType

User = get_user_model()


class CourseReviewsAndLessonNotificationsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.category = Category.objects.create(name="Science", slug="science")
        cls.instructor = User.objects.create_user(
            email="instructor_review@test.local",
            password="Password123!",
            first_name="Tariq",
            last_name="Instructor",
            role=UserRole.INSTRUCTOR,
            profile_completed=True,
        )
        cls.student = User.objects.create_user(
            email="student_enrolled@test.local",
            password="Password123!",
            first_name="Ahmed",
            last_name="Student",
            role=UserRole.STUDENT,
            profile_completed=True,
        )
        cls.outsider = User.objects.create_user(
            email="student_outsider@test.local",
            password="Password123!",
            first_name="Mona",
            last_name="Student",
            role=UserRole.STUDENT,
            profile_completed=True,
        )
        cls.course = Course.objects.create(
            title="Physics Secondary 1",
            category=cls.category,
            instructor=cls.instructor,
            status=CourseStatus.PUBLISHED,
            price=Decimal("150.00"),
        )
        cls.module = Module.objects.create(course=cls.course, title="Module 1", order=1)
        Enrollment.objects.create(student=cls.student, course=cls.course)

    def test_enrolled_student_can_submit_and_read_course_review(self):
        self.client.force_authenticate(user=self.student)
        url = f"/api/v1/courses/{self.course.id}/reviews/"

        # POST review
        post_res = self.client.post(url, {"rating": 5, "comment": "دورة ممتازة وشرح وافي جداً"})
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_res.data["rating"], 5)
        self.assertEqual(post_res.data["comment"], "دورة ممتازة وشرح وافي جداً")
        self.assertEqual(post_res.data["student_name"], "Ahmed Student")

        # GET reviews
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        results = get_res.data.get("results", get_res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["rating"], 5)

        # Course aggregate rating updated
        self.course.refresh_from_db()
        self.assertEqual(self.course.rating, 5.0)
        self.assertEqual(self.course.review_count, 1)

    def test_unenrolled_student_cannot_submit_review(self):
        self.client.force_authenticate(user=self.outsider)
        url = f"/api/v1/courses/{self.course.id}/reviews/"
        res = self.client.post(url, {"rating": 4, "comment": "لم أسجل بعد"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_user_can_read_reviews(self):
        Review.objects.create(course=self.course, student=self.student, rating=4, comment="جيد جداً")
        url = f"/api/v1/courses/{self.course.id}/reviews/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)

    def test_new_lesson_creation_notifies_enrolled_students(self):
        self.client.force_authenticate(user=self.instructor)
        url = "/api/v1/lessons/"
        payload = {
            "module": self.module.id,
            "title": "الدرس الأول: الحركة الموجية",
            "type": "video",
            "order": 1,
            "is_free": False,
        }

        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        lesson_id = res.data["id"]

        # Enrolled student should receive notification
        notif = Notification.objects.filter(
            user=self.student,
            type=NotificationType.COURSE_UPDATE,
            action_url=f"/lesson/{self.course.id}/{lesson_id}",
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("الدرس الأول: الحركة الموجية", notif.title)
        self.assertIn("Physics Secondary 1", notif.message)

        # Unenrolled student should NOT receive notification
        self.assertFalse(
            Notification.objects.filter(
                user=self.outsider,
                type=NotificationType.COURSE_UPDATE,
                action_url=f"/lesson/{self.course.id}/{lesson_id}",
            ).exists()
        )

    def test_student_dashboard_records_streak_activity(self):
        self.client.force_authenticate(user=self.student)
        profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        self.assertEqual(profile.study_streak, 0)

        url = "/api/v1/dashboard/student/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        profile.refresh_from_db()
        self.assertEqual(profile.study_streak, 1)
        self.assertIsNotNone(profile.last_streak_date)

    def test_exam_publish_notifies_enrolled_students(self):
        from apps.assessments.models import Exam

        exam = Exam.objects.create(
            title="امتحان الفيزياء الشهري",
            course=self.course,
            duration_minutes=45,
            max_score=30,
            attempts_allowed=2,
            is_published=False,
        )

        self.client.force_authenticate(user=self.instructor)
        url = f"/api/v1/exams/{exam.id}/publish/"
        res = self.client.post(url, {"is_published": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        exam.refresh_from_db()
        self.assertTrue(exam.is_published)

        notif = Notification.objects.filter(
            user=self.student,
            type=NotificationType.EXAM,
            action_url=f"/exam/{exam.id}",
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("امتحان الفيزياء الشهري", notif.title)

    def test_student_profile_curriculum_and_guardian_update(self):
        self.client.force_authenticate(user=self.student)
        url = "/api/v1/accounts/me/"
        payload = {
            "education_level": "secondary",
            "grade_level": "secondary_3",
            "educational_track": "scientific_science",
            "school_name": "مدرسة المتفوقين",
            "second_language": "french",
            "religion": "islamic",
            "guardian": {
                "full_name": "سامي محمد",
                "phone": "01012345678",
                "relationship": "father",
            },
        }
        res = self.client.patch(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        sp = res.data.get("student_profile", {})
        self.assertEqual(sp.get("education_level"), "secondary")
        self.assertEqual(sp.get("grade_level"), "secondary_3")
        self.assertEqual(sp.get("educational_track"), "scientific_science")
        self.assertEqual(sp.get("guardian", {}).get("full_name"), "سامي محمد")

    def test_exam_patch_publish_notifies_enrolled_students(self):
        from apps.assessments.models import Exam

        exam = Exam.objects.create(
            title="امتحان دوري عبر التعديل",
            course=self.course,
            duration_minutes=30,
            max_score=20,
            is_published=False,
        )

        self.client.force_authenticate(user=self.instructor)
        url = f"/api/v1/exams/{exam.id}/"
        res = self.client.patch(url, {"is_published": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        notif = Notification.objects.filter(
            user=self.student,
            type=NotificationType.EXAM,
            action_url=f"/exam/{exam.id}",
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("امتحان دوري عبر التعديل", notif.title)
