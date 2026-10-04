import pytest
from django.core.exceptions import PermissionDenied
from rest_framework.test import APIRequestFactory

from apps.accounts.models import User, UserRole
from apps.accounts.serializers import RoleChangeSerializer
from apps.common.models import AuditLog, mask_sensitive_data
from apps.common.permissions import IsSuperAdmin


@pytest.mark.django_db
class TestSuperAdminPhase0:

    def test_super_admin_role_enum(self):
        assert UserRole.SUPER_ADMIN == "super_admin"
        user = User.objects.create_user(
            email="superadmin@mkanak.com",
            password="Password123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
        )
        assert user.role == "super_admin"

    def test_role_change_serializer_protection(self):
        factory = APIRequestFactory()

        # Regular admin trying to promote someone to SUPER_ADMIN
        admin_user = User.objects.create_user(
            email="admin@mkanak.com",
            password="Password123!",
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
        )
        request = factory.post("/")
        request.user = admin_user

        serializer = RoleChangeSerializer(data={"role": "super_admin"}, context={"request": request})
        assert not serializer.is_valid()
        assert "role" in serializer.errors

    def test_audit_log_immutability(self):
        log = AuditLog.objects.create(
            action_type="TEST_ACTION",
            target_model="TestModel",
            target_id="123",
            new_value={"key": "value"},
        )
        assert log.id is not None

        # Attempting to save existing log raises PermissionDenied
        with pytest.raises(PermissionDenied):
            log.action_type = "MODIFIED_ACTION"
            log.save()

        # Attempting to delete log raises PermissionDenied
        with pytest.raises(PermissionDenied):
            log.delete()

    def test_sensitive_data_masking(self):
        data = {
            "username": "john_doe",
            "password": "SecretPassword123!",
            "api_key": "sk-proj-1234567890",
            "nested": {
                "secret": "super_secret_value",
                "normal": "normal_value",
            },
        }
        masked = mask_sensitive_data(data)
        assert masked["username"] == "john_doe"
        assert masked["password"] == "****123!"
        assert masked["api_key"] == "****7890"
        assert masked["nested"]["secret"] == "****alue"
        assert masked["nested"]["normal"] == "normal_value"

    def test_is_super_admin_permission(self):
        perm = IsSuperAdmin()
        factory = APIRequestFactory()

        super_user = User.objects.create_user(
            email="sa@mkanak.com",
            password="Password123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
        )

        # Without 2FA claim -> False
        req1 = factory.get("/")
        req1.user = super_user
        req1.auth = {}
        assert perm.has_permission(req1, None) is False

        # With 2FA verified claim -> True
        req2 = factory.get("/")
        req2.user = super_user
        req2.auth = {"is_2fa_verified": True}
        assert perm.has_permission(req2, None) is True
