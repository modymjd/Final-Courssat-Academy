from django.utils import timezone

from apps.accounts.models import CenterInstructor, CenterProfile, CenterStudent
from apps.finance.models import Subscription, SubscriptionStatusChoices


class CenterQuotaEnforcementService:
    DEFAULT_TRIAL_STUDENT_LIMIT = 100
    DEFAULT_TRIAL_INSTRUCTOR_LIMIT = 5
    DEFAULT_TRIAL_VIDEO_HOURS = 8

    @classmethod
    def get_center_quotas(cls, center_profile: CenterProfile) -> dict:
        """
        Calculates the active resource quotas for an educational center.
        """
        active_sub = (
            Subscription.objects.filter(
                user=center_profile.user,
                status__in=[SubscriptionStatusChoices.ACTIVE, SubscriptionStatusChoices.TRIALING],
                current_period_end__gte=timezone.now(),
            )
            .select_related("plan")
            .first()
        )

        if active_sub:
            plan = active_sub.plan
            max_students = active_sub.custom_quota_students or plan.max_students or cls.DEFAULT_TRIAL_STUDENT_LIMIT
            max_instructors = (
                active_sub.custom_quota_instructors or plan.max_instructors or cls.DEFAULT_TRIAL_INSTRUCTOR_LIMIT
            )
            video_hours = plan.video_hours_per_student or cls.DEFAULT_TRIAL_VIDEO_HOURS
            features = {**(plan.features_config or {}), **(active_sub.custom_features or {})}
            plan_name = plan.name
            is_trial = active_sub.status == SubscriptionStatusChoices.TRIALING
        else:
            # Fallback to default trial quota (1/9 - 14/9)
            max_students = cls.DEFAULT_TRIAL_STUDENT_LIMIT
            max_instructors = cls.DEFAULT_TRIAL_INSTRUCTOR_LIMIT
            video_hours = cls.DEFAULT_TRIAL_VIDEO_HOURS
            features = {
                "question_bank": True,
                "auto_grading": True,
                "drm_watermark": True,
                "attendance_reports": True,
            }
            plan_name = "التجربة المجانية للسنتر (1/9 - 14/9)"
            is_trial = True

        current_students_count = CenterStudent.objects.filter(center=center_profile, is_active=True).count()
        current_instructors_count = CenterInstructor.objects.filter(center=center_profile, is_active=True).count()

        return {
            "plan_name": plan_name,
            "is_trial": is_trial,
            "max_students": max_students,
            "current_students_count": current_students_count,
            "remaining_students_slots": max(0, max_students - current_students_count),
            "max_instructors": max_instructors,
            "current_instructors_count": current_instructors_count,
            "remaining_instructors_slots": max(0, max_instructors - current_instructors_count),
            "video_hours_per_student": video_hours,
            "features": features,
        }

    @classmethod
    def can_enroll_student(cls, center_profile: CenterProfile, instructor_id: int | None = None) -> tuple[bool, str]:
        """
        Validates if the center can enroll a new student (general limit and per-teacher limit).
        """
        quotas = cls.get_center_quotas(center_profile)
        if quotas["remaining_students_slots"] <= 0:
            return (
                False,
                f"لقد استنفذ السنتر الحد الأقصى المسموح به للطلاب ({quotas['max_students']} طالب). يرجى ترقية الباقة لإضافة المزيد.",
            )

        if instructor_id:
            membership = CenterInstructor.objects.filter(
                center=center_profile,
                instructor_id=instructor_id,
                is_active=True,
            ).first()
            if membership and membership.student_quota > 0:
                # Check how many students are enrolled under this instructor at this center
                teacher_students_count = (
                    CenterStudent.objects.filter(
                        center=center_profile,
                        student__course_enrollments__course__instructor_id=instructor_id,
                        is_active=True,
                    )
                    .distinct()
                    .count()
                )
                if teacher_students_count >= membership.student_quota:
                    return (
                        False,
                        f"لقد وصل المعلم إلى الحد الأقصى المخصص له من الطلاب ({membership.student_quota} طالب).",
                    )

        return True, ""

    @classmethod
    def can_add_instructor(cls, center_profile: CenterProfile) -> tuple[bool, str]:
        """
        Validates if the center can add another instructor.
        """
        quotas = cls.get_center_quotas(center_profile)
        if quotas["remaining_instructors_slots"] <= 0:
            return (
                False,
                f"لقد استنفذ السنتر الحد الأقصى لعدد المعلمين ({quotas['max_instructors']} معلم). يرجى ترقية الباقة لإضافة معلمين جدد.",
            )
        return True, ""

    @classmethod
    def is_feature_enabled(cls, center_profile: CenterProfile, feature_key: str) -> bool:
        """
        Checks if a specific feature is enabled for the center.
        """
        quotas = cls.get_center_quotas(center_profile)
        return bool(quotas["features"].get(feature_key, False))
