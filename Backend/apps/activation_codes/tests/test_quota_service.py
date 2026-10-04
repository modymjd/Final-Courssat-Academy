from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.accounts.models import UserRole
from apps.activation_codes.models import CodeQuotaContract, CodeQuotaPeriod
from apps.activation_codes.services.quota import QuotaService

User = get_user_model()


class TestQuotaService(TestCase):
    def create_user(self, role, email):
        return User.objects.create_user(
            email=email,
            password="Password123!",
            first_name="Test",
            last_name="User",
            role=role,
            profile_completed=True,
        )

    def test_default_limits_are_role_specific(self):
        instructor = self.create_user(UserRole.INSTRUCTOR, "quota-instructor@example.com")
        center = self.create_user(UserRole.CENTER, "quota-center@example.com")

        self.assertEqual(QuotaService.get_default_limit(instructor), 1)
        self.assertEqual(QuotaService.get_default_limit(center), 50)

    def test_reservation_is_atomic_and_cannot_exceed_monthly_limit(self):
        instructor = self.create_user(UserRole.INSTRUCTOR, "quota-atomic@example.com")

        with patch("apps.activation_codes.services.quota.timezone.localdate", return_value=date(2026, 9, 2)):
            period = QuotaService.reserve_generation(instructor, 1)
            self.assertEqual(period.generated_count, 1)
            self.assertEqual(QuotaService.get_available_quota(instructor), 0)

            with self.assertRaises(ValidationError):
                QuotaService.reserve_generation(instructor, 1)

            period.refresh_from_db()
            self.assertEqual(period.generated_count, 1)
            self.assertEqual(QuotaService.get_available_quota(instructor), 0)

    def test_billing_uses_monthly_capacity_not_redemption_count(self):
        instructor = self.create_user(UserRole.INSTRUCTOR, "quota-billing@example.com")
        contract = CodeQuotaContract.objects.create(
            owner=instructor,
            monthly_code_limit=200,
            billing_unit_size=100,
            price_per_billing_unit="2500.00",
            currency="EGP",
            effective_from=date(2026, 9, 1),
        )

        with patch("apps.activation_codes.services.quota.timezone.localdate", return_value=date(2026, 9, 2)):
            period = QuotaService._get_current_period(contract)

        self.assertEqual(period.billed_units, 2)
        self.assertEqual(period.billed_amount, 5000)
        self.assertEqual(period.available_count, 200)

    def test_monthly_snapshot_survives_future_contract_change(self):
        instructor = self.create_user(UserRole.INSTRUCTOR, "quota-history@example.com")
        contract = CodeQuotaContract.objects.create(
            owner=instructor,
            monthly_code_limit=100,
            billing_unit_size=100,
            price_per_billing_unit="2500.00",
            currency="EGP",
            effective_from=date(2026, 9, 1),
        )

        with patch("apps.activation_codes.services.quota.timezone.localdate", return_value=date(2026, 9, 2)):
            period = QuotaService._get_current_period(contract)

        contract.monthly_code_limit = 500
        contract.price_per_billing_unit = "10000.00"
        contract.save(update_fields=["monthly_code_limit", "price_per_billing_unit", "updated_at"])

        period.refresh_from_db()
        self.assertEqual(period.monthly_code_limit_snapshot, 100)
        self.assertEqual(period.price_per_billing_unit_snapshot, 2500)
        self.assertEqual(period.billed_amount, 2500)
        self.assertTrue(CodeQuotaPeriod.objects.filter(pk=period.pk).exists())

    def test_grant_or_adjust_quota_additional_quantity(self):
        instructor = self.create_user(UserRole.INSTRUCTOR, "quota-grant-add@example.com")
        admin = self.create_user(UserRole.SUPER_ADMIN, "admin-grant@example.com")

        with patch("apps.activation_codes.services.quota.timezone.localdate", return_value=date(2026, 9, 2)):
            snapshot = QuotaService.grant_or_adjust_quota(
                user=instructor,
                additional_quantity=50,
                notes="Bonus quota for outstanding performance",
                actor=admin,
            )

        self.assertEqual(snapshot["available"], 51)  # 1 default + 50
        self.assertEqual(snapshot["max_limit"], 51)
        contract = CodeQuotaContract.objects.get(owner=instructor, is_active=True)
        self.assertEqual(contract.monthly_code_limit, 51)
        self.assertIn("Bonus quota", contract.notes)

        from apps.finance.models import DetailedAuditLog
        audit = DetailedAuditLog.objects.filter(entity_type="CodeQuotaContract", entity_id=contract.id).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.action, "QUOTA_GRANTED_OR_ADJUSTED")
        self.assertEqual(audit.actor, admin)

    def test_grant_or_adjust_quota_new_monthly_limit(self):
        center = self.create_user(UserRole.CENTER, "quota-grant-limit@example.com")

        with patch("apps.activation_codes.services.quota.timezone.localdate", return_value=date(2026, 9, 2)):
            snapshot = QuotaService.grant_or_adjust_quota(
                user=center,
                new_monthly_limit=500,
                billing_unit_size=50,
                price_per_billing_unit="1200.00",
            )

        self.assertEqual(snapshot["available"], 500)
        self.assertEqual(snapshot["max_limit"], 500)
        self.assertEqual(snapshot["billing_unit_size"], 50)
        self.assertEqual(snapshot["price_per_billing_unit"], "1200.00")

    def test_grant_or_adjust_quota_invalid_role(self):
        student = self.create_user(UserRole.STUDENT, "quota-student@example.com")
        with self.assertRaises(ValidationError):
            QuotaService.grant_or_adjust_quota(user=student, additional_quantity=10)

    def test_grant_or_adjust_quota_invalid_inputs(self):
        instructor = self.create_user(UserRole.INSTRUCTOR, "quota-invalid-inputs@example.com")
        with self.assertRaises(ValidationError):
            QuotaService.grant_or_adjust_quota(user=instructor, additional_quantity=-5)
        with self.assertRaises(ValidationError):
            QuotaService.grant_or_adjust_quota(user=instructor, new_monthly_limit=0)
