from django.core.cache import cache
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import AdminProfile, CenterProfile, InstructorProfile, StudentProfile, User, UserRole


def bump_instructors_cache_version():
    try:
        cache.incr("instructors_cache_version")
    except (ValueError, TypeError):
        cache.set("instructors_cache_version", 1, timeout=None)


@receiver(post_save, sender=User)
def ensure_role_profile(sender, instance: User, created, **kwargs):
    if instance.role == UserRole.STUDENT:
        StudentProfile.objects.get_or_create(user=instance)
    elif instance.role == UserRole.INSTRUCTOR:
        profile, prof_created = InstructorProfile.objects.get_or_create(user=instance)
        if prof_created:
            bump_instructors_cache_version()
    elif instance.role == UserRole.CENTER:
        CenterProfile.objects.get_or_create(user=instance)
    elif instance.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        AdminProfile.objects.get_or_create(user=instance)


@receiver(pre_save, sender=InstructorProfile)
def track_verification_change(sender, instance: InstructorProfile, **kwargs):
    if instance.pk:
        old = InstructorProfile.objects.filter(pk=instance.pk).values("is_verified", "is_featured").first()
        instance._verification_changed = old is not None and (
            old["is_verified"] != instance.is_verified or old["is_featured"] != instance.is_featured
        )
    else:
        instance._verification_changed = True


@receiver(post_save, sender=InstructorProfile)
def bump_cache_on_verification_change(sender, instance: InstructorProfile, created, **kwargs):
    if created or getattr(instance, "_verification_changed", False):
        bump_instructors_cache_version()
