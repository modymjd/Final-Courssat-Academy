from django.core.cache import cache
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.middleware import log_audit_event
from apps.common.permissions import IsSuperAdmin

from .models import AboutPageContent, Partnership, TeamMember
from .serializers import (
    AboutPageContentSerializer,
    PartnershipSerializer,
    TeamMemberSerializer,
)

ABOUT_CACHE_KEY = "public_about_content"


def invalidate_about_cache():
    """Invalidate cached public About page content immediately."""
    cache.delete(ABOUT_CACHE_KEY)


class PublicAboutView(APIView):
    """
    Public endpoint to fetch About page content including team members & partnerships.
    Supports caching for optimal performance.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        cached_data = cache.get(ABOUT_CACHE_KEY)
        if cached_data is not None:
            return Response(cached_data)

        about_obj = AboutPageContent.get_content()
        serializer = AboutPageContentSerializer(about_obj, context={"request": request})
        data = serializer.data

        # Cache response for 1 hour (3600 seconds)
        cache.set(ABOUT_CACHE_KEY, data, timeout=3600)
        return Response(data)


class SuperAdminAboutView(APIView):
    """
    Super Admin endpoint to fetch & update About page content.
    """

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        about_obj = AboutPageContent.get_content()
        serializer = AboutPageContentSerializer(about_obj, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        about_obj = AboutPageContent.get_content()
        old_data = AboutPageContentSerializer(about_obj, context={"request": request}).data

        serializer = AboutPageContentSerializer(
            about_obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_obj = serializer.save()

        new_data = AboutPageContentSerializer(updated_obj, context={"request": request}).data

        # Invalidate public cache immediately
        invalidate_about_cache()

        log_audit_event(
            request=request,
            action_type="ABOUT_CONTENT_UPDATED",
            target_model="AboutPageContent",
            target_id="1",
            old_value=old_data,
            new_value=new_data,
        )

        return Response(
            {
                "message": "تم تحديث محتوى صفحة من نحن بنجاح.",
                "data": new_data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        return self.patch(request)

    def put(self, request):
        return self.patch(request)


class SuperAdminTeamMemberViewSet(viewsets.ModelViewSet):
    """
    Super Admin ViewSet for full CRUD operations on Team Members.
    """

    permission_classes = [IsSuperAdmin]
    serializer_class = TeamMemberSerializer
    queryset = TeamMember.objects.all()

    def perform_create(self, serializer):
        about_page = AboutPageContent.get_content()
        member = serializer.save(about_page=about_page)
        invalidate_about_cache()
        log_audit_event(
            request=self.request,
            action_type="TEAM_MEMBER_CREATED",
            target_model="TeamMember",
            target_id=str(member.id),
            old_value={},
            new_value=serializer.data,
        )

    def perform_update(self, serializer):
        old_data = TeamMemberSerializer(self.get_object(), context={"request": self.request}).data
        member = serializer.save()
        invalidate_about_cache()
        log_audit_event(
            request=self.request,
            action_type="TEAM_MEMBER_UPDATED",
            target_model="TeamMember",
            target_id=str(member.id),
            old_value=old_data,
            new_value=serializer.data,
        )

    def perform_destroy(self, instance):
        old_data = TeamMemberSerializer(instance, context={"request": self.request}).data
        member_id = str(instance.id)
        instance.delete()
        invalidate_about_cache()
        log_audit_event(
            request=self.request,
            action_type="TEAM_MEMBER_DELETED",
            target_model="TeamMember",
            target_id=member_id,
            old_value=old_data,
            new_value={},
        )


class SuperAdminPartnershipViewSet(viewsets.ModelViewSet):
    """
    Super Admin ViewSet for full CRUD operations on Partnerships.
    """

    permission_classes = [IsSuperAdmin]
    serializer_class = PartnershipSerializer
    queryset = Partnership.objects.all()

    def perform_create(self, serializer):
        about_page = AboutPageContent.get_content()
        partnership = serializer.save(about_page=about_page)
        invalidate_about_cache()
        log_audit_event(
            request=self.request,
            action_type="PARTNERSHIP_CREATED",
            target_model="Partnership",
            target_id=str(partnership.id),
            old_value={},
            new_value=serializer.data,
        )

    def perform_update(self, serializer):
        old_data = PartnershipSerializer(self.get_object(), context={"request": self.request}).data
        partnership = serializer.save()
        invalidate_about_cache()
        log_audit_event(
            request=self.request,
            action_type="PARTNERSHIP_UPDATED",
            target_model="Partnership",
            target_id=str(partnership.id),
            old_value=old_data,
            new_value=serializer.data,
        )

    def perform_destroy(self, instance):
        old_data = PartnershipSerializer(instance, context={"request": self.request}).data
        partnership_id = str(instance.id)
        instance.delete()
        invalidate_about_cache()
        log_audit_event(
            request=self.request,
            action_type="PARTNERSHIP_DELETED",
            target_model="Partnership",
            target_id=partnership_id,
            old_value=old_data,
            new_value={},
        )
