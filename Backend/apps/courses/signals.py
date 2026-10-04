from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Lesson, Review


def _dispatch_lesson_notification(lesson_id: int):
    try:
        from .tasks import notify_new_lesson_task

        notify_new_lesson_task.delay(lesson_id)
    except Exception:
        from .tasks import notify_new_lesson_task

        notify_new_lesson_task(lesson_id)


@receiver(post_save, sender=Lesson)
def lesson_created_notification(sender, instance, created, **kwargs):
    """Notify enrolled students and linked guardians when a new lesson is added."""
    if not created:
        return

    transaction.on_commit(lambda: _dispatch_lesson_notification(instance.id))


def sync_course_and_instructor_ratings(course_id: int):
    from decimal import Decimal

    from django.db.models import Avg

    from .models import Course, Review

    try:
        course = Course.objects.select_related("instructor").get(pk=course_id)
    except Course.DoesNotExist:
        return

    # Update Instructor rating
    instructor = course.instructor
    if instructor and hasattr(instructor, "instructor_profile"):
        inst_avg = Review.objects.filter(course__instructor=instructor).aggregate(avg=Avg("rating"))["avg"]
        profile = instructor.instructor_profile
        profile.rating = Decimal(str(round(inst_avg, 2))) if inst_avg is not None else Decimal("0.00")
        profile.save(update_fields=["rating", "updated_at"])
        try:
            from django.core.cache import cache

            if hasattr(cache, "delete_pattern"):
                cache.delete_pattern("instructors_list:*")  # type: ignore[attr-defined]
        except Exception:
            pass






@receiver(post_save, sender=Review)
@receiver(post_delete, sender=Review)
def review_saved_or_deleted_rating_sync(sender, instance, **kwargs):
    """Keep Course.rating and InstructorProfile.rating automatically synced with reviews."""
    transaction.on_commit(lambda: sync_course_and_instructor_ratings(instance.course_id))

