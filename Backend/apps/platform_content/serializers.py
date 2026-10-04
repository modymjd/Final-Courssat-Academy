from rest_framework import serializers

from .models import AboutPageContent, Partnership, TeamMember


def get_full_media_url(request, field_file):
    """Utility helper to build full URL for uploaded media files."""
    if not field_file:
        return None
    if request is not None:
        return request.build_absolute_uri(field_file.url)
    return field_file.url


class TeamMemberSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
        fields = ["id", "name", "role", "quote", "photo", "photo_url", "order"]
        extra_kwargs = {
            "photo": {"write_only": True, "required": False, "allow_null": True},
        }

    def get_photo_url(self, obj):
        request = self.context.get("request")
        return get_full_media_url(request, obj.photo)


class PartnershipSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Partnership
        fields = ["id", "partner_name", "date", "description", "photo", "photo_url", "order"]
        extra_kwargs = {
            "photo": {"write_only": True, "required": False, "allow_null": True},
        }

    def get_photo_url(self, obj):
        request = self.context.get("request")
        return get_full_media_url(request, obj.photo)


class AboutPageContentSerializer(serializers.ModelSerializer):
    founder_photo_url = serializers.SerializerMethodField()
    company_logo_url = serializers.SerializerMethodField()
    team_members = TeamMemberSerializer(many=True, read_only=True)
    partnerships = PartnershipSerializer(many=True, read_only=True)

    class Meta:
        model = AboutPageContent
        fields = [
            "id",
            # Founder
            "founder_name",
            "founder_title",
            "founder_photo",
            "founder_photo_url",
            "founder_quote",
            # Company
            "company_name",
            "company_tagline",
            "company_description",
            "company_logo",
            "company_logo_url",
            # Platform
            "platform_name",
            "platform_tagline",
            "platform_description",
            # Contact
            "contact_email",
            "contact_phone",
            "facebook_url",
            "instagram_url",
            "linkedin_url",
            "youtube_url",
            "twitter_url",
            # Nested items
            "team_members",
            "partnerships",
            "updated_at",
        ]
        extra_kwargs = {
            "founder_photo": {"write_only": True, "required": False, "allow_null": True},
            "company_logo": {"write_only": True, "required": False, "allow_null": True},
        }

    def get_founder_photo_url(self, obj):
        request = self.context.get("request")
        return get_full_media_url(request, obj.founder_photo)

    def get_company_logo_url(self, obj):
        request = self.context.get("request")
        return get_full_media_url(request, obj.company_logo)
