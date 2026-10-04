from rest_framework import serializers

from .models import PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    """Serializer for PlatformSettings with full URL resolution for assets."""

    logoUrl = serializers.SerializerMethodField("get_logo_url")
    faviconUrl = serializers.SerializerMethodField("get_favicon_url")
    heroBannerUrl = serializers.SerializerMethodField("get_hero_banner_url")
    promoVideoUrl = serializers.SerializerMethodField("get_promo_video_url")

    class Meta:
        model = PlatformSettings
        fields = (
            "id",
            "site_name",
            "site_tagline",
            "logo",
            "favicon",
            "logoUrl",
            "faviconUrl",
            "primary_color",
            "secondary_color",
            "accent_color",
            "dark_mode_enabled",
            "hero_title",
            "hero_subtitle",
            "hero_banner",
            "promo_video",
            "heroBannerUrl",
            "promoVideoUrl",
            "support_email",
            "support_phone",
            "terms_url",
            "privacy_url",
            "faq_url",
            "facebook_url",
            "twitter_url",
            "linkedin_url",
            "youtube_url",
            "instagram_url",
            "cdn_cache_version",
            "updated_at",
        )
        read_only_fields = ("id", "cdn_cache_version", "updated_at")

    def _get_absolute_url(self, file_field) -> str:
        if not file_field:
            return ""
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(file_field.url)
        return file_field.url

    def get_logo_url(self, obj) -> str:
        return self._get_absolute_url(obj.logo)

    def get_favicon_url(self, obj) -> str:
        return self._get_absolute_url(obj.favicon)

    def get_hero_banner_url(self, obj) -> str:
        return self._get_absolute_url(obj.hero_banner)

    def get_promo_video_url(self, obj) -> str:
        return self._get_absolute_url(obj.promo_video)
