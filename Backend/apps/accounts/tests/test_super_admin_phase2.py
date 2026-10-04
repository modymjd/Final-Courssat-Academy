import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User, UserRole
from apps.common.models import AuditLog


@pytest.mark.django_db
class TestSuperAdminUserManagementPhase2:

    @pytest.fixture(autouse=True)
    def setup_users(self):
        self.client = APIClient()

        # Create Super Admin
        self.super_admin = User.objects.create_user(
            email="superadmin_test@mkanak.com",
            password="SuperPassword123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
        )

        # Generate 2FA verified token
        refresh = RefreshToken.for_user(self.super_admin)
        refresh["is_2fa_verified"] = True
        access_token = refresh.access_token
        access_token["is_2fa_verified"] = True
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        # Create regular users
        self.student = User.objects.create_user(
            email="student_test@mkanak.com",
            password="StudentPass123!",
            first_name="Student",
            last_name="One",
            role=UserRole.STUDENT,
        )

        self.instructor = User.objects.create_user(
            email="instructor_test@mkanak.com",
            password="InstructorPass123!",
            first_name="Instructor",
            last_name="Two",
            role=UserRole.INSTRUCTOR,
            is_staff=True,
        )

    def test_list_users_and_filters(self):
        url = reverse("v1:super-admin-users-list")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        data = res.data.get("data", res.data.get("results", res.data))
        assert len(data) >= 3

        # Filter by role=student
        res_student = self.client.get(f"{url}?role=student")
        assert res_student.status_code == status.HTTP_200_OK
        data_student = res_student.data.get("data", res_student.data.get("results", res_student.data))
        assert len(data_student) == 1
        assert data_student[0]["email"] == self.student.email

        # Search filter
        res_search = self.client.get(f"{url}?search=instructor")
        assert res_search.status_code == status.HTTP_200_OK
        data_search = res_search.data.get("data", res_search.data.get("results", res_search.data))
        assert len(data_search) == 1
        assert data_search[0]["email"] == self.instructor.email


    def test_retrieve_user_details(self):
        url = reverse("v1:super-admin-users-detail", kwargs={"pk": self.student.pk})
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["email"] == self.student.email
        assert "password" not in res.data
        assert "coursesEnrolled" in res.data
        assert "paymentHistory" in res.data

    def test_suspend_and_activate_user(self):
        suspend_url = reverse("v1:super-admin-users-suspend", kwargs={"pk": self.student.pk})
        res_suspend = self.client.post(suspend_url, {"reason": "Violation of policy"}, format="json")
        assert res_suspend.status_code == status.HTTP_200_OK
        self.student.refresh_from_db()
        assert self.student.is_active is False

        # Verify AuditLog entry
        audit_suspend = AuditLog.objects.filter(action_type="USER_SUSPENDED", target_id=str(self.student.id)).first()
        assert audit_suspend is not None
        assert audit_suspend.actor == self.super_admin

        # Activate user
        activate_url = reverse("v1:super-admin-users-activate", kwargs={"pk": self.student.pk})
        res_activate = self.client.post(activate_url, format="json")
        assert res_activate.status_code == status.HTTP_200_OK
        self.student.refresh_from_db()
        assert self.student.is_active is True

        audit_activate = AuditLog.objects.filter(action_type="USER_ACTIVATED", target_id=str(self.student.id)).first()
        assert audit_activate is not None

    def test_change_user_role(self):
        url = reverse("v1:super-admin-users-change-role", kwargs={"pk": self.student.pk})
        res = self.client.post(url, {"role": "instructor"}, format="json")
        assert res.status_code == status.HTTP_200_OK
        self.student.refresh_from_db()
        assert self.student.role == UserRole.INSTRUCTOR

        audit = AuditLog.objects.filter(action_type="USER_ROLE_CHANGED", target_id=str(self.student.id)).first()
        assert audit is not None
        assert audit.new_value.get("role") == "instructor"

    def test_reset_password_link_trigger(self):
        url = reverse("v1:super-admin-users-reset-password-link", kwargs={"pk": self.student.pk})
        res = self.client.post(url, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert "message" in res.data
        # Ensure password or password hash is NEVER exposed
        assert "password" not in str(res.data)
        assert "token" not in res.data

        audit = AuditLog.objects.filter(action_type="USER_PASSWORD_RESET_REQUESTED", target_id=str(self.student.id)).first()
        assert audit is not None

    def test_delete_user_with_typed_confirmation(self):
        url = reverse("v1:super-admin-users-detail", kwargs={"pk": self.student.pk})

        # Mismatched confirm_email fails
        res_bad = self.client.delete(url, {"confirm_email": "wrong@mkanak.com"}, format="json")
        assert res_bad.status_code == status.HTTP_400_BAD_REQUEST

        # Matching confirm_email succeeds
        res_good = self.client.delete(url, {"confirm_email": self.student.email}, format="json")
        assert res_good.status_code == status.HTTP_200_OK
        assert User.objects.filter(pk=self.student.pk).exists() is False

        audit = AuditLog.objects.filter(action_type="USER_DELETED", target_id=str(self.student.id)).first()
        assert audit is not None
