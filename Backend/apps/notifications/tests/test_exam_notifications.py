from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import GuardianProfile, StudentProfile
from apps.assessments.models import Exam
from apps.assessments.tasks import notify_exam_audience_task
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment

from apps.notifications.models import Notification, NotificationType

User = get_user_model()


class ExamAudienceNotificationTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Notification Tests", slug="notification-tests")
        self.instructor = User.objects.create_user(
            email="notification-instructor@test.local",
            password="Password123!",
            first_name="Notification",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="notification-student@test.local",
            password="Password123!",
            first_name="Notification",
            last_name="Student",
            role="student",
            profile_completed=True,
        )
        self.guardian = User.objects.create_user(
            email="notification-guardian@test.local",
            password="Password123!",
            first_name="Notification",
            last_name="Guardian",
            role="guardian",
            profile_completed=True,
        )
        self.student_profile = StudentProfile.objects.get(user=self.student)
        GuardianProfile.objects.create(
            guardian_user=self.guardian,
            student_profile=self.student_profile,
            full_name="Notification Guardian",
            relationship="father",
            phone="01000000000",
        )
        self.course = Course.objects.create(
            title="Notification Course",
            category=self.category,
            instructor=self.instructor,
            status="published",
            price=Decimal("100.00"),
        )
        Enrollment.objects.create(student=self.student, course=self.course)
        self.exam = Exam.objects.create(
            title="Published Exam",
            course=self.course,
            duration_minutes=30,
            max_score=20,
            attempts_allowed=1,
            is_published=True,
        )

    def test_published_exam_notifies_student_and_guardian(self):
        created = notify_exam_audience_task.run(self.exam.id)

        self.assertEqual(created, 2)
        self.assertEqual(Notification.objects.filter(type=NotificationType.EXAM).count(), 2)
        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                type=NotificationType.EXAM,
                action_url=f"/exam/{self.exam.id}",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.guardian,
                type=NotificationType.EXAM,
                action_url=f"/exam/{self.exam.id}",
            ).exists()
        )

    def test_notification_task_is_idempotent(self):
        self.assertEqual(notify_exam_audience_task.run(self.exam.id), 2)
        self.assertEqual(notify_exam_audience_task.run(self.exam.id), 0)
        self.assertEqual(
            Notification.objects.filter(
                type=NotificationType.EXAM,
                action_url=f"/exam/{self.exam.id}",
            ).count(),
            2,
        )

    def test_unpublished_exam_does_not_notify(self):
        self.exam.is_published = False
        self.exam.save(update_fields=["is_published", "updated_at"])

        self.assertEqual(notify_exam_audience_task.run(self.exam.id), 0)
        self.assertFalse(Notification.objects.filter(type=NotificationType.EXAM).exists())

    def test_draft_to_published_queues_once(self):
        draft = Exam.objects.create(
            title="Draft Exam",
            course=self.course,
            duration_minutes=30,
            max_score=20,
            attempts_allowed=1,
            is_published=False,
        )

        with patch("apps.assessments.signals.notify_exam_audience_task.delay") as delay_mock:
            with self.captureOnCommitCallbacks(execute=True):
                draft.is_published = True
                draft.save(update_fields=["is_published", "updated_at"])

            self.assertEqual(delay_mock.call_count, 1)
            delay_mock.assert_called_once_with(draft.id)

            with self.captureOnCommitCallbacks(execute=True):
                draft.title = "Draft Exam Updated"
                draft.save(update_fields=["title", "updated_at"])

            self.assertEqual(delay_mock.call_count, 1)
