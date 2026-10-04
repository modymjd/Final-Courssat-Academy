from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.courses.models import Course, CourseStatus
from apps.finance.models import PayoutRequest, PayoutStatusChoices


class AdminApprovalListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        pending_payouts = (
            PayoutRequest.objects.filter(status=PayoutStatusChoices.PENDING)
            .select_related("user", "wallet")
            .order_by("created_at")
        )
        draft_courses = (
            Course.objects.filter(status=CourseStatus.DRAFT)
            .select_related("instructor")
            .order_by("created_at")
        )

        approvals = []
        for payout in pending_payouts:
            applicant = payout.user.full_name or payout.user.email
            approvals.append(
                {
                    "id": payout.id,
                    "type": "payout",
                    "typeLabel": "طلب سحب أرباح",
                    "title": f"طلب سحب بقيمة {payout.amount} {payout.wallet.currency}",
                    "applicant": applicant,
                    "date": payout.created_at.date().isoformat(),
                    "status": payout.status,
                }
            )

        for course in draft_courses:
            approvals.append(
                {
                    "id": course.id,
                    "type": "course",
                    "typeLabel": "مراجعة كورس جديد",
                    "title": course.title,
                    "applicant": course.instructor.full_name or course.instructor.email,
                    "date": course.created_at.date().isoformat(),
                    "status": course.status,
                }
            )

        approvals.sort(key=lambda item: (item["date"], item["id"]))
        return Response(approvals, status=status.HTTP_200_OK)


class AdminApprovalView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @transaction.atomic
    def post(self, request, model_type, obj_id):
        action = request.data.get("action")
        notes = request.data.get("notes", "")

        if action not in ["approve", "reject"]:
            return Response(
                {"detail": "Invalid action. Use 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST
            )

        if model_type == "payout":
            payout = get_object_or_404(
                PayoutRequest.objects.select_for_update().select_related("wallet", "user"), pk=obj_id
            )
            if payout.status != PayoutStatusChoices.PENDING:
                return Response({"detail": f"Payout is already {payout.status}."}, status=status.HTTP_400_BAD_REQUEST)

            if action == "approve":
                payout.status = PayoutStatusChoices.APPROVED
                payout.processed_by = request.user
                payout.processed_at = timezone.now()
                payout.admin_notes = notes
                payout.save(update_fields=["status", "processed_by", "processed_at", "admin_notes", "updated_at"])
                return Response({"detail": "Payout approved successfully."})

            wallet = payout.wallet
            wallet = type(wallet).objects.select_for_update().get(pk=wallet.pk)
            if wallet.pending_balance < payout.amount:
                return Response(
                    {"detail": "Payout reserve is inconsistent with the requested amount."},
                    status=status.HTTP_409_CONFLICT,
                )

            payout.status = PayoutStatusChoices.REJECTED
            payout.processed_by = request.user
            payout.processed_at = timezone.now()
            payout.admin_notes = notes
            payout.save(update_fields=["status", "processed_by", "processed_at", "admin_notes", "updated_at"])

            wallet.pending_balance -= payout.amount
            wallet.available_balance += payout.amount
            wallet.save(update_fields=["pending_balance", "available_balance", "updated_at"])

            return Response({"detail": "Payout rejected successfully."})

        if model_type == "course":
            course = get_object_or_404(Course.objects.select_for_update(), pk=obj_id)
            if action == "approve":
                course.status = CourseStatus.PUBLISHED
                course.save(update_fields=["status", "updated_at"])
                return Response({"detail": "Course published successfully."})

            course.status = CourseStatus.DRAFT
            course.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Course rejected and reverted to draft."})

        return Response({"detail": "Invalid model_type."}, status=status.HTTP_400_BAD_REQUEST)


class SuperAdminCenterGovernanceView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, *args, **kwargs):
        from apps.accounts.models import CenterProfile
        from apps.finance.services.quota_enforcement import CenterQuotaEnforcementService

        centers = CenterProfile.objects.select_related("user").all().order_by("-created_at")
        data = []
        for c in centers:
            quotas = CenterQuotaEnforcementService.get_center_quotas(c)
            data.append(
                {
                    "id": c.id,
                    "user_id": c.user_id,
                    "institution_name": c.institution_name,
                    "institution_type": c.institution_type,
                    "email": c.user.email,
                    "phone": c.user.phone,
                    "is_verified": c.is_verified,
                    "license_number": c.license_number,
                    "address": c.address,
                    "quotas": quotas,
                }
            )
        return Response(data)

    def post(self, request, center_id, *args, **kwargs):
        from apps.accounts.models import CenterProfile
        from apps.finance.models import PlanTypeChoices, PricingPlan, Subscription, SubscriptionStatusChoices

        center = get_object_or_404(CenterProfile, pk=center_id)
        custom_students = request.data.get("custom_quota_students")
        custom_instructors = request.data.get("custom_quota_instructors")
        custom_features = request.data.get("custom_features")
        is_verified = request.data.get("is_verified")

        if is_verified is not None:
            center.is_verified = bool(is_verified)
            center.save(update_fields=["is_verified", "updated_at"])

        if custom_students is not None or custom_instructors is not None or custom_features is not None:
            sub = Subscription.objects.filter(
                user=center.user,
                status__in=[SubscriptionStatusChoices.ACTIVE, SubscriptionStatusChoices.TRIALING],
            ).first()

            if not sub:
                plan = PricingPlan.objects.filter(is_active=True).first()
                if not plan:
                    plan = PricingPlan.objects.create(
                        name="باقة السنتر الإدارية",
                        slug="admin-center-plan",
                        plan_type=PlanTypeChoices.CENTER,
                        price_monthly=0,
                        price_yearly=0,
                    )
                sub = Subscription.objects.create(
                    user=center.user,
                    plan=plan,
                    price_at_subscription=0,
                    status=SubscriptionStatusChoices.ACTIVE,
                    current_period_end=timezone.now() + timezone.timedelta(days=365),
                )

            if custom_students is not None:
                sub.custom_quota_students = int(custom_students)
            if custom_instructors is not None:
                sub.custom_quota_instructors = int(custom_instructors)
            if custom_features is not None and isinstance(custom_features, dict):
                sub.custom_features = custom_features

            sub.save()

        return Response({"detail": "تم تحديث حصص وإعدادات السنتر بنجاح."})
