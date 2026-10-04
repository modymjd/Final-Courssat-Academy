from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import models


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


SENSITIVE_KEYS = {
    "password",
    "token",
    "access",
    "refresh",
    "secret",
    "api_key",
    "apikey",
    "credentials",
    "private_key",
    "otp",
    "totp",
    "cvv",
    "card_number",
    "credit_card",
}


def mask_sensitive_data(val):
    """Recursively mask sensitive values in dictionaries and lists."""
    if isinstance(val, dict):
        masked = {}
        for k, v in val.items():
            k_lower = str(k).lower()
            if any(sk in k_lower for sk in SENSITIVE_KEYS):
                if isinstance(v, str) and len(v) > 4:
                    masked[k] = f"****{v[-4:]}"
                else:
                    masked[k] = "****"
            else:
                masked[k] = mask_sensitive_data(v)
        return masked
    elif isinstance(val, list):
        return [mask_sensitive_data(item) for item in val]
    return val


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_actions",
    )
    action_type = models.CharField(max_length=80, db_index=True)
    target_model = models.CharField(max_length=120, db_index=True)
    target_id = models.CharField(max_length=120, blank=True)
    old_value = models.JSONField(default=dict, blank=True)
    new_value = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        actor_email = self.actor.email if self.actor else "System/Anonymous"
        return f"AuditLog<{self.action_type}:{self.target_model}:{self.target_id} by {actor_email}>"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionDenied("AuditLog entries are read-only and immutable.")
        # Ensure values are sanitized before saving
        self.old_value = mask_sensitive_data(self.old_value or {})
        self.new_value = mask_sensitive_data(self.new_value or {})
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("AuditLog entries are read-only and cannot be deleted.")


class PlatformSettings(TimestampedModel):
    """Singleton model managing platform branding, theme colors, assets, support links, and CDN versioning."""

    # Visual Identity & Theme Tokens
    site_name = models.CharField(max_length=120, blank=True, default="")
    site_tagline = models.CharField(max_length=255, blank=True, default="")
    logo = models.FileField(upload_to="settings/branding/", null=True, blank=True)
    favicon = models.FileField(upload_to="settings/branding/", null=True, blank=True)
    primary_color = models.CharField(max_length=30, default="#4f46e5")
    secondary_color = models.CharField(max_length=30, default="#06b6d4")
    accent_color = models.CharField(max_length=30, default="#f59e0b")
    dark_mode_enabled = models.BooleanField(default=True)

    # Core Assets (Banners, Hero Images, Promo Videos)
    hero_title = models.CharField(max_length=255, blank=True, default="")
    hero_subtitle = models.TextField(blank=True, default="")
    hero_banner = models.FileField(upload_to="settings/banners/", null=True, blank=True)
    promo_video = models.FileField(upload_to="settings/videos/", null=True, blank=True)

    # Key Links & Footer Support Info
    support_email = models.EmailField(blank=True, default="")
    support_phone = models.CharField(max_length=40, blank=True, default="")
    terms_url = models.URLField(blank=True, default="")
    privacy_url = models.URLField(blank=True, default="")
    faq_url = models.URLField(blank=True, default="")

    # Social Links
    facebook_url = models.URLField(blank=True, default="")
    twitter_url = models.URLField(blank=True, default="")
    linkedin_url = models.URLField(blank=True, default="")
    youtube_url = models.URLField(blank=True, default="")
    instagram_url = models.URLField(blank=True, default="")

    # CDN & Cache Management
    cdn_cache_version = models.IntegerField(default=1)

    class Meta:
        verbose_name = "Platform Setting"
        verbose_name_plural = "Platform Settings"

    def __str__(self) -> str:
        return self.site_name

    def save(self, *args, **kwargs):
        self.pk = 1  # Force Singleton pattern
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
