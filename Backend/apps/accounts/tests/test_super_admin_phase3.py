import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User, UserRole
from apps.common.models import AuditLog, PlatformSettings


@pytest.mark.django_db
class TestSuperAdminContentThemePhase3:

    @pytest.fixture(autouse=True)
    def setup_admin(self):
        self.client = APIClient()

        self.super_admin = User.objects.create_user(
            email="superadmin_theme@mkanak.com",
            password="SuperPassword123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
        )

        refresh = RefreshToken.for_user(self.super_admin)
        refresh["is_2fa_verified"] = True
        access_token = refresh.access_token
        access_token["is_2fa_verified"] = True
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def test_public_settings_endpoint(self):
        url = reverse("v1:public-settings")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert "site_name" in res.data
        assert "primary_color" in res.data
        assert "hero_title" in res.data

    def test_super_admin_get_and_update_settings(self):
        url = reverse("v1:super-admin-settings")

        # GET
        res_get = self.client.get(url)
        assert res_get.status_code == status.HTTP_200_OK

        # PATCH
        update_payload = {
            "site_name": "Mkanak Academy Pro",
            "primary_color": "#10b981",
            "facebook_url": "https://facebook.com/mkanak_official",
            "hero_title": "المنصة الرائدة في الشرق الأوسط",
        }
        res_patch = self.client.patch(url, update_payload, format="json")
        assert res_patch.status_code == status.HTTP_200_OK
        assert res_patch.data["settings"]["site_name"] == "Mkanak Academy Pro"
        assert res_patch.data["settings"]["primary_color"] == "#10b981"

        # Verify AuditLog
        audit = AuditLog.objects.filter(action_type="PLATFORM_SETTINGS_UPDATED").first()
        assert audit is not None
        assert audit.actor == self.super_admin

    def test_super_admin_cdn_cache_invalidation(self):
        url = reverse("v1:super-admin-invalidate-cdn")
        initial_version = PlatformSettings.get_settings().cdn_cache_version

        res = self.client.post(url, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["cdn_cache_version"] == initial_version + 1

        # Verify AuditLog
        audit = AuditLog.objects.filter(action_type="CDN_CACHE_INVALIDATED").first()
        assert audit is not None
        assert audit.actor == self.super_admin
