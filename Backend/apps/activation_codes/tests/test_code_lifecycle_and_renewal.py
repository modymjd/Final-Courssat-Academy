from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.activation_codes.models import ActivationCode, ActivationCodeBatch
from apps.activation_codes.services.code_generator import CodeGeneratorService
from apps.activation_codes.services.redemption import RedemptionService
from apps.courses.models import Category, Course, CourseStatus, Lesson, LessonType, Module
from apps.enrollments.models import Enrollment, LessonCompletion

User = get_user_model()


class ActivationCodeLifecycleAndRenewalTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="teacher_lifecycle@example.com",
            password="Password123!",
            first_name="Ahmed",
            last_name="Ali",
            role=UserRole.INSTRUCTOR,
            profile_completed=True,
        )
        from apps.activation_codes.models import CodeQuotaContract
        CodeQuotaContract.objects.create(
            owner=self.instructor,
            monthly_code_limit=500,
            billing_unit_size=100,
            price_per_billing_unit=Decimal("0.00"),
            currency="EGP",
            effective_from=date(2026, 1, 1),
        )
        self.student = User.objects.create_user(
            email="student_lifecycle@example.com",
            password="Password123!",
            first_name="Khaled",
            last_name="Omar",
            role=UserRole.STUDENT,
            profile_completed=True,
        )
        self.category = Category.objects.create(name="Mathematics", slug="math")
        self.course = Course.objects.create(
            title="Algebra 101",
            instructor=self.instructor,
            category=self.category,
            price=Decimal("150.00"),
            status=CourseStatus.PUBLISHED,
        )
        self.module = Module.objects.create(course=self.course, title="Module 1", order=1)
        self.lesson = Lesson.objects.create(
            module=self.module,
            title="Lesson 1 - Equations",
            type=LessonType.VIDEO,
            duration="10:00",
            order=1,
            is_free=False,
        )

    def test_enrollment_model_lifecycle_properties(self):
        now = timezone.now()

        # 1. Lifetime enrollment
        lifetime_enrollment = Enrollment.objects.create(
            student=self.student,
            course=self.course,
            expires_at=None,
        )
        self.assertTrue(lifetime_enrollment.is_lifetime)
        self.assertFalse(lifetime_enrollment.is_expired)
        self.assertFalse(lifetime_enrollment.is_in_grace_period)
        self.assertTrue(lifetime_enrollment.has_active_access)
        self.assertEqual(lifetime_enrollment.access_status, Enrollment.EnrollmentStatus.ACTIVE)

        # 2. Active duration enrollment
        active_enrollment = Enrollment(
            student=self.student,
            course=self.course,
            expires_at=now + timedelta(days=20),
        )
        self.assertFalse(active_enrollment.is_lifetime)
        self.assertFalse(active_enrollment.is_expired)
        self.assertFalse(active_enrollment.is_in_grace_period)
        self.assertTrue(active_enrollment.has_active_access)
        self.assertEqual(active_enrollment.access_status, Enrollment.EnrollmentStatus.ACTIVE)

        # 3. Grace period enrollment (expired 1 day ago <= 3 days)
        grace_enrollment = Enrollment(
            student=self.student,
            course=self.course,
            expires_at=now - timedelta(days=1),
        )
        self.assertFalse(grace_enrollment.is_lifetime)
        self.assertTrue(grace_enrollment.is_expired)
        self.assertTrue(grace_enrollment.is_in_grace_period)
        self.assertTrue(grace_enrollment.has_active_access)
        self.assertEqual(grace_enrollment.access_status, Enrollment.EnrollmentStatus.GRACE_PERIOD)

        # 4. Fully expired enrollment (expired 5 days ago > 3 days)
        expired_enrollment = Enrollment(
            student=self.student,
            course=self.course,
            expires_at=now - timedelta(days=5),
        )
        self.assertFalse(expired_enrollment.is_lifetime)
        self.assertTrue(expired_enrollment.is_expired)
        self.assertFalse(expired_enrollment.is_in_grace_period)
        self.assertFalse(expired_enrollment.has_active_access)
        self.assertEqual(expired_enrollment.access_status, Enrollment.EnrollmentStatus.EXPIRED)

    def test_enrollment_queryset_active_access(self):
        now = timezone.now()
        student2 = User.objects.create_user(email="s2@example.com", password="Password123!", role=UserRole.STUDENT)
        student3 = User.objects.create_user(email="s3@example.com", password="Password123!", role=UserRole.STUDENT)
        student4 = User.objects.create_user(email="s4@example.com", password="Password123!", role=UserRole.STUDENT)

        course2 = Course.objects.create(title="C2", instructor=self.instructor, category=self.category, price=100)
        course3 = Course.objects.create(title="C3", instructor=self.instructor, category=self.category, price=100)
        course4 = Course.objects.create(title="C4", instructor=self.instructor, category=self.category, price=100)

        e1 = Enrollment.objects.create(student=self.student, course=self.course, expires_at=None)
        e2 = Enrollment.objects.create(student=student2, course=course2, expires_at=now + timedelta(days=10))
        e3 = Enrollment.objects.create(student=student3, course=course3, expires_at=now - timedelta(days=2))  # Grace period
        e4 = Enrollment.objects.create(student=student4, course=course4, expires_at=now - timedelta(days=7))  # Expired

        active_ids = list(Enrollment.objects.active_access().values_list("id", flat=True))
        self.assertIn(e1.id, active_ids)
        self.assertIn(e2.id, active_ids)
        self.assertIn(e3.id, active_ids)
        self.assertNotIn(e4.id, active_ids)

    def test_pin_verification_accepts_arabic_digits(self):
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            courses=[self.course],
        )
        code = batch.codes.first()
        assert code is not None

        arabic_pin = str(code.password).translate(
            str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
        )
        self.assertEqual(
            RedemptionService._verify_pin(code, arabic_pin),
            True,
        )

    def test_batch_creation_with_duration_and_shelf_life(self):
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=5,
            courses=[self.course],
            access_duration_days=30,
            shelf_life_days=60,
        )

        self.assertEqual(batch.access_duration_days, 30)
        self.assertIsNone(batch.fixed_access_until)
        self.assertEqual(batch.codes.count(), 5)
        # Verify shelf life calculation
        diff_days = (batch.expires_at.date() - timezone.now().date()).days
        self.assertAlmostEqual(diff_days, 60, delta=2)

    def test_extend_shelf_life_endpoint(self):
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=2,
            courses=[self.course],
            shelf_life_days=10,
        )

        self.client.force_authenticate(user=self.instructor)
        response = self.client.post(
            f"/api/v1/activation-codes/batches/{batch.id}/extend-shelf-life/",
            {"additional_days": 45},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        batch.refresh_from_db()
        diff_days = (batch.expires_at.date() - timezone.now().date()).days
        self.assertAlmostEqual(diff_days, 55, delta=2)
        self.assertIn("تم تمديد صلاحية شحن الدفعة بنجاح", response.data["message"])

    def test_expired_code_cannot_be_redeemed_or_validated(self):
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            courses=[self.course],
            expires_at=timezone.now() - timedelta(days=5),
        )
        code = batch.codes.first()

        self.client.force_authenticate(user=self.student)

        # Validate
        val_res = self.client.post(
            "/api/v1/activation-codes/validate/",
            {"code": code.code, "password": code.password},
            format="json",
        )
        self.assertEqual(val_res.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = str(val_res.data.get("error", ""))
        self.assertIn("منتهي الصلاحية", error_msg)

        # Redeem
        red_res = self.client.post(
            "/api/v1/activation-codes/redeem/",
            {"code": code.code, "password": code.password},
            format="json",
        )
        self.assertEqual(red_res.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg_red = str(red_res.data.get("error", ""))
        self.assertIn("منتهي الصلاحية", error_msg_red)

    def test_smart_additive_subscription_renewal(self):
        # 1. First code: 30 days
        batch1 = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            courses=[self.course],
            access_duration_days=30,
        )
        code1 = batch1.codes.first()

        # Student redeems first code
        res1 = RedemptionService.redeem_code(
            user=self.student,
            code_str=code1.code,
            password=code1.password,
        )
        self.assertFalse(res1["is_renewal"])
        enrollment = Enrollment.objects.get(student=self.student, course=self.course)
        initial_expires_at = enrollment.expires_at
        self.assertIsNotNone(initial_expires_at)

        # Student completes a lesson
        completion = LessonCompletion.objects.create(enrollment=enrollment, lesson=self.lesson)

        # 2. Second code: renewal for another 30 days
        batch2 = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            courses=[self.course],
            access_duration_days=30,
        )
        code2 = batch2.codes.first()

        # Validate renewal projection
        code2_validated = RedemptionService.validate_code(
            code_str=code2.code,
            password=code2.password,
            expected_course_id=self.course.id,
            user=self.student,
        )
        self.assertTrue(code2_validated.is_renewal)
        expected_projected = initial_expires_at + timedelta(days=30)
        self.assertEqual(code2_validated.new_projected_expires_at.date(), expected_projected.date())

        # Redeem renewal
        res2 = RedemptionService.redeem_code(
            user=self.student,
            code_str=code2.code,
            password=code2.password,
        )
        self.assertTrue(res2["is_renewal"])
        enrollment.refresh_from_db()

        # Additive expiry check: initial + 30 days = ~60 days from now
        expected_expiry = initial_expires_at + timedelta(days=30)
        self.assertEqual(enrollment.expires_at.date(), expected_expiry.date())

        # Verify LessonCompletion remains 100% intact!
        self.assertTrue(LessonCompletion.objects.filter(id=completion.id).exists())
        self.assertEqual(enrollment.lesson_completions.count(), 1)

    def test_fixed_access_until_redemption(self):
        fixed_target_date = (timezone.now() + timedelta(days=90)).date()
        batch = CodeGeneratorService.generate_batch(
            user=self.instructor,
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            quantity=1,
            courses=[self.course],
            fixed_access_until=fixed_target_date,
        )
        code = batch.codes.first()

        res = RedemptionService.redeem_code(
            user=self.student,
            code_str=code.code,
            password=code.password,
        )
        enrollment = Enrollment.objects.get(student=self.student, course=self.course)
        self.assertEqual(enrollment.expires_at.date(), fixed_target_date)

    def test_lesson_access_gating_for_expired_subscription(self):
        # 1. Enrolled but expired beyond grace period (4 days ago)
        enrollment = Enrollment.objects.create(
            student=self.student,
            course=self.course,
            expires_at=timezone.now() - timedelta(days=4),
            status=Enrollment.EnrollmentStatus.ACTIVE,
        )
        self.client.force_authenticate(user=self.student)

        # Retrieve lesson via CourseViewSet get_lesson
        res_get_lesson = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.lesson.id}/")
        self.assertEqual(res_get_lesson.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res_get_lesson.data.get("code"), "subscription_expired")
        self.assertTrue(res_get_lesson.data.get("can_renew"))

        # LessonViewSet retrieve
        res_lesson_retrieve = self.client.get(f"/api/v1/lessons/{self.lesson.id}/")
        self.assertEqual(res_lesson_retrieve.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res_lesson_retrieve.data.get("code"), "subscription_expired")

        # Update progress
        res_progress = self.client.put(
            f"/api/v1/lessons/{self.lesson.id}/progress/",
            {"position_seconds": 10},
            format="json",
        )
        self.assertEqual(res_progress.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res_progress.data.get("code"), "subscription_expired")

        # Signed streaming HLS URL
        res_stream = self.client.post(f"/api/v1/lessons/{self.lesson.id}/signed-stream-url/")
        self.assertEqual(res_stream.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res_stream.data.get("code"), "subscription_expired")

        # Course detail includes access_status 'expired'
        res_course = self.client.get(f"/api/v1/courses/{self.course.id}/")
        self.assertEqual(res_course.status_code, status.HTTP_200_OK)
        self.assertEqual(res_course.data.get("access_status"), "expired")
        self.assertTrue(res_course.data.get("is_enrolled"))

    def test_lesson_access_permitted_during_grace_period(self):
        # Enrolled and expired 1 day ago (within 3-day grace period)
        Enrollment.objects.create(
            student=self.student,
            course=self.course,
            expires_at=timezone.now() - timedelta(days=1),
            status=Enrollment.EnrollmentStatus.ACTIVE,
        )
        self.client.force_authenticate(user=self.student)

        # Access is still permitted
        res_get_lesson = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.lesson.id}/")
        self.assertEqual(res_get_lesson.status_code, status.HTTP_200_OK)

        # Course detail shows grace_period
        res_course = self.client.get(f"/api/v1/courses/{self.course.id}/")
        self.assertEqual(res_course.status_code, status.HTTP_200_OK)
        self.assertEqual(res_course.data.get("access_status"), "grace_period")
