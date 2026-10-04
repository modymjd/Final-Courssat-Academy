from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel


class DailyLearningLog(TimestampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_logs")
    date = models.DateField(db_index=True)
    minutes_spent = models.PositiveIntegerField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    quizzes_submitted = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date"]

    def __str__(self):
        return f"LearningLog<{self.user.email}:{self.date}={self.minutes_spent}m>"


class AchievementBadge(TimestampedModel):
    slug = models.SlugField(unique=True, primary_key=True)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=80, default="Award")
    category = models.CharField(max_length=50, default="GENERAL")
    xp_reward = models.PositiveIntegerField(default=50)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class UserAchievement(TimestampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievements")
    badge = models.ForeignKey(AchievementBadge, on_delete=models.CASCADE, related_name="user_unlocks")
    unlocked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ("user", "badge")
        ordering = ["-unlocked_at"]

    def __str__(self):
        return f"Unlock<{self.user.email}:{self.badge_id}>"


class FocusSession(TimestampedModel):
    session_id = models.CharField(max_length=64, db_index=True, unique=True)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="focus_sessions")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration_seconds = models.PositiveIntegerField()
    focused = models.BooleanField(default=True)
    focus_score = models.PositiveIntegerField(default=100)
    mode = models.CharField(max_length=30, default="pomodoro")
    distractions_count = models.PositiveIntegerField(default=0)
    course_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FocusSession<{self.student.email}:{self.mode}:{self.duration_seconds}s:score={self.focus_score}>"
