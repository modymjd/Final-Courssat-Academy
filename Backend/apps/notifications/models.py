from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.models import TimestampedModel


class NotificationType(models.TextChoices):
    COURSE_UPDATE = "course_update", "Course update"
    ASSIGNMENT_DUE = "assignment_due", "Assignment due"
    GRADE_POSTED = "grade_posted", "Grade posted"
    NEW_MESSAGE = "new_message", "New message"
    ENROLLMENT = "enrollment", "Enrollment"
    CERTIFICATE = "certificate", "Certificate"
    SYSTEM = "system", "System"
    LIVE_SESSION = "live_session", "Live session"
    EXAM = "exam", "Exam"


class Notification(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=32, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    action_url = models.CharField(max_length=500, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "type", "action_url"],
                condition=Q(action_url__gt=""),
                name="notifications_user_type_action_url_uniq",
            ),
        ]
        ordering = ["-created_at"]


class ParentConsent(TimestampedModel):
    student = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="parent_consent",
    )
    parent_name = models.CharField(max_length=150)
    parent_email = models.EmailField(blank=True)
    parent_phone = models.CharField(max_length=30, blank=True)
    telegram_chat_id = models.CharField(max_length=50, blank=True, db_index=True)
    telegram_username = models.CharField(max_length=100, blank=True)
    linking_code = models.CharField(max_length=64, blank=True, db_index=True)
    consent_given = models.BooleanField(default=False)
    consent_given_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return (
            f"Consent: {self.student.email} - Parent: {self.parent_name} (Telegram: {self.telegram_chat_id or 'None'})"
        )


class ParentReportChannel(models.TextChoices):
    EMAIL = "EMAIL", "Email"
    TELEGRAM = "TELEGRAM", "Telegram"
    WHATSAPP = "WHATSAPP", "WhatsApp"


class ParentReportLog(TimestampedModel):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="parent_reports",
    )
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_sent",
    )
    channel = models.CharField(max_length=20, choices=ParentReportChannel.choices, default=ParentReportChannel.EMAIL)
    report_data_json = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default="SENT")
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report #{self.id} for {self.student.email} via {self.channel}"
