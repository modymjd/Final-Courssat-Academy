from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimestampedModel
from apps.courses.models import Course


class AcademicTask(TimestampedModel):
    class Priority(models.TextChoices):
        LOW = "LOW", "منخفضة"
        MEDIUM = "MEDIUM", "متوسطة"
        HIGH = "HIGH", "عالية"
        URGENT = "URGENT", "عاجلة جداً"

    class Status(models.TextChoices):
        PENDING = "PENDING", "قيد الانتظار"
        IN_PROGRESS = "IN_PROGRESS", "جاري التنفيذ"
        COMPLETED = "COMPLETED", "مكتملة"

    class TaskType(models.TextChoices):
        MANUAL = "MANUAL", "يدوية"
        GRADING = "GRADING", "تصحيح واجب/امتحان"
        BOOKING_REQUEST = "BOOKING_REQUEST", "طلب حجز"
        UNANSWERED_QA = "UNANSWERED_QA", "سؤال غير مجاب"
        AT_RISK_ALERT = "AT_RISK_ALERT", "تنبيه طالب متعثر"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="academic_tasks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    task_type = models.CharField(
        max_length=30,
        choices=TaskType.choices,
        default=TaskType.MANUAL,
    )
    due_date = models.DateTimeField(null=True, blank=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="academic_tasks",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="targeted_academic_tasks",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-priority", "-created_at"]
        verbose_name = "مهمة أكاديمية"
        verbose_name_plural = "المهام الأكاديمية"

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title}"

    def save(self, *args, **kwargs):
        if self.status == self.Status.COMPLETED and not self.completed_at:
            self.completed_at = timezone.now()
        elif self.status != self.Status.COMPLETED:
            self.completed_at = None
        super().save(*args, **kwargs)

    @classmethod
    def create_or_update_at_risk_task(cls, instructor, student, course, reason_text):
        """Idempotent helper to create or update an AT_RISK_ALERT task for an instructor.

        If a pending/in-progress task already exists for the same student & course,
        update its description and timestamp instead of creating duplicates.
        """
        existing_task = cls.objects.filter(
            user=instructor,
            student=student,
            course=course,
            task_type=cls.TaskType.AT_RISK_ALERT,
            status__in=[cls.Status.PENDING, cls.Status.IN_PROGRESS],
        ).first()

        title = f"تنبيه تعثر: الطالب {student.full_name or student.username}"
        if existing_task:
            existing_task.description = reason_text
            existing_task.priority = cls.Priority.URGENT
            existing_task.save()
            return existing_task, False
        else:
            task = cls.objects.create(
                user=instructor,
                student=student,
                course=course,
                title=title,
                description=reason_text,
                priority=cls.Priority.URGENT,
                status=cls.Status.PENDING,
                task_type=cls.TaskType.AT_RISK_ALERT,
            )
            return task, True
