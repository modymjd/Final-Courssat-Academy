from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.academic_tools.models import AcademicTask
from apps.academic_tools.serializers import AcademicTaskSerializer


class AcademicTaskViewSet(viewsets.ModelViewSet):
    """ViewSet for managing instructor academic tasks (Kanban & List views)."""

    serializer_class = AcademicTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AcademicTask.objects.filter(user=self.request.user).select_related("course", "student")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="kanban")
    def kanban_summary(self, request):
        """Returns tasks grouped by Kanban status columns."""
        qs = self.get_queryset()
        pending = qs.filter(status=AcademicTask.Status.PENDING)
        in_progress = qs.filter(status=AcademicTask.Status.IN_PROGRESS)
        completed = qs.filter(status=AcademicTask.Status.COMPLETED)

        return Response(
            {
                "pending": AcademicTaskSerializer(pending, many=True).data,
                "in_progress": AcademicTaskSerializer(in_progress, many=True).data,
                "completed": AcademicTaskSerializer(completed, many=True).data,
            }
        )
