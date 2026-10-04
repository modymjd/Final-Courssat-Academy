from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from apps.accounts.models import StudentProfile
from apps.analytics.models import DailyLearningLog


def record_student_activity(user, minutes_spent: int = 0, lessons_completed: int = 0, quizzes_submitted: int = 0) -> int:
    """
    Records daily student learning activity and increments the study streak once per calendar day.
    If the streak has lapsed (> 1 day since last activity), resets the streak to 1.
    """
    if not user or not user.is_authenticated or getattr(user, "role", "") != "student":
        return 0

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    # 1. Update DailyLearningLog
    log, _ = DailyLearningLog.objects.get_or_create(user=user, date=today)
    if minutes_spent > 0:
        log.minutes_spent = min(1440, log.minutes_spent + minutes_spent)
    if lessons_completed > 0:
        log.lessons_completed = (log.lessons_completed or 0) + lessons_completed
    if quizzes_submitted > 0:
        log.quizzes_submitted = (log.quizzes_submitted or 0) + quizzes_submitted
    log.save(update_fields=["minutes_spent", "lessons_completed", "quizzes_submitted", "updated_at"])

    # 2. Update StudentProfile Study Streak
    student_profile, _ = StudentProfile.objects.get_or_create(user=user)
    if student_profile.last_streak_date != today:
        if student_profile.last_streak_date == yesterday:
            student_profile.study_streak += 1
        else:
            student_profile.study_streak = 1
        student_profile.last_streak_date = today
        student_profile.save(update_fields=["study_streak", "last_streak_date"])

    cache.delete(f"student_dashboard_summary_{user.id}")
    return student_profile.study_streak


def get_current_student_streak(student_profile: StudentProfile) -> int:
    """
    Returns the active study streak. If the student hasn't studied today or yesterday,
    the active streak is 0.
    """
    if not student_profile or not student_profile.last_streak_date:
        return 0

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    if student_profile.last_streak_date in (today, yesterday):
        return student_profile.study_streak
    else:
        if student_profile.study_streak != 0:
            student_profile.study_streak = 0
            student_profile.save(update_fields=["study_streak"])
        return 0
