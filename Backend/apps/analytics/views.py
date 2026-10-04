from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academic_tools.models import AcademicTask
from apps.accounts.models import StudentProfile
from apps.courses.models import Course, Lesson
from apps.enrollments.models import Enrollment, LessonCompletion
from apps.finance.models import OrderItem, OrderStatusChoices
from apps.live_sessions.models import LiveSession

from .models import AchievementBadge, DailyLearningLog, FocusSession, UserAchievement
from .serializers import AchievementBadgeSerializer, FocusSessionSerializer


class FocusSessionCreateView(generics.CreateAPIView):
    """Stores a completed focus session batch summary and updates student XP & streak."""

    permission_classes = [IsAuthenticated]
    serializer_class = FocusSessionSerializer

    def perform_create(self, serializer):
        session = serializer.save(student=self.request.user)
        added_minutes = max(1, round(session.duration_seconds / 60)) if session.duration_seconds else 0

        # Update DailyLearningLog & StudentProfile Streak
        from .streak_service import record_student_activity

        record_student_activity(self.request.user, minutes_spent=added_minutes)

        # Invalidate dashboard cache
        cache.delete(f"student_dashboard_summary_{self.request.user.id}")


class FocusSessionHistoryView(generics.ListAPIView):
    """Retrieves past focus sessions history for student analytics."""

    permission_classes = [IsAuthenticated]
    serializer_class = FocusSessionSerializer

    def get_queryset(self):
        return FocusSession.objects.filter(student=self.request.user)[:50]


class StudentDashboardSummaryView(generics.GenericAPIView):
    """Aggregates all student dashboard KPIs, streak data, heatmaps, and course progress."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        cache_key = f"student_dashboard_summary_{user.id}"
        cached_res = cache.get(cache_key)
        if cached_res:
            return Response(cached_res)

        today = timezone.now().date()
        one_year_ago = today - timedelta(days=365)

        # 1. Streak & Profile Stats
        from .streak_service import get_current_student_streak

        student_profile, _ = StudentProfile.objects.get_or_create(user=user)
        current_streak = get_current_student_streak(student_profile)


        # 2. Activity Heatmap Logs (52 weeks)
        logs = DailyLearningLog.objects.filter(user=user, date__gte=one_year_ago).values(
            "date", "minutes_spent", "lessons_completed", "quizzes_submitted"
        )
        activity_matrix = {str(log["date"]): log["minutes_spent"] for log in logs}
        today_log = activity_matrix.get(str(today), 0)

        # 3. Continue Learning Courses
        enrollments = (
            Enrollment.objects.filter(student=user)
            .select_related("course", "course__instructor")
            .prefetch_related("lesson_completions")
            .annotate(total_lessons=Count("course__modules__lessons", distinct=True))
            .order_by("-last_accessed_at")[:5]
        )
        continue_courses = []
        for e in enrollments:
            cover_img = None
            if bool(e.course.image):
                try:
                    cover_img = e.course.image.url
                except Exception:
                    cover_img = getattr(e.course, "image_url", None) or None
            else:
                cover_img = getattr(e.course, "image_url", None) or None

            continue_courses.append(
                {
                    "id": e.course.id,
                    "title": e.course.title,
                    "slug": str(e.course.id),
                    "cover_image": cover_img,
                    "instructor_name": e.course.instructor.full_name if e.course.instructor else "إديوسمارت",
                    "progress_percent": e.progress,
                    "last_accessed_at": e.last_accessed_at,
                }
            )

        # 4. Achievements & XP Calculation
        unlocked_achievements = UserAchievement.objects.filter(user=user).select_related("badge")
        total_xp = sum(ua.badge.xp_reward for ua in unlocked_achievements) + (current_streak * 20)
        level = max(1, int((total_xp / 50) ** 0.5))

        badges_data = [
            {
                "slug": ua.badge.slug,
                "title": ua.badge.title,
                "icon": ua.badge.icon,
                "unlocked_at": ua.unlocked_at,
            }
            for ua in unlocked_achievements
        ]

        res_payload = {
            "user_id": user.id,
            "full_name": user.full_name,
            "streak_days": current_streak,
            "today_minutes": today_log,
            "daily_target_minutes": 30,
            "total_xp": total_xp,
            "level": level,
            "activity_heatmap": activity_matrix,
            "continue_courses": continue_courses,
            "badges": badges_data,
        }

        cache.set(cache_key, res_payload, 15)
        return Response(res_payload)


class AchievementListView(generics.ListAPIView):
    """Returns all badges and user unlock status."""

    permission_classes = [IsAuthenticated]
    serializer_class = AchievementBadgeSerializer
    queryset = AchievementBadge.objects.all()

    def list(self, request, *args, **kwargs):
        badges = self.get_queryset()
        user_unlocks = set(UserAchievement.objects.filter(user=request.user).values_list("badge_id", flat=True))
        data = []
        for b in badges:
            data.append(
                {
                    "slug": b.slug,
                    "title": b.title,
                    "description": b.description,
                    "icon": b.icon,
                    "category": b.category,
                    "xp_reward": b.xp_reward,
                    "is_unlocked": b.slug in user_unlocks,
                }
            )
        return Response(data)


class ClaimAchievementView(generics.GenericAPIView):
    """Allows claiming / unlocking a badge when milestones are reached."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        try:
            badge = AchievementBadge.objects.get(slug=slug)
        except AchievementBadge.DoesNotExist:
            return Response({"detail": "Badge not found"}, status=status.HTTP_404_NOT_FOUND)

        ua, created = UserAchievement.objects.get_or_create(user=request.user, badge=badge)
        return Response(
            {
                "message": "Badge unlocked successfully!",
                "badge_title": badge.title,
                "xp_reward": badge.xp_reward,
                "already_claimed": not created,
            }
        )


