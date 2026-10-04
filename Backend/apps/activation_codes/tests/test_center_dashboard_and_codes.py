import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CenterInstructor, CenterProfile, InstructorProfile, UserRole
from apps.activation_codes.models import (
    ActivationCode,
    ActivationCodeBatch,
    CenterQuotaRequest,
    CodeQuotaContract,
)
from apps.courses.models import Course

User = get_user_model()


@pytest.mark.django_db
class TestCenterDashboardAndCodes:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.client = APIClient()

        # Create Center user & profile
        self.center_user = User.objects.create_user(
            email="center_test@example.com",
            password="Password123!",
            first_name="مركز",
            last_name="المستقبل",
            role=UserRole.CENTER,
            profile_completed=True,
        )
        self.center_profile, _ = CenterProfile.objects.get_or_create(
            user=self.center_user,
            defaults={
                "institution_name": "مركز المستقبل التعليمي",
                "institution_type": "center",
            },
        )
        self.center_profile.institution_name = "مركز المستقبل التعليمي"
        self.center_profile.save()

        # Create Instructor 1
        self.instructor1 = User.objects.create_user(
            email="teacher1@example.com",
            password="Password123!",
            first_name="أحمد",
            last_name="علي",
            role=UserRole.INSTRUCTOR,
            profile_completed=True,
        )
        self.instructor_profile, _ = InstructorProfile.objects.get_or_create(
            user=self.instructor1,
            defaults={"teacher_uid": "TCH-001", "specialization": "فيزياء"},
        )
        self.instructor_profile.teacher_uid = "TCH-001"
        self.instructor_profile.specialization = "فيزياء"
        self.instructor_profile.save()

        from apps.courses.models import Category

        self.category = Category.objects.create(name="علوم", slug="science")

        # Create Course for Instructor 1
        self.course1 = Course.objects.create(
            title="فيزياء الثانوية العامة",
            instructor=self.instructor1,
            category=self.category,
            price=200,
        )

        # Create Super Admin
        self.super_admin = User.objects.create_user(
            email="superadmin@example.com",
            password="Password123!",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
            profile_completed=True,
        )

    def test_center_cannot_generate_codes_without_instructors(self):
        """Center with 0 instructors should be strictly blocked from generating codes."""
        self.client.force_authenticate(user=self.center_user)

        res = self.client.post(
            "/api/v1/activation-codes/batches/",
            {
                "batch_type": "center_student",
                "quantity": 10,
                "target_instructor_id": self.instructor1.id,
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "معلم واحد على الأقل" in res.data["error"]

    def test_center_generates_codes_bound_to_target_instructor(self):
        """When an instructor is linked, center can generate codes bound to that instructor."""
        # Link Instructor 1 to Center
        CenterInstructor.objects.create(
            center=self.center_profile,
            instructor=self.instructor1,
            subject="فيزياء",
            is_active=True,
        )

        self.client.force_authenticate(user=self.center_user)

        res = self.client.post(
            "/api/v1/activation-codes/batches/",
            {
                "batch_type": "center_student",
                "quantity": 5,
                "target_instructor_id": self.instructor1.id,
                "course_ids": [self.course1.id],
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        batch_id = res.data["id"]

        batch = ActivationCodeBatch.objects.get(id=batch_id)
        assert batch.target_instructor == self.instructor1
        assert batch.quantity == 5
        assert batch.codes.count() == 5

    def test_center_quota_request_flow(self):
        """Center can request additional quota above available limit, and admin can approve it."""
        self.client.force_authenticate(user=self.center_user)

        # Create a quota request
        req_res = self.client.post(
            "/api/v1/activation-codes/quota-requests/",
            {
                "requested_quantity": 100,
                "reason": "توسع السنتر وفتح فرع جديد",
            },
        )
        assert req_res.status_code == status.HTTP_201_CREATED
        request_id = req_res.data["id"]

        quota_req = CenterQuotaRequest.objects.get(id=request_id)
        assert quota_req.status == CenterQuotaRequest.Status.PENDING
        assert quota_req.requested_quantity == 100

        # Super Admin reviews and approves
        self.client.force_authenticate(user=self.super_admin)
        review_res = self.client.post(
            f"/api/v1/activation-codes/quota-requests/{request_id}/review/",
            {
                "action": "approve",
                "admin_notes": "تمت الموافقة للفرع الجديد",
            },
        )
        assert review_res.status_code == status.HTTP_200_OK

        quota_req.refresh_from_db()
        assert quota_req.status == CenterQuotaRequest.Status.APPROVED

    def test_center_overview_preserves_teacher_privacy(self):
        """Overview endpoint should return total active students without per-teacher breakdowns."""
        CenterInstructor.objects.create(
            center=self.center_profile,
            instructor=self.instructor1,
            subject="فيزياء",
            is_active=True,
        )

        self.client.force_authenticate(user=self.center_user)

        res = self.client.get("/api/v1/accounts/center/overview/")
        assert res.status_code == status.HTTP_200_OK
        data = res.data

        assert "kpis" in data
        assert "total_active_students" in data["kpis"]
        assert "subscription" in data
        assert "onboarding" in data
        assert "instructor_student_breakdown" not in data["kpis"]

    def test_cross_course_code_validation_guardrail(self):
        """Redemption must be rejected if code is for Course A but submitted on Course B checkout."""
        from django.utils import timezone
        from datetime import timedelta
        from apps.enrollments.models import Enrollment

        # Create Course 2
        course2 = Course.objects.create(
            title="كيمياء الثانوية العامة",
            instructor=self.instructor1,
            category=self.category,
            price=150,
            status="published",
        )

        # Create batch specifically for Course 1
        batch = ActivationCodeBatch.objects.create(
            batch_type=ActivationCodeBatch.BatchType.COURSE_ACCESS,
            created_by=self.instructor1,
            quantity=1,
            price_per_code=100,
            expires_at=timezone.now() + timedelta(days=30),
        )
        batch.courses.add(self.course1)

        code_obj = ActivationCode.objects.create(
            batch=batch,
            code="ES-PHYSICS1",
            password="PIN123",
            status=ActivationCode.CodeStatus.ACTIVE,
        )

        student = User.objects.create_user(
            email="student_guardrail@example.com",
            password="Password123!",
            first_name="علي",
            last_name="حسن",
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=student)

        # 1. Validation with mismatched course_id must fail
        val_res = self.client.post(
            "/api/v1/activation-codes/validate/",
            {"code": "ES-PHYSICS1", "password": "PIN123", "course_id": course2.id},
        )
        assert val_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "هذا الكود مخصص لدورة" in val_res.data["error"]

        # 2. Redemption with mismatched course_id must fail
        red_res = self.client.post(
            "/api/v1/activation-codes/redeem/",
            {"code": "ES-PHYSICS1", "password": "PIN123", "course_id": course2.id},
        )
        assert red_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "هذا الكود مخصص لدورة" in red_res.data["error"]
        assert not Enrollment.objects.filter(student=student).exists()

        # 3. Redemption with matching course_id succeeds
        good_res = self.client.post(
            "/api/v1/activation-codes/redeem/",
            {"code": "ES-PHYSICS1", "password": "PIN123", "course_id": self.course1.id},
        )
        assert good_res.status_code == status.HTTP_200_OK
        assert Enrollment.objects.filter(student=student, course=self.course1).exists()

    def test_center_bundle_automatic_stage_resolution(self):
        """Center student bundle automatically enrolls student in each instructor's latest matching course."""
        from django.utils import timezone
        from datetime import timedelta
        from apps.accounts.models import InstructorProfile, StudentProfile
        from apps.enrollments.models import Enrollment

        # Instructor 1 course for secondary_2
        self.course1.status = "published"
        self.course1.educational_stage = "secondary"
        self.course1.educational_grade = "secondary_2"
        self.course1.save()

        # Link Instructor 1 to center
        CenterInstructor.objects.create(
            center=self.center_profile,
            instructor=self.instructor1,
            subject="فيزياء",
            is_active=True,
        )

        # Create Instructor 2 and link to center
        instructor2 = User.objects.create_user(
            email="math_teacher@example.com",
            password="Password123!",
            first_name="محمود",
            last_name="سامي",
            role=UserRole.INSTRUCTOR,
            profile_completed=True,
        )
        instructor_profile2, _ = InstructorProfile.objects.get_or_create(user=instructor2)
        instructor_profile2.teacher_uid = "TCH-002"
        instructor_profile2.specialization = "رياضيات"
        instructor_profile2.save()

        CenterInstructor.objects.create(
            center=self.center_profile,
            instructor=instructor2,
            subject="رياضيات",
            is_active=True,
        )

        # Create matching course for Instructor 2
        course_math = Course.objects.create(
            title="جبر وتفاضل الصف الثاني الثانوي",
            instructor=instructor2,
            category=self.category,
            price=200,
            status="published",
            educational_stage="secondary",
            educational_grade="secondary_2",
        )

        # Center bundle batch
        center_batch = ActivationCodeBatch.objects.create(
            batch_type=ActivationCodeBatch.BatchType.CENTER_STUDENT,
            created_by=self.center_user,
            quantity=1,
            price_per_code=350,
            expires_at=timezone.now() + timedelta(days=30),
        )
        center_code = ActivationCode.objects.create(
            batch=center_batch,
            code="CTR-BUNDLE1",
            password="PIN456",
            status=ActivationCode.CodeStatus.ACTIVE,
        )

        # Student with profile: secondary_2
        student = User.objects.create_user(
            email="student_bundle@example.com",
            password="Password123!",
            first_name="سارة",
            last_name="أحمد",
            role=UserRole.STUDENT,
        )
        student_profile, _ = StudentProfile.objects.get_or_create(user=student)
        student_profile.education_level = "secondary"
        student_profile.grade_level = "secondary_2"
        student_profile.educational_track = "scientific_science"
        student_profile.save()

        self.client.force_authenticate(user=student)
        res = self.client.post(
            "/api/v1/activation-codes/redeem/",
            {"code": "CTR-BUNDLE1", "password": "PIN456"},
        )
        assert res.status_code == status.HTTP_200_OK

        # Verify enrolled in both teachers' courses matching secondary_2
        assert Enrollment.objects.filter(student=student, course=self.course1).exists()
        assert Enrollment.objects.filter(student=student, course=course_math).exists()

    def test_instructor_quota_request_and_approval_flow(self):
        """Instructors can submit quota requests, with center=None, and approval grants quota."""
        self.client.force_authenticate(user=self.instructor1)

        req_res = self.client.post(
            "/api/v1/activation-codes/quota-requests/",
            {
                "requested_quantity": 25,
                "reason": "بدء دورة مكثفة لطلاب جدد",
            },
        )
        assert req_res.status_code == status.HTTP_201_CREATED
        data = req_res.data
        assert data["center_id"] is None
        assert data["requested_by_name"] == self.instructor1.full_name
        assert data["requested_by_role"] == "instructor"

        request_id = data["id"]
        quota_req = CenterQuotaRequest.objects.get(id=request_id)
        assert quota_req.center is None
        assert quota_req.requested_by == self.instructor1
        assert "QuotaRequest" in str(quota_req)

        # Admin approves
        self.client.force_authenticate(user=self.super_admin)
        review_res = self.client.post(
            f"/api/v1/activation-codes/quota-requests/{request_id}/review/",
            {
                "action": "approve",
                "admin_notes": "معتمد للمعلم",
            },
        )
        assert review_res.status_code == status.HTTP_200_OK
        assert review_res.data["granted_quantity"] == 25

        quota_req.refresh_from_db()
        assert quota_req.status == CenterQuotaRequest.Status.APPROVED

        # Verify instructor's quota was actually increased
        from apps.activation_codes.services.quota import QuotaService

        snapshot = QuotaService.get_quota_snapshot(self.instructor1)
        assert snapshot["max_limit"] == 26  # default 1 + 25
        assert snapshot["available"] == 26

    def test_quick_grant_action_by_super_admin(self):
        """Super Admin can use quick-grant to directly allocate quota."""
        self.client.force_authenticate(user=self.super_admin)

        res = self.client.post(
            "/api/v1/super-admin/quota-contracts/quick-grant/",
            {
                "owner_id": self.instructor1.id,
                "additional_quantity": 75,
                "notes": "Direct grant via admin dashboard",
            },
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["message"] == "تم تعديل ومنح الكوتة بنجاح"
        assert res.data["quota"]["max_limit"] == 76
        assert res.data["quota"]["available"] == 76

    def test_super_admin_create_contract_deactivates_older(self):
        """Creating an active contract automatically deactivates prior active contract."""
        from django.utils import timezone

        self.client.force_authenticate(user=self.super_admin)

        c1_res = self.client.post(
            "/api/v1/super-admin/quota-contracts/",
            {
                "owner": self.instructor1.id,
                "monthly_code_limit": 100,
                "billing_unit_size": 100,
                "price_per_billing_unit": "500.00",
                "currency": "EGP",
                "effective_from": str(timezone.localdate()),
                "is_active": True,
            },
        )
        assert c1_res.status_code == status.HTTP_201_CREATED
        c1_id = c1_res.data["id"]

        c2_res = self.client.post(
            "/api/v1/super-admin/quota-contracts/",
            {
                "owner": self.instructor1.id,
                "monthly_code_limit": 200,
                "billing_unit_size": 100,
                "price_per_billing_unit": "800.00",
                "currency": "EGP",
                "effective_from": str(timezone.localdate()),
                "is_active": True,
            },
        )
        assert c2_res.status_code == status.HTTP_201_CREATED
        c2_id = c2_res.data["id"]

        c1 = CodeQuotaContract.objects.get(id=c1_id)
        c2 = CodeQuotaContract.objects.get(id=c2_id)
        assert c1.is_active is False
        assert c2.is_active is True
        assert c2_res.data["current_available"] == 200
        assert c2_res.data["current_generated"] == 0
