from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CenterProfile, User, UserRole
from apps.finance.models import AcademicInvoiceStatus, AcademicQuotationInvoice, PricingPlan, PlanTypeChoices, Subscription, SubscriptionStatusChoices
from apps.finance.services.academic_pricing import AcademicPricingEngine


class AcademicPricingEngineTest(TestCase):
    def test_pricing_formulas_volume_tiers(self):
        """Volume pricing:
        - 100 students (<300) @ 30 EGP = 3,000 EGP / month
        - 300 students (300-599) @ 25 EGP = 7,500 EGP / month
        - 600 students (600+) @ 20 EGP = 12,000 EGP / month
        """
        quote_100 = AcademicPricingEngine.calculate_quote(100, "monthly", start_date=date(2026, 9, 1))
        self.assertEqual(quote_100["student_unit_price"], 30.0)
        self.assertEqual(quote_100["monthly_base_price"], 3000.0)
        self.assertEqual(quote_100["net_total"], 3000.0)

        quote_300 = AcademicPricingEngine.calculate_quote(300, "monthly", start_date=date(2026, 9, 1))
        self.assertEqual(quote_300["student_unit_price"], 25.0)
        self.assertEqual(quote_300["monthly_base_price"], 7500.0)
        self.assertEqual(quote_300["net_total"], 7500.0)

        quote_600 = AcademicPricingEngine.calculate_quote(600, "monthly", start_date=date(2026, 9, 1))
        self.assertEqual(quote_600["student_unit_price"], 20.0)
        self.assertEqual(quote_600["monthly_base_price"], 12000.0)
        self.assertEqual(quote_600["net_total"], 12000.0)

    def test_term_plan_discount_term_1(self):
        """In September (month 9), Term 1 has 4 remaining months with 10% discount.
        300 students @ 25 EGP = 7500 EGP/mo.
        Gross = 7500 * 4 = 30,000 EGP.
        Discount = 10% = 3,000 EGP.
        Net = 27,000 EGP.
        """
        quote = AcademicPricingEngine.calculate_quote(300, "term", start_date=date(2026, 9, 1))
        self.assertEqual(quote["student_unit_price"], 25.0)
        self.assertEqual(quote["monthly_base_price"], 7500.0)
        self.assertEqual(quote["calculated_months"], 4)
        self.assertEqual(quote["gross_amount"], 30000.0)
        self.assertEqual(quote["discount_percentage"], 10)
        self.assertEqual(quote["discount_amount"], 3000.0)
        self.assertEqual(quote["net_total"], 27000.0)

    def test_full_year_plan_discount(self):
        """In September (month 9), full academic year has 10 remaining months with 15% discount."""
        quote = AcademicPricingEngine.calculate_quote(100, "full_year", start_date=date(2026, 9, 1))
        self.assertEqual(quote["student_unit_price"], 30.0)
        self.assertEqual(quote["monthly_base_price"], 3000.0)
        self.assertEqual(quote["calculated_months"], 10)
        self.assertEqual(quote["gross_amount"], 30000.0)
        self.assertEqual(quote["discount_percentage"], 15)
        self.assertEqual(quote["discount_amount"], 4500.0)
        self.assertEqual(quote["net_total"], 25500.0)


class AcademicPricingAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="superadmin@courssat.online",
            phone="01011112222",
            password="AdminPassword123!",
            first_name="سوبر",
            last_name="أدمن",
        )
        self.center_user = User.objects.create_user(
            email="center_test@courssat.online",
            phone="01020335023",
            password="CenterPassword123!",
            role=UserRole.CENTER,
            first_name="سنتر",
            last_name="الأوائل",
        )
        self.center_profile, _ = CenterProfile.objects.get_or_create(
            user=self.center_user,
            defaults={"institution_name": "سنتر الأوائل الأكاديمي"},
        )
        self.plan, _ = PricingPlan.objects.get_or_create(
            slug="official-center-plan",
            defaults={
                "name": "باقة السنتر الرسمية",
                "plan_type": PlanTypeChoices.CENTER,
                "price_monthly": 3000,
                "price_yearly": 30000,
            }
        )

    def test_calculate_endpoint(self):
        url = reverse("v1:academic-pricing-calculate")
        response = self.client.post(url, {
            "student_count": 300,
            "plan_type": "term",
            "start_date": "2026-09-01",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["student_tiers"], 3)
        self.assertEqual(data["student_unit_price"], 25.0)
        self.assertEqual(float(data["monthly_base_price"]), 7500.0)
        self.assertEqual(float(data["gross_amount"]), 30000.0)
        self.assertEqual(float(data["net_total"]), 27000.0)

    def test_create_quotation_and_whatsapp_flow(self):
        url = reverse("v1:academic-pricing-create-quotation")
        self.client.force_authenticate(user=self.center_user)
        response = self.client.post(url, {
            "student_count": 200,
            "plan_type": "term",
            "institution_name": "سنتر الأوائل الأكاديمي",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertTrue(data["invoice_number"].startswith("INV-"))
        self.assertIn("wa.me/201020335023", data["whatsapp_url"])
        self.assertEqual(data["status"], AcademicInvoiceStatus.PENDING_PAYMENT_CONFIRMATION)

        # Verify DB invoice created
        invoice = AcademicQuotationInvoice.objects.get(invoice_number=data["invoice_number"])
        self.assertEqual(invoice.student_count, 200)
        self.assertEqual(invoice.student_tiers, 2)

    def test_super_admin_approve_and_activate(self):
        invoice = AcademicQuotationInvoice.objects.create(
            invoice_number="INV-2026-9999",
            user=self.center_user,
            center_profile=self.center_profile,
            institution_name="سنتر الأوائل الأكاديمي",
            plan_type="term",
            student_count=400,
            calculated_months=4,
            net_total=Decimal("43200.00"),
            target_end_date=date(2026, 12, 31),
        )

        approve_url = reverse("v1:academic-pricing-quotations-approve", kwargs={"pk": invoice.pk})
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(approve_url, {"action": "approve"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, AcademicInvoiceStatus.APPROVED_ACTIVE)

        # Verify Subscription auto-created and activated with 400 student quota
        sub = Subscription.objects.get(user=self.center_user)
        self.assertEqual(sub.status, SubscriptionStatusChoices.ACTIVE)
        self.assertEqual(sub.custom_quota_students, 400)
