from django.apps import AppConfig


class PlatformContentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.platform_content"
    verbose_name = "Platform Content & CMS"

    def ready(self):
        import apps.platform_content.signals  # noqa: F401
