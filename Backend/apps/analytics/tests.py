from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import StudentProfile
from apps.analytics.models import AchievementBadge, DailyLearningLog, UserAchievement
from apps.courses.models import Category, Course, CourseStatus, Lesson, Module
from apps.enrollments.models import Enrollment, LessonCompletion
from apps.enrollments.serializers import EnrollmentSerializer

User = get_user_model()


class EnrollmentProgressAndDashboardSummaryTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="instructor@test.local",
            password="Password123!",
            first_name="Instructor",
            last_name="Test",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="student@test.local",
            password="Password123!",
            first_name="Student",
            last_name="Test",
            role="student",
            profile_completed=True,
        )
        self.profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        self.profile.study_streak = 5
        self.profile.save()

        self.category = Category.objects.create(name="Computer Science", slug="cs")
        self.course = Course.objects.create(
            title="Python Mastery",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
        )
        self.module = Module.objects.create(course=self.course, title="Module 1", order=1)
        self.lesson1 = Lesson.objects.create(module=self.module, title="Lesson 1", order=1)
        self.lesson2 = Lesson.objects.create(module=self.module, title="Lesson 2", order=2)
        self.lesson3 = Lesson.objects.create(module=self.module, title="Lesson 3", order=3)
        self.lesson4 = Lesson.objects.create(module=self.module, title="Lesson 4", order=4)

        self.enrollment = Enrollment.objects.create(
            student=self.student,
            course=self.course,
        )

    def test_enrollment_progress_calculation(self):
        # 0 completions -> 0%
        self.assertEqual(self.enrollment.progress, 0)

        # 1 completion -> 25%
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson1)
        self.assertEqual(self.enrollment.progress, 25)

        # 2 completions -> 50%
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson2)
        self.assertEqual(self.enrollment.progress, 50)

        # 4 completions -> 100%
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson3)
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson4)
        self.assertEqual(self.enrollment.progress, 100)

    def test_enrollment_serializer_uses_progress(self):
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson1)
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson2)
        serializer = EnrollmentSerializer(self.enrollment)
        self.assertEqual(serializer.data["progress"], 50)

    def test_student_dashboard_summary_view_success(self):
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson1)
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson2)

        today = timezone.now().date()
        from apps.accounts.models import StudentProfile
        student_profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        student_profile.study_streak = 5
        student_profile.last_streak_date = today
        student_profile.save()

        DailyLearningLog.objects.create(
            user=self.student,
            date=today,
            minutes_spent=45,
            lessons_completed=2,
        )

        badge = AchievementBadge.objects.create(
            slug="first-streak",
            title="First Streak",
            description="5 days streak",
            xp_reward=100,
        )
        UserAchievement.objects.create(user=self.student, badge=badge)

        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/analytics/student/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["user_id"], self.student.id)
        self.assertEqual(data["streak_days"], 5)
        self.assertEqual(data["today_minutes"], 45)
        self.assertTrue(len(data["continue_courses"]) >= 1)

        course_item = data["continue_courses"][0]
        self.assertEqual(course_item["id"], self.course.id)
        self.assertEqual(course_item["progress_percent"], 50)
        self.assertEqual(course_item["title"], "Python Mastery")
        self.assertEqual(len(data["badges"]), 1)
        self.assertEqual(data["badges"][0]["slug"], "first-streak")
