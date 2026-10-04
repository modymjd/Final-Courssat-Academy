import secrets
import string
from datetime import date

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserRole
from apps.common.permissions import IsAdmin
from apps.finance.models import (
    AcademicInvoiceStatus,
    AcademicQuotationInvoice,
    PlanTypeChoices,
    PricingPlan,
    Subscription,
    SubscriptionStatusChoices,
)
from apps.finance.services.academic_pricing import AcademicPricingEngine

SUPPORT_PHONE = "01020335023"


def generate_invoice_number() -> str:
    """Generates unique invoice number: INV-YYYY-XXXX"""
    year = timezone.now().year
    random_part = "".join(secrets.choice(string.digits) for _ in range(4))
    invoice_num = f"INV-{year}-{random_part}"
    while AcademicQuotationInvoice.objects.filter(invoice_number=invoice_num).exists():
        random_part = "".join(secrets.choice(string.digits) for _ in range(4))
        invoice_num = f"INV-{year}-{random_part}"
    return invoice_num


class AcademicPricingCalculateView(APIView):
    """
    Public endpoint to dynamically calculate quotes based on academic calendar,
    student count tiers (3000 EGP per 100 students), and discount percentages.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        student_count = request.data.get("student_count", 100)
        plan_type = request.data.get("plan_type", "term")
        start_date_str = request.data.get("start_date")

        try:
            student_count = max(1, int(student_count))
        except (TypeError, ValueError):
            return Response({"detail": "عدد الطلاب يجب أن يكون رقماً صحيحاً موجباً."}, status=status.HTTP_400_BAD_REQUEST)

        if plan_type not in ["monthly", "term", "full_year"]:
            return Response(
                {"detail": "نوع الخطة غير صالح. الخيارات المتاحة: monthly, term, full_year."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_d = None
        if start_date_str:
            try:
                start_d = date.fromisoformat(start_date_str)
            except ValueError:
                pass

        quote = AcademicPricingEngine.calculate_quote(
            student_count=student_count,
            plan_type=plan_type,
            start_date=start_d,
        )

        return Response(quote)


class AcademicQuotationCreateView(APIView):
    """
    Creates an official Academic Quotation / Pro-forma Invoice and generates
    the WhatsApp payload for instant confirmation.
    """

    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        student_count = request.data.get("student_count", 100)
        plan_type = request.data.get("plan_type", "term")
        institution_name = request.data.get("institution_name", "").strip()
        contact_phone = request.data.get("contact_phone", "").strip()
        contact_email = request.data.get("contact_email", "").strip()
        payment_method_note = request.data.get("payment_method_note", "InstaPay / Vodafone Cash / Bank")

        try:
            student_count = max(1, int(student_count))
        except (TypeError, ValueError):
            return Response({"detail": "عدد الطلاب غير صحيح."}, status=status.HTTP_400_BAD_REQUEST)

        if not institution_name:
            if (
                request.user.is_authenticated
                and hasattr(request.user, "center_profile")
                and request.user.center_profile
            ):
                institution_name = request.user.center_profile.institution_name
            else:
                institution_name = "سنتر تعليمي"

        if not contact_phone and request.user.is_authenticated:
            contact_phone = request.user.phone or ""

        if not contact_email and request.user.is_authenticated:
            contact_email = request.user.email or ""

        quote = AcademicPricingEngine.calculate_quote(
            student_count=student_count,
            plan_type=plan_type,
        )

        invoice_number = generate_invoice_number()
        center_profile = None
        user = request.user if request.user.is_authenticated else None
        if user and hasattr(user, "center_profile") and user.center_profile:
            center_profile = user.center_profile

        invoice = AcademicQuotationInvoice.objects.create(
            invoice_number=invoice_number,
            user=user,
            center_profile=center_profile,
            institution_name=institution_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
            plan_type=plan_type,
            student_count=quote["student_count"],
            student_tiers=quote["student_tiers"],
            calculated_months=quote["calculated_months"],
            monthly_base_price=quote["monthly_base_price"],
            gross_amount=quote["gross_amount"],
            discount_percentage=quote["discount_percentage"],
            discount_amount=quote["discount_amount"],
            net_total=quote["net_total"],
            target_end_date=date.fromisoformat(quote["end_date"]),
            status=AcademicInvoiceStatus.PENDING_PAYMENT_CONFIRMATION,
            payment_method_note=payment_method_note,
        )

        # Generate WhatsApp Message & Click-to-Chat URL
        whatsapp_message = AcademicPricingEngine.generate_whatsapp_message(
            institution_name=institution_name,
            invoice_number=invoice_number,
            quote=quote,
            contact_phone=contact_phone,
        )

        import urllib.parse

        encoded_text = urllib.parse.quote(whatsapp_message)
        whatsapp_url = f"https://wa.me/201020335023?text={encoded_text}"

        return Response(
            {
                "id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "institution_name": invoice.institution_name,
                "status": invoice.status,
                "quote": quote,
                "whatsapp_message": whatsapp_message,
                "whatsapp_url": whatsapp_url,
                "support_phone": "01020335023",
                "created_at": invoice.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


class AcademicQuotationListView(APIView):
    """
    List academic invoices.
    - Super Admin: sees all invoices.
    - Center User: sees their own invoices.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            queryset = AcademicQuotationInvoice.objects.all().order_by("-created_at")
        elif user.role == UserRole.CENTER:
            queryset = AcademicQuotationInvoice.objects.filter(user=user).order_by("-created_at")
        else:
            return Response({"detail": "غير مصرح لك بعرض هذه الفواتير."}, status=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        data = []
        for inv in queryset:
            data.append(
                {
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "institution_name": inv.institution_name,
                    "contact_phone": inv.contact_phone,
                    "contact_email": inv.contact_email,
                    "plan_type": inv.plan_type,
                    "student_count": inv.student_count,
                    "student_tiers": inv.student_tiers,
                    "calculated_months": inv.calculated_months,
                    "monthly_base_price": float(inv.monthly_base_price),
                    "gross_amount": float(inv.gross_amount),
                    "discount_percentage": inv.discount_percentage,
                    "discount_amount": float(inv.discount_amount),
                    "net_total": float(inv.net_total),
                    "target_end_date": inv.target_end_date.isoformat() if inv.target_end_date else None,
                    "status": inv.status,
                    "payment_method_note": inv.payment_method_note,
                    "admin_notes": inv.admin_notes,
                    "approved_at": inv.approved_at.isoformat() if inv.approved_at else None,
                    "created_at": inv.created_at.isoformat(),
                }
            )

        return Response(data)


class AcademicQuotationApproveView(APIView):
    """
    Super Admin endpoint to confirm payment and activate center subscription.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @transaction.atomic
    def post(self, request, pk, *args, **kwargs):
        invoice = get_object_or_404(AcademicQuotationInvoice, pk=pk)
        action_type = request.data.get("action", "approve")
        admin_notes = request.data.get("admin_notes", "")

        if action_type == "reject":
            invoice.status = AcademicInvoiceStatus.REJECTED
            invoice.admin_notes = admin_notes
            invoice.approved_by = request.user
            invoice.approved_at = timezone.now()
            invoice.save(update_fields=["status", "admin_notes", "approved_by", "approved_at", "updated_at"])
            return Response({"detail": "تم رفض الفاتورة بنجاح.", "status": invoice.status})

        if action_type == "approve":
            invoice.status = AcademicInvoiceStatus.APPROVED_ACTIVE
            invoice.admin_notes = admin_notes
            invoice.approved_by = request.user
            invoice.approved_at = timezone.now()
            invoice.save(update_fields=["status", "admin_notes", "approved_by", "approved_at", "updated_at"])

            # Activate or create Subscription for the associated center/user
            target_user = invoice.user
            if not target_user and invoice.contact_email:
                from apps.accounts.models import User

                target_user = User.objects.filter(email=invoice.contact_email).first()

            if target_user:
                plan = PricingPlan.objects.filter(plan_type=PlanTypeChoices.CENTER, is_active=True).first()
                if not plan:
                    plan = PricingPlan.objects.filter(is_active=True).first()

                sub = Subscription.objects.filter(
                    user=target_user,
                    status__in=[SubscriptionStatusChoices.ACTIVE, SubscriptionStatusChoices.TRIALING],
                ).first()

                # Calculate end date
                end_dt = timezone.now() + timezone.timedelta(days=invoice.calculated_months * 30)
                if invoice.target_end_date:
                    from datetime import datetime, time

                    end_dt = timezone.make_aware(datetime.combine(invoice.target_end_date, time(23, 59, 59)))

                if not sub:
                    sub = Subscription.objects.create(
                        user=target_user,
                        plan=plan,
                        price_at_subscription=invoice.net_total,
                        status=SubscriptionStatusChoices.ACTIVE,
                        current_period_end=end_dt,
                        custom_quota_students=invoice.student_count,
                    )
                else:
                    sub.status = SubscriptionStatusChoices.ACTIVE
                    sub.custom_quota_students = invoice.student_count
                    sub.current_period_end = end_dt
                    sub.save(update_fields=["status", "custom_quota_students", "current_period_end", "updated_at"])

                # Verify center profile if exists
                if hasattr(target_user, "center_profile") and target_user.center_profile:
                    target_user.center_profile.is_verified = True
                    target_user.center_profile.save(update_fields=["is_verified", "updated_at"])

            return Response(
                {
                    "detail": f"تم تأكيد الدفع وتفعيل باقة السنتر بنجاح بسعة {invoice.student_count} طالب حتى {invoice.target_end_date}.",
                    "status": invoice.status,
                }
            )

        return Response({"detail": "إجراء غير صالح."}, status=status.HTTP_400_BAD_REQUEST)