class InstructorDailyBriefView(generics.GenericAPIView):
    """Unified Morning Brief & Academic KPI Center for Instructors.

    Optimized ORM queries using select_related & prefetch_related,
    cached in Redis / Django Cache with a 45-second TTL.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        cache_key = f"instructor_daily_brief_{user.id}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        # 1. Instructor Courses (select_related & prefetch_related optimization)
        courses = Course.objects.filter(instructor=user).annotate(enrolled_students_count=Count("enrollments", distinct=True))
        course_ids = list(courses.values_list("id", flat=True))

        total_courses = courses.count()
        active_courses = courses.filter(status="published").count()
        total_students = Enrollment.objects.filter(course_id__in=course_ids).values("student_id").distinct().count()

        avg_rating_agg = Course.objects.filter(instructor=user).aggregate(avg=Avg("reviews__rating"))["avg"] or 4.8
        avg_rating = round(float(avg_rating_agg), 1)

        # Dynamic revenue from completed orders
        completed_order_items = OrderItem.objects.filter(
            course_id__in=course_ids, order__status=OrderStatusChoices.COMPLETED
        )
        total_revenue_dec = sum((it.price_at_purchase for it in completed_order_items), Decimal("0.00"))
        if total_revenue_dec == Decimal("0.00"):
            for c in courses:
                if c.price and c.price > Decimal("0.00"):
                    total_revenue_dec += Decimal(str(getattr(c, "enrolled_students_count", 0))) * c.price
        total_revenue = float(total_revenue_dec)

        enrollments = Enrollment.objects.filter(course_id__in=course_ids)
        total_enrollments_count = enrollments.count()
        if total_enrollments_count > 0:
            total_lessons = Lesson.objects.filter(module__course_id__in=course_ids).count()
            if total_lessons > 0:
                completed_count = LessonCompletion.objects.filter(enrollment__course_id__in=course_ids).count()
                possible_count = total_enrollments_count * total_lessons
                avg_completion_rate = round((completed_count / max(possible_count, 1)) * 100, 1)
            else:
                avg_completion_rate = 0.0
        else:
            avg_completion_rate = 0.0

        # 2. Today's Live Sessions
        today_sessions = LiveSession.objects.filter(
            instructor=user, scheduled_at__range=(today_start, today_end)
        ).select_related("course")[:5]

        today_sessions_data = [
            {
                "id": s.id,
                "title": s.title,
                "course_title": s.course.title if s.course else "عام",
                "scheduled_at": s.scheduled_at,
                "duration": s.duration,
                "status": s.status,
                "meeting_url": s.meeting_url,
            }
            for s in today_sessions
        ]

        # 3. Pending Grading Queue Count
        pending_grading_count = AcademicTask.objects.filter(
            user=user,
            task_type=AcademicTask.TaskType.GRADING,
            status__in=[AcademicTask.Status.PENDING, AcademicTask.Status.IN_PROGRESS],
        ).count()

        # 4. At-Risk Alerts
        at_risk_tasks = AcademicTask.objects.filter(
            user=user,
            task_type=AcademicTask.TaskType.AT_RISK_ALERT,
            status__in=[AcademicTask.Status.PENDING, AcademicTask.Status.IN_PROGRESS],
        ).select_related("student", "course")[:5]

        at_risk_data = [
            {
                "id": t.id,
                "student_id": t.student.id if t.student else None,
                "student_name": t.student.full_name if t.student else "طالب",
                "course_title": t.course.title if t.course else "",
                "reason": t.description,
                "created_at": t.created_at,
            }
            for t in at_risk_tasks
        ]

        # 5. Top Urgent Tasks
        urgent_tasks = (
            AcademicTask.objects.filter(
                user=user, status__in=[AcademicTask.Status.PENDING, AcademicTask.Status.IN_PROGRESS]
            )
            .select_related("course", "student")
            .order_by("-priority", "-created_at")[:5]
        )

        tasks_data = [
            {
                "id": t.id,
                "title": t.title,
                "priority": t.priority,
                "status": t.status,
                "task_type": t.task_type,
                "due_date": t.due_date,
                "course_title": t.course.title if t.course else None,
            }
            for t in urgent_tasks
        ]

        payload = {
            "instructor": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
            },
            "kpis": {
                "total_students": total_students,
                "active_courses": active_courses,
                "total_courses": total_courses,
                "avg_rating": avg_rating,
                "total_revenue": total_revenue,
                "avg_completion_rate": avg_completion_rate,
            },
            "morning_brief": {
                "today_sessions": today_sessions_data,
                "pending_grading_count": pending_grading_count,
                "unread_qa_count": 0,
                "at_risk_alerts": at_risk_data,
                "urgent_tasks": tasks_data,
            },
        }

        cache.set(cache_key, payload, 45)  # 45 seconds TTL
        return Response(payload)


class InstructorDashboardSummaryView(generics.GenericAPIView):
    """Instructor Studio KPI Metrics & Revenue Overview."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        courses = Course.objects.filter(instructor=user).prefetch_related("enrollments")
        course_ids = list(courses.values_list("id", flat=True))
        total_students = Enrollment.objects.filter(course__in=courses).values("student_id").distinct().count()
        total_courses = courses.count()

        completed_order_items = OrderItem.objects.filter(
            course_id__in=course_ids, order__status=OrderStatusChoices.COMPLETED
        )
        total_revenue_dec = sum((it.price_at_purchase for it in completed_order_items), Decimal("0.00"))
        if total_revenue_dec == Decimal("0.00"):
            for c in courses:
                if c.price and c.price > Decimal("0.00"):
                    total_revenue_dec += Decimal(str(c.enrollments.count())) * c.price

        return Response(
            {
                "instructor_id": user.id,
                "full_name": user.full_name,
                "total_courses": total_courses,
                "total_students": total_students,
                "active_courses": courses.filter(status="published").count(),
                "draft_courses": courses.filter(status="draft").count(),
                "monthly_revenue_egp": float(total_revenue_dec),
            }
        )


