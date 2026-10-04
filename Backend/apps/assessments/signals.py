from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Exam
from .tasks import notify_exam_audience_task


@receiver(pre_save, sender=Exam)
def exam_publication_transition(sender, instance, **kwargs):
    """Record whether an existing exam is transitioning into the published state."""
    if not instance.pk:
        instance._was_published_before_save = False
        return

    update_fields = kwargs.get("update_fields")
    if update_fields is not None and "is_published" not in update_fields:
        instance._was_published_before_save = instance.is_published
        return

    previous = sender.objects.filter(pk=instance.pk).values_list("is_published", flat=True).first()
    instance._was_published_before_save = bool(previous)


def _dispatch_exam_notification(exam_id: int):
    try:
        notify_exam_audience_task.delay(exam_id)
    except Exception:
        notify_exam_audience_task(exam_id)


@receiver(post_save, sender=Exam)
def exam_published_notification(sender, instance, created, **kwargs):
    """Queue audience notifications only when an exam becomes published."""
    if not instance.is_published:
        return

    was_published = getattr(instance, "_was_published_before_save", False)
    if not created and was_published:
        return

    transaction.on_commit(lambda: _dispatch_exam_notification(instance.id))

