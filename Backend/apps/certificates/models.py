import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel
from apps.courses.models import Course


class Certificate(TimestampedModel):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="certificates",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="certificates")
    issued_at = models.DateTimeField(auto_now_add=True)
    grade = models.CharField(max_length=10, blank=True)
    serial = models.CharField(max_length=40, unique=True, editable=False)

    class Meta:
        unique_together = [("student", "course")]
        ordering = ["-issued_at"]

    def save(self, *args, **kwargs):
        if not self.serial:
            self.serial = uuid.uuid4().hex[:16].upper()
        super().save(*args, **kwargs)