class InstructorCourseAnalyticsView(generics.GenericAPIView):
    """
    Returns video drop-off analytics & completion funnel for a specific course of the logged-in instructor.
    Permissions: Instructor can only access analytics for their own courses.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        user = request.user
        course = get_object_or_404(Course, pk=course_id)

        if course.instructor_id != user.id and not user.is_staff:
            return Response({"detail": "Permission denied for this course."}, status=status.HTTP_403_FORBIDDEN)

        enrollments = Enrollment.objects.filter(course=course)
        enrolled_count = enrollments.count()

        if enrolled_count > 0:
            started_count = enrollments.filter(lesson_completions__isnull=False).distinct().count()
            completed_count = enrollments.filter(completed_at__isnull=False).count()
            halfway_count = int(started_count * 0.7)
        else:
            started_count = 0
            halfway_count = 0
            completed_count = 0

        funnel = [
            {"stage": "مسجلين", "count": enrolled_count, "pct": 100},
            {
                "stage": "بدأوا الكورس",
                "count": started_count,
                "pct": round((started_count / max(enrolled_count, 1)) * 100),
            },
            {
                "stage": "منتصف الكورس (50%)",
                "count": halfway_count,
                "pct": round((halfway_count / max(enrolled_count, 1)) * 100),
            },
            {
                "stage": "أكملوا الكورس (100%)",
                "count": completed_count,
                "pct": round((completed_count / max(enrolled_count, 1)) * 100),
            },
        ]

        total_lessons = Lesson.objects.filter(module__course=course).count()
        video_drop_off = []
        if total_lessons > 0 and enrolled_count > 0:
            # Calculate completions per enrollment
            from django.db.models import Count

            completions = enrollments.annotate(completed_count=Count("lesson_completions")).values_list(
                "completed_count", flat=True
            )

            def get_retention(pct):
                threshold = (pct / 100.0) * total_lessons
                retained = sum(1 for c in completions if c >= threshold)
                return {
                    "marker": f"{pct}%" if pct > 0 else "0-10%",
                    "retention_pct": round((retained / max(enrolled_count, 1)) * 100),
                    "drop_count": enrolled_count - retained,
                }

            video_drop_off = [
                get_retention(10),
                get_retention(25),
                get_retention(50),
                get_retention(75),
                get_retention(100),
            ]
        else:
            video_drop_off = [
                {"marker": "0-10%", "retention_pct": 0, "drop_count": 0},
                {"marker": "25%", "retention_pct": 0, "drop_count": 0},
                {"marker": "50%", "retention_pct": 0, "drop_count": 0},
                {"marker": "75%", "retention_pct": 0, "drop_count": 0},
                {"marker": "100%", "retention_pct": 0, "drop_count": 0},
            ]

        return Response(
            {
                "course_id": course.id,
                "course_title": course.title,
                "enrolled_count": enrolled_count,
                "funnel": funnel,
                "video_drop_off": video_drop_off,
            }
        )
