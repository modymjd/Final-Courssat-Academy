from decimal import Decimal
import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User, UserRole
from apps.accounts.overview_views import super_admin_overview
from apps.finance.models import Order, OrderStatusChoices


@pytest.mark.django_db
class TestSuperAdminPhase1Overview:

    def test_overview_unauthenticated_or_unauthorized_fails(self):
        factory = APIRequestFactory()

        # 1. Anonymous request -> 401
        request = factory.get("/api/v1/super-admin/overview/")
        response = super_admin_overview(request)
        assert response.status_code == 401

        # 2. Regular Admin without super_admin role -> 403
        admin_user = User.objects.create_user(
            email="admin_phase1@mkanak.com",
            password="Password123!",
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
        )
        request = factory.get("/api/v1/super-admin/overview/")
        force_authenticate(request, user=admin_user, token={})
        response = super_admin_overview(request)
        assert response.status_code == 403

        # 3. Super Admin without 2FA claim -> 403
        super_admin = User.objects.create_user(
            email="sa_phase1@mkanak.com",
            password="Password123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
        )
        request = factory.get("/api/v1/super-admin/overview/")
        force_authenticate(request, user=super_admin, token={})
        response = super_admin_overview(request)
        assert response.status_code == 403

    def test_overview_success_with_2fa_verified(self):
        factory = APIRequestFactory()

        super_admin = User.objects.create_user(
            email="sa_telemetry@mkanak.com",
            password="Password123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
        )

        student = User.objects.create_user(
            email="student1@mkanak.com",
            password="Password123!",
            first_name="Student",
            last_name="One",
            role=UserRole.STUDENT,
        )

        # Create completed financial order
        Order.objects.create(
            student=student,
            status=OrderStatusChoices.COMPLETED,
            subtotal=Decimal("500.00"),
            total=Decimal("500.00"),
        )

        request = factory.get("/api/v1/super-admin/overview/")
        force_authenticate(request, user=super_admin, token={"is_2fa_verified": True})

        response = super_admin_overview(request)
        assert response.status_code == 200

        data = response.data
        assert "server" in data
        assert "cpu_percent" in data["server"]
        assert "ram_percent" in data["server"]
        assert "database" in data["server"]
        assert data["server"]["database"]["status"] == "healthy"

        assert "analytics" in data
        assert data["analytics"]["total_students"] >= 1
        assert data["analytics"]["revenue"]["total_all_time"] == 500.0
        assert "alerts" in data
