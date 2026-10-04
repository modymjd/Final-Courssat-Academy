from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel
from apps.courses.models import Course


class CalendarEventType(models.TextChoices):
    LESSON = "lesson", "Lesson"
    ASSIGNMENT = "assignment", "Assignment"
    QUIZ = "quiz", "Quiz"
    LIVE_SESSION = "live_session", "Live session"
    DEADLINE = "deadline", "Deadline"


class CalendarEvent(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    title = models.CharField(max_length=200)
    type = models.CharField(max_length=32, choices=CalendarEventType.choices)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="calendar_events")
    description = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "date"])]
        ordering = ["date", "time"]
