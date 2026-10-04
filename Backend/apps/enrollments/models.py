import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import TimestampedModel
from apps.courses.models import Course, Lesson


class EnrollmentStatus(models.TextChoices):
    ACTIVE = "active", "نشط"
    GRACE_PERIOD = "grace_period", "فترة سماح"
    EXPIRED = "expired", "منتهي الصلاحية"


class EnrollmentQuerySet(models.QuerySet):
    def active_access(self):
        grace_days = getattr(self.model, "GRACE_PERIOD_DAYS", 3)
        return self.filter(
            Q(expires_at__isnull=True)
            | Q(expires_at__gte=timezone.now() - timedelta(days=grace_days))
        )


class Enrollment(TimestampedModel):
    EnrollmentStatus = EnrollmentStatus
    GRACE_PERIOD_DAYS = 3

    objects = EnrollmentQuerySet.as_manager()

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    enrolled_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_accessed_at = models.DateTimeField(auto_now=True)
    source = models.CharField(
        max_length=20, choices=[("online", "أونلاين"), ("activation_code", "كود تفعيل")], default="online"
    )
    activation_code = models.ForeignKey(
        "activation_codes.ActivationCode", null=True, blank=True, on_delete=models.SET_NULL, related_name="enrollments"
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="تاريخ انتهاء صلاحية وصول الطالب للكورس. Null يعني وصول دائم مدى الحياة.",
    )
    status = models.CharField(
        max_length=15,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.ACTIVE,
        db_index=True,
    )

    class Meta:
        unique_together = [("student", "course")]
        indexes = [
            models.Index(fields=["student", "-last_accessed_at"]),
        ]
        ordering = ["-last_accessed_at"]

    def __str__(self):
        return f"{self.student_id} -> {self.course_id}"

    @property
    def is_lifetime(self) -> bool:
        return self.expires_at is None

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at

    @property
    def is_in_grace_period(self) -> bool:
        if self.expires_at is None or not self.is_expired:
            return False
        return timezone.now() <= self.expires_at + timedelta(days=self.GRACE_PERIOD_DAYS)

    @property
    def has_active_access(self) -> bool:
        if self.expires_at is None:
            return True
        return timezone.now() <= (self.expires_at + timedelta(days=self.GRACE_PERIOD_DAYS))

    @property
    def access_status(self) -> str:
        if self.is_lifetime or not self.is_expired:
            return self.EnrollmentStatus.ACTIVE
        if self.is_in_grace_period:
            return self.EnrollmentStatus.GRACE_PERIOD
        return self.EnrollmentStatus.EXPIRED

    @property
    def progress(self) -> int:
        total = getattr(self, "total_lessons", None)
        if total is None:
            total = Lesson.objects.filter(module__course_id=self.course_id).count()
        if not total:
            return 0

        if hasattr(self, "_prefetched_objects_cache") and "lesson_completions" in self._prefetched_objects_cache:
            done = len(self.lesson_completions.all())
        else:
            done = self.lesson_completions.count()

        return min(100, round((done / total) * 100))


class LessonCompletion(TimestampedModel):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name="lesson_completions")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="completions")

    class Meta:
        unique_together = [("enrollment", "lesson")]


class LessonProgress(TimestampedModel):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name="lesson_progresses")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progresses")
    last_position_seconds = models.PositiveIntegerField(default=0)
    max_position_seconds = models.PositiveIntegerField(default=0)
    last_accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("enrollment", "lesson")]
        indexes = [
            models.Index(fields=["enrollment", "-last_accepted_at"]),
        ]

    def __str__(self):
        return f"{self.enrollment_id} - Lesson {self.lesson_id} ({self.max_position_seconds}s)"


class StudentNote(models.Model):
    client_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_notes",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="student_notes",
    )
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="student_notes",
    )
    title = models.CharField(max_length=255, default="ملاحظة جديدة", blank=True)
    content = models.TextField(blank=True)
    timestamp_seconds = models.PositiveIntegerField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    color = models.CharField(max_length=30, default="default", blank=True)
    is_pinned = models.BooleanField(default=False, db_index=True)
    blocks = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "client_id"],
                name="unique_student_note_client_id",
            )
        ]
        indexes = [
            models.Index(fields=["student", "-created_at"], name="student_notes_created_idx"),
            models.Index(fields=["student", "lesson", "timestamp_seconds"], name="student_lesson_notes_idx"),
        ]

    def __str__(self):
        return f"{self.student_id}: {self.title or 'Note'} ({self.client_id})"

