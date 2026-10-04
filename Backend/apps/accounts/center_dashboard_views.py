from datetime import timedelta

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CenterInstructor, CenterProfile, CenterStudent, UserRole
from apps.accounts.permissions import IsProfileCompleted
from apps.activation_codes.models import ActivationCode
from apps.activation_codes.services.quota import QuotaService
from apps.finance.models import Subscription, SubscriptionStatusChoices


class IsCenterOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [UserRole.CENTER, UserRole.ADMIN, UserRole.SUPER_ADMIN]


class CenterOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]

    def get(self, request, *args, **kwargs):
        user = request.user
        center = get_object_or_404(CenterProfile, user=user)

        active_instructors_count = CenterInstructor.objects.filter(center=center, is_active=True).count()
        has_instructors = active_instructors_count > 0

        total_active_students = CenterStudent.objects.filter(center=center, is_active=True).count()

        generated_codes_count = ActivationCode.objects.filter(batch__created_by=user).exclude(
            status=ActivationCode.CodeStatus.REVOKED
        ).count()
        redeemed_codes_count = ActivationCode.objects.filter(
            batch__created_by=user, status=ActivationCode.CodeStatus.REDEEMED
        ).count()
        usage_rate = round((redeemed_codes_count / generated_codes_count) * 100, 1) if generated_codes_count else 0.0

        available_quota = QuotaService.get_available_quota(user)

        sub = Subscription.objects.filter(
            user=user,
            status__in=[SubscriptionStatusChoices.ACTIVE, SubscriptionStatusChoices.TRIALING],
        ).select_related("plan").first()

        now = timezone.now()
        if sub:
            plan_tier = sub.plan.plan_type
            is_trial = sub.status == SubscriptionStatusChoices.TRIALING
            expires_at = sub.current_period_end
            days_remaining = max(0, (sub.current_period_end - now).days) if sub.current_period_end else 0
        else:
            plan_tier = "center"
            is_trial = True
            trial_end = center.created_at + timedelta(days=14)
            expires_at = trial_end
            days_remaining = max(0, (trial_end - now).days)

        trial_expired = is_trial and expires_at is not None and expires_at <= now
        is_active = expires_at is None or expires_at > now

        recent_redemptions = (
            ActivationCode.objects.filter(batch__created_by=user, status=ActivationCode.CodeStatus.REDEEMED)
            .select_related("redeemed_by", "batch", "batch__target_instructor")
            .prefetch_related("batch__courses")
            .order_by("-redeemed_at")[:8]
        )

        activity_feed = []
        for code in recent_redemptions:
            activity_feed.append(
                {
                    "id": f"redeem-{code.id}",
                    "type": "code_redeemed",
                    "title": f"تفعيل كود ({code.code})",
                    "description": f"قام الطالب {code.redeemed_by.full_name or code.redeemed_by.email} بتفعيل الكود بنجاح",
                    "target_instructor": code.batch.target_instructor.full_name
                    if code.batch.target_instructor
                    else "عام",
                    "timestamp": code.redeemed_at.isoformat() if code.redeemed_at else code.updated_at.isoformat(),
                }
            )

        recent_memberships = (
            CenterInstructor.objects.filter(center=center).select_related("instructor").order_by("-joined_at")[:5]
        )
        for membership in recent_memberships:
            activity_feed.append(
                {
                    "id": f"instructor-{membership.id}",
                    "type": "instructor_joined",
                    "title": f"انضمام معلم ({membership.instructor.full_name or membership.instructor.email})",
                    "description": f"تم ربط المعلم بالسنتر لمادة {membership.subject or 'العامة'}",
                    "target_instructor": membership.instructor.full_name,
                    "timestamp": membership.joined_at.isoformat(),
                }
            )

        activity_feed.sort(key=lambda item: item["timestamp"], reverse=True)

        return Response(
            {
                "center_info": {
                    "id": center.id,
                    "institution_name": center.institution_name,
                    "institution_type": center.institution_type,
                    "is_verified": center.is_verified,
                    "logo": request.build_absolute_uri(center.logo.url) if center.logo else None,
                },
                "kpis": {
                    "total_active_students": total_active_students,
                    "total_active_instructors": active_instructors_count,
                    "total_generated_codes": generated_codes_count,
                    "total_redeemed_codes": redeemed_codes_count,
                    "remaining_quota": available_quota,
                    "usage_rate": usage_rate,
                },
                "onboarding": {
                    "has_instructors": has_instructors,
                    "can_generate_codes": has_instructors and available_quota > 0,
                    "step_message": ""
                    if has_instructors
                    else "يجب إضافة أو ربط معلم واحد على الأقل للمركز حتى تتمكن من توليد وطباعة أكواد التفعيل.",
                },
                "subscription": {
                    "plan_tier": plan_tier,
                    "is_trial": is_trial,
                    "trial_days_left": days_remaining if is_trial else 0,
                    "trial_expired": trial_expired,
                    "is_active": is_active,
                    "expires_at": expires_at.isoformat() if expires_at else None,
                },
                "activity_feed": activity_feed[:10],
            }
        )


