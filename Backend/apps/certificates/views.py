from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Certificate
from .serializers import CertificateSerializer


class CertificateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(self, "swagger_fake_view", False) or not user.is_authenticated:
            return Certificate.objects.none()
        qs = Certificate.objects.select_related("course", "course__instructor", "student")
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "instructor":
            return qs.filter(course__instructor=user)
        return qs

    @action(detail=False, methods=["get"], url_path="verify/(?P<serial>[^/.]+)", permission_classes=[AllowAny])
    def verify(self, request, serial=None):
        """Public endpoint allowing verification of certificate authenticity by serial."""
        cert = get_object_or_404(
            Certificate.objects.select_related("course", "course__instructor", "student"), serial__iexact=serial
        )
        return Response(
            {
                "valid": True,
                "certificate": CertificateSerializer(cert).data,
                "message": "هذه الشهادة معتمدة وصادرة رسمياً من منصة إديوسمارت.",
            },
            status=status.HTTP_200_OK,
        )
