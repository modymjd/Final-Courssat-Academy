from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import AboutPageContent, Partnership, TeamMember

ABOUT_CACHE_KEY = "public_about_content"


@receiver([post_save, post_delete], sender=AboutPageContent)
@receiver([post_save, post_delete], sender=TeamMember)
@receiver([post_save, post_delete], sender=Partnership)
def invalidate_about_cache_on_change(sender, **kwargs):
    cache.delete(ABOUT_CACHE_KEY)
