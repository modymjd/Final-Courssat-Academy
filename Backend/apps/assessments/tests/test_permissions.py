from django.contrib.auth import get_user_model
from django.http import Http404
from django.test import RequestFactory, TestCase

from apps.accounts.models import GuardianProfile, StudentProfile, UserRole
from apps.assessments.models import AdminDisputeAuditLog, Exam, StudentExam
from apps.assessments.permissions import (
    IsAttemptOwnerOrInstructorOrGuardian,
    IsDisputeSupportAdmin,
    IsEnrolledWithActiveAccess,
)
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment

User = get_user_model()


class AssessmentPermissionsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.perm = IsAttemptOwnerOrInstructorOrGuardian()

        # Users
        self.instructor_a = User.objects.create_user(
            email="inst_a@test.com", password="Password123!", role=UserRole.INSTRUCTOR
        )
        self.instructor_b = User.objects.create_user(
            email="inst_b@test.com", password="Password123!", role=UserRole.INSTRUCTOR
        )
        self.student_a = User.objects.create_user(
            email="stud_a@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.profile_a, _ = StudentProfile.objects.get_or_create(user=self.student_a, defaults={"student_code": "STU-A"})
        if not self.profile_a.student_code:
            self.profile_a.student_code = "STU-A"
            self.profile_a.save()

        self.student_b = User.objects.create_user(
            email="stud_b@test.com", password="Password123!", role=UserRole.STUDENT
        )
        self.profile_b, _ = StudentProfile.objects.get_or_create(user=self.student_b, defaults={"student_code": "STU-B"})
        if not self.profile_b.student_code:
            self.profile_b.student_code = "STU-B"
            self.profile_b.save()

        self.guardian_a = User.objects.create_user(
            email="guard_a@test.com", password="Password123!", role=UserRole.GUARDIAN
        )
        GuardianProfile.objects.create(
            guardian_user=self.guardian_a,
            student_profile=self.profile_a,
            full_name="Parent A",
            relationship="father",
            phone="01011111111",
        )

        self.center_user = User.objects.create_user(
            email="center@test.com", password="Password123!", role=UserRole.CENTER
        )
        self.admin_user = User.objects.create_user(
            email="admin@test.com", password="Password123!", role=UserRole.ADMIN
        )
        self.super_admin = User.objects.create_user(
            email="superadmin@test.com", password="Password123!", role=UserRole.SUPER_ADMIN
        )

        # Course and Exam
        self.category = Category.objects.create(name="Math", slug="math")
        self.course_a = Course.objects.create(
            title="Course A", instructor=self.instructor_a, category=self.category
        )
        self.exam_a = Exam.objects.create(course=self.course_a, title="Exam A")
        self.attempt_a = StudentExam.objects.create(
            student=self.student_a, exam=self.exam_a, attempt_number=1
        )

    def test_student_can_only_view_own_attempt(self):
        req = self.factory.get("/")
        req.user = self.student_a
        self.assertTrue(self.perm.has_object_permission(req, None, self.attempt_a))

        # Student B viewing Student A's attempt must trigger Http404 (anti-IDOR)
        req.user = self.student_b
        with self.assertRaises(Http404):
            self.perm.has_object_permission(req, None, self.attempt_a)

    def test_instructor_can_only_view_own_course_students(self):
        req = self.factory.get("/")
        req.user = self.instructor_a
        self.assertTrue(self.perm.has_object_permission(req, None, self.attempt_a))

        # Other instructor gets Http404
        req.user = self.instructor_b
        with self.assertRaises(Http404):
            self.perm.has_object_permission(req, None, self.attempt_a)

    def test_guardian_can_only_view_linked_child(self):
        req = self.factory.get("/")
        req.user = self.guardian_a
        # Guardian A linked to Student A -> permitted on GET
        self.assertTrue(self.perm.has_object_permission(req, None, self.attempt_a))

        # Guardian A trying POST/write -> Http404
        req_post = self.factory.post("/")
        req_post.user = self.guardian_a
        with self.assertRaises(Http404):
            self.perm.has_object_permission(req_post, None, self.attempt_a)

    def test_center_and_normal_admin_get_404_on_grades(self):
        req = self.factory.get("/")
        # Center admin gets 404
        req.user = self.center_user
        with self.assertRaises(Http404):
            self.perm.has_object_permission(req, None, self.attempt_a)

        # Normal admin gets 404
        req.user = self.admin_user
        with self.assertRaises(Http404):
            self.perm.has_object_permission(req, None, self.attempt_a)

    def test_dispute_support_admin_requires_reason_and_logs(self):
        dispute_perm = IsDisputeSupportAdmin()

        # Request without reason fails
        req_no_reason = self.factory.get("/")
        req_no_reason.user = self.super_admin
        self.assertFalse(dispute_perm.has_permission(req_no_reason, None))

        # Request with reason passes and logs
        req_with_reason = self.factory.get("/", HTTP_X_DISPUTE_REASON="Student dispute regarding question 3")
        req_with_reason.user = self.super_admin
        self.assertTrue(dispute_perm.has_permission(req_with_reason, None))
        self.assertTrue(dispute_perm.has_object_permission(req_with_reason, None, self.attempt_a))

        # Verify audit log was created
        log = AdminDisputeAuditLog.objects.filter(
            admin=self.super_admin, student=self.student_a, exam=self.exam_a
        ).first()
        self.assertIsNotNone(log)
        self.assertIn("question 3", log.dispute_reason)
