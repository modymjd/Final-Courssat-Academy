from django.core.exceptions import PermissionDenied
from django.db import models, transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsInstructorOrAdmin
from apps.enrollments.models import Enrollment

from .models import LiveSession, LiveSessionStatus
from .serializers import LiveSessionSerializer


class LiveSessionViewSet(viewsets.ModelViewSet):
    queryset = LiveSession.objects.select_related("instructor", "course")
    serializer_class = LiveSessionSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "join"):
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(self, "swagger_fake_view", False) or not user.is_authenticated:
            return qs.none()
        if user.role == "student":
            return qs.filter(models.Q(course__isnull=True) | models.Q(course__enrollments__student=user)).distinct()
        if user.role == "instructor":
            return qs.filter(instructor=user)
        return qs

    def perform_create(self, serializer):
        course = serializer.validated_data.get("course")
        if course and not (
            self.request.user.is_staff or getattr(self.request.user, "role", "") in ("admin", "super_admin")
        ):
            if course.instructor != self.request.user:
                raise PermissionDenied("لا يمكنك ربط جلسة مباشرة بدورة لا تملكها.")
        serializer.save(instructor=self.request.user)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def join(self, request, pk=None):
        session = LiveSession.objects.select_for_update().filter(pk=pk).first()
        if not session:
            return Response({"detail": "Live session not found."}, status=status.HTTP_404_NOT_FOUND)
        user = request.user

        if session.status == LiveSessionStatus.ENDED:
            return Response({"detail": "انتهت هذه الجلسة المباشرة بالفعل."}, status=status.HTTP_400_BAD_REQUEST)

        # Check course enrollment if session is linked to a specific course
        if session.course and not (
            user.is_staff or user == session.instructor or getattr(user, "role", "") in ("admin", "super_admin")
        ):
            if not Enrollment.objects.filter(student=user, course=session.course).exists():
                return Response(
                    {"detail": "يجب التسجيل في الدورة المرتبطة أولاً للانضمام لهذه الجلسة."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # If user is already a participant
        if session.participants.filter(id=user.id).exists():
            return Response(
                LiveSessionSerializer(session, context={"request": request}).data, status=status.HTTP_200_OK
            )

        # Check max participants limit
        if session.participants.count() >= session.max_participants:
            return Response(
                {"detail": "لقد اكتمل العدد الأقصى للمشاركين في هذه الجلسة المباشرة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.participants.add(user)
        return Response(LiveSessionSerializer(session, context={"request": request}).data, status=status.HTTP_200_OK)
