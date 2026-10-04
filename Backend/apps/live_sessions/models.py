from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel
from apps.courses.models import Course


class LiveSessionStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    LIVE = "live", "Live"
    ENDED = "ended", "Ended"


class LiveSession(TimestampedModel):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="live_sessions",
        limit_choices_to={"role": "instructor"},
    )
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="live_sessions")
    scheduled_at = models.DateTimeField()
    duration = models.PositiveIntegerField(help_text="minutes")
    status = models.CharField(max_length=20, choices=LiveSessionStatus.choices, default=LiveSessionStatus.SCHEDULED)
    max_participants = models.PositiveIntegerField(default=100)
    meeting_url = models.URLField(blank=True)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="joined_sessions", blank=True)

    class Meta:
        ordering = ["scheduled_at"]

    @property
    def participant_count(self):
        return self.participants.count()