class CenterReportsView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]

    def get(self, request, *args, **kwargs):
        user = request.user
        center = get_object_or_404(CenterProfile, user=user)

        generated_codes = ActivationCode.objects.filter(batch__created_by=user).exclude(
            status=ActivationCode.CodeStatus.REVOKED
        ).count()
        redeemed_codes = ActivationCode.objects.filter(
            batch__created_by=user, status=ActivationCode.CodeStatus.REDEEMED
        ).count()

        usage_rate = round((redeemed_codes / generated_codes * 100), 1) if generated_codes > 0 else 0.0

        now = timezone.now()
        timeline = []
        for i in range(13, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            count = ActivationCode.objects.filter(
                batch__created_by=user,
                status=ActivationCode.CodeStatus.REDEEMED,
                redeemed_at__gte=day_start,
                redeemed_at__lt=day_end,
            ).count()
            timeline.append(
                {
                    "date": day_start.strftime("%Y-%m-%d"),
                    "label": day_start.strftime("%d/%m"),
                    "redeemed": count,
                }
            )

        subject_counts = (
            CenterInstructor.objects.filter(center=center, is_active=True)
            .values("subject")
            .annotate(count=Count("id"))
        )

        return Response(
            {
                "generated_codes": generated_codes,
                "redeemed_codes": redeemed_codes,
                "usage_rate": usage_rate,
                "timeline": timeline,
                "subjects": [
                    {"subject": sc["subject"] or "عام", "count": sc["count"]}
                    for sc in subject_counts
                ],
                "total_students": CenterStudent.objects.filter(center=center, is_active=True).count(),
            }
        )


class CenterSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]

    def get(self, request, *args, **kwargs):
        center = get_object_or_404(CenterProfile, user=request.user)
        return Response(
            {
                "institution_name": center.institution_name,
                "institution_type": center.institution_type,
                "address": center.address,
                "license_number": center.license_number,
                "website": center.website,
                "phone": request.user.phone or "",
                "email": request.user.email,
                "full_name": request.user.full_name,
                "logo": request.build_absolute_uri(center.logo.url) if center.logo else None,
                "notification_preferences": {
                    "notify_on_redemption": True,
                    "notify_on_quota_low": True,
                    "notify_on_admin_review": True,
                },
            }
        )

    def patch(self, request, *args, **kwargs):
        center = get_object_or_404(CenterProfile, user=request.user)

        institution_name = request.data.get("institution_name")
        institution_type = request.data.get("institution_type")
        address = request.data.get("address")
        license_number = request.data.get("license_number")
        website = request.data.get("website")
        phone = request.data.get("phone")

        if institution_name:
            center.institution_name = institution_name.strip()
        if institution_type:
            center.institution_type = institution_type.strip()
        if address is not None:
            center.address = address.strip()
        if license_number is not None:
            center.license_number = license_number.strip()
        if website is not None:
            center.website = website.strip()

        center.save()

        if phone is not None:
            request.user.phone = phone.strip()
            request.user.save(update_fields=["phone", "updated_at"])

        return Response({"message": "تم حفظ وتحديث إعدادات المركز التعليمي بنجاح."})
