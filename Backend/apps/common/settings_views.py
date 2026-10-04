from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.middleware import log_audit_event
from apps.common.permissions import IsSuperAdmin

from .models import PlatformSettings
from .settings_serializers import PlatformSettingsSerializer


class PublicPlatformSettingsView(APIView):
    """Public endpoint to fetch active platform settings and theme tokens."""

    permission_classes = [AllowAny]

    def get(self, request):
        settings_obj = PlatformSettings.get_settings()
        serializer = PlatformSettingsSerializer(settings_obj, context={"request": request})
        return Response(serializer.data)


class SuperAdminPlatformSettingsView(APIView):
    """Super Admin endpoint to inspect and update platform settings & assets."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        settings_obj = PlatformSettings.get_settings()
        serializer = PlatformSettingsSerializer(settings_obj, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        settings_obj = PlatformSettings.get_settings()
        old_data = PlatformSettingsSerializer(settings_obj).data

        serializer = PlatformSettingsSerializer(
            settings_obj, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        updated_settings = serializer.save()

        new_data = PlatformSettingsSerializer(updated_settings).data

        log_audit_event(
            request=request,
            action_type="PLATFORM_SETTINGS_UPDATED",
            target_model="PlatformSettings",
            target_id="1",
            old_value=old_data,
            new_value=new_data,
        )

        return Response(
            {
                "message": "Platform settings & visual theme updated successfully.",
                "settings": new_data,
            }
        )

    def post(self, request):
        return self.patch(request)

    def put(self, request):
        return self.patch(request)


@api_view(["POST"])
@permission_classes([IsSuperAdmin])
def super_admin_invalidate_cdn(request):
    """Invalidate CDN cache by incrementing cdn_cache_version."""
    settings_obj = PlatformSettings.get_settings()
    old_version = settings_obj.cdn_cache_version
    settings_obj.cdn_cache_version += 1
    settings_obj.save(update_fields=["cdn_cache_version"])

    log_audit_event(
        request=request,
        action_type="CDN_CACHE_INVALIDATED",
        target_model="PlatformSettings",
        target_id="1",
        old_value={"cdn_cache_version": old_version},
        new_value={"cdn_cache_version": settings_obj.cdn_cache_version},
    )

    return Response(
        {
            "message": "CDN Cache invalidation triggered successfully.",
            "cdn_cache_version": settings_obj.cdn_cache_version,
        },
        status=status.HTTP_200_OK,
    )
