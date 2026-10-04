from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.assessments.models import Grade
from apps.assessments.serializers import GradeSerializer
from apps.calendar_events.models import CalendarEvent
from apps.calendar_events.serializers import CalendarEventSerializer
from apps.courses.models import Course, CourseStatus
from apps.enrollments.models import Enrollment, LessonCompletion
from apps.enrollments.serializers import EnrollmentSerializer
from apps.finance.models import PaymentTransaction, PayoutRequest, PayoutStatusChoices, TransactionStatus
from apps.live_sessions.models import LiveSession
from apps.live_sessions.serializers import LiveSessionSerializer
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer

from .permissions import IsAdmin, IsInstructor, IsStudent


def _stat(label, value, icon=None, change=None, change_label=None):
    payload = {"label": label, "value": value}
    if icon:
        payload["icon"] = icon
    if change is not None:
        payload["change"] = change
    if change_label:
        payload["changeLabel"] = change_label
    return payload


class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        user = request.user

        try:
            from apps.analytics.streak_service import record_student_activity

            record_student_activity(user, minutes_spent=5)
        except Exception:
            pass

        enrollments_qs = (
            Enrollment.objects.filter(student=user)
            .select_related("course__instructor", "course__category")
            .prefetch_related("lesson_completions", "course__modules__lessons")
            .order_by("-last_accessed_at")
        )

        enrolled_count = enrollments_qs.count()
        enrollments = list(enrollments_qs[:10])

        completed_completions_qs = LessonCompletion.objects.filter(enrollment__student=user)
        completed_lessons_total = completed_completions_qs.count()

        # Calculate estimated learning hours efficiently without memory bloat
        durations = list(completed_completions_qs.values_list("lesson__duration", flat=True)[:100])
        total_minutes = 0
        for d in durations:
            mins = 15
            if d and ":" in str(d):
                parts = str(d).split(":")
                if len(parts) == 2 and parts[0].isdigit():
                    mins = int(parts[0])
            elif d and str(d).isdigit():
                mins = int(d)
            total_minutes += mins
        learning_hours = round(total_minutes / 60, 1)

        certificates_count = user.certificates.count() if hasattr(user, "certificates") else 0

        stats = [
            _stat("Enrolled Courses", enrolled_count, icon="BookOpen"),
            _stat("Completed Lessons", completed_lessons_total, icon="CheckCircle"),
            _stat("Learning Hours", learning_hours, icon="Clock"),
            _stat("Certificates", certificates_count, icon="Award"),
        ]

        upcoming_events = CalendarEvent.objects.filter(user=user, date__gte=timezone.now().date()).order_by(
            "date", "time"
        )[:10]
        recent_grades = (
            Grade.objects.filter(student=user).select_related("course", "assignment").order_by("-created_at")[:5]
        )
        notifications = Notification.objects.filter(user=user).order_by("-created_at")[:15]

        student_profile = getattr(user, "student_profile", None)
        from apps.analytics.streak_service import get_current_student_streak
        current_streak = get_current_student_streak(student_profile) if student_profile else 0

        ctx = {"request": request}
        return Response(
            {
                "enrollments": EnrollmentSerializer(enrollments, many=True, context=ctx).data,
                "stats": stats,
                "upcoming_events": CalendarEventSerializer(upcoming_events, many=True, context=ctx).data,
                "recent_grades": GradeSerializer(recent_grades, many=True, context=ctx).data,
                "notifications": NotificationSerializer(notifications, many=True, context=ctx).data,
                "streak_days": current_streak,
            }
        )


class InstructorDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request):
        user = request.user
        courses = Course.objects.filter(instructor=user)
        agg = courses.aggregate(
            total_students=Count("enrollments", distinct=True),
            avg_rating=Avg("reviews__rating"),
        )
        active_courses = courses.filter(status=CourseStatus.PUBLISHED).count()

        # Real revenue from Wallet
        revenue = Decimal("0.00")
        if hasattr(user, "wallet"):
            revenue = user.wallet.available_balance

        course_rows = []
        total_completion_rate = 0
        annotated_courses = courses.annotate(
            students=Count("enrollments", distinct=True),
            completed_students=Count("enrollments", filter=Q(enrollments__completed_at__isnull=False), distinct=True),
        )
        course_count = annotated_courses.count()

        for c in annotated_courses:
            student_cnt = c.students
            completed_cnt = c.completed_students
            c_rate = round((completed_cnt / student_cnt) * 100) if student_cnt > 0 else 0
            total_completion_rate += c_rate

            course_price = c.price or Decimal("0.00")
            course_rows.append(
                {
                    "id": c.id,
                    "title": c.title,
                    "student_count": student_cnt,
                    "rating": c.rating,
                    "status": c.status,
                    "completion_rate": c_rate,
                    "revenue": float(course_price * student_cnt),
                }
            )

        avg_completion_rate = round(total_completion_rate / course_count) if course_count > 0 else 0

        stats = [
            _stat("Total Students", agg["total_students"] or 0, icon="Users"),
            _stat("Active Courses", active_courses, icon="BookOpen"),
            _stat("Avg Rating", round(float(agg["avg_rating"] or 0), 2), icon="Star"),
            _stat("Revenue", f"{revenue} EGP", icon="DollarSign"),
            _stat("Avg Completion Rate", f"{avg_completion_rate}%", icon="TrendingUp"),
        ]

        upcoming_sessions = LiveSession.objects.filter(instructor=user, scheduled_at__gte=timezone.now()).order_by(
            "scheduled_at"
        )[:5]

        return Response(
            {
                "stats": stats,
                "courses": course_rows,
                "pending_tasks": [],
                "upcoming_sessions": LiveSessionSerializer(upcoming_sessions, many=True).data,
            }
        )


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        total_users = User.objects.count()
        active_courses = Course.objects.filter(status=CourseStatus.PUBLISHED).count()
        active_enrollments = Enrollment.objects.filter(completed_at__isnull=True).count()

        # Real Monthly Revenue
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_revenue_agg = PaymentTransaction.objects.filter(
            status=TransactionStatus.PAID, created_at__gte=start_of_month
        ).aggregate(Sum("amount"))
        monthly_revenue = monthly_revenue_agg["amount__sum"] or Decimal("0.00")

        stats = [
            _stat("Total Users", total_users, icon="Users"),
            _stat("Active Courses", active_courses, icon="BookOpen"),
            _stat("Monthly Revenue", float(monthly_revenue), icon="DollarSign"),
            _stat("Active Enrollments", active_enrollments, icon="TrendingUp"),
        ]

        # Pending Approvals (Payouts and maybe something else, here just Payouts)
        pending_payouts = PayoutRequest.objects.filter(status=PayoutStatusChoices.PENDING).select_related("user")[:5]
        pending_approvals = [
            {
                "id": p.id,
                "type": "payout",
                "user": p.user.full_name,
                "amount": float(p.amount),
                "created_at": p.created_at.isoformat(),
            }
            for p in pending_payouts
        ]

        recent_activity = [
            {
                "id": f"u{u.id}",
                "action": "New user registered",
                "user": u.full_name,
                "timestamp": u.created_at.isoformat(),
            }
            for u in User.objects.order_by("-created_at")[:5]
        ]

        # Trends for the last 6 months
        six_months_ago = start_of_month - relativedelta(months=5)

        # Enrollment Trend
        enrollment_qs = (
            Enrollment.objects.filter(enrolled_at__gte=six_months_ago)
            .annotate(month=TruncMonth("enrolled_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        enrollment_trend = [
            {"month": e["month"].strftime("%b %Y"), "count": e["count"]} for e in enrollment_qs if e["month"]
        ]

        # Revenue Trend
        revenue_qs = (
            PaymentTransaction.objects.filter(status=TransactionStatus.PAID, created_at__gte=six_months_ago)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("amount"))
            .order_by("month")
        )

        revenue_trend = [
            {"month": r["month"].strftime("%b %Y"), "revenue": float(r["total"])} for r in revenue_qs if r["month"]
        ]

        return Response(
            {
                "stats": stats,
                "pending_approvals": pending_approvals,
                "recent_activity": recent_activity,
                "enrollment_trend": enrollment_trend,
                "revenue_trend": revenue_trend,
            }
        )
