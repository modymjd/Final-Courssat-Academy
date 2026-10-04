from rest_framework import generics, permissions
from rest_framework.serializers import CharField, ModelSerializer

from apps.accounts.models import CenterStudent, InstructorStudent, UserRole


class BasicStudentSerializer(ModelSerializer):
    student_name = CharField(source="student.full_name", read_only=True)
    student_email = CharField(source="student.email", read_only=True)

    class Meta:
        model = CenterStudent
        fields = ["id", "student_id", "student_name", "student_email", "joined_at", "is_active"]


class InstructorStudentSerializer(ModelSerializer):
    student_name = CharField(source="student.full_name", read_only=True)
    student_email = CharField(source="student.email", read_only=True)

    class Meta:
        model = InstructorStudent
        fields = ["id", "student_id", "student_name", "student_email", "joined_at", "is_active"]


class CenterStudentListView(generics.ListAPIView):
    serializer_class = BasicStudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if user.role != UserRole.CENTER:
            return CenterStudent.objects.none()

        center_profile = getattr(user, "center_profile", None)
        if not center_profile:
            return CenterStudent.objects.none()

        return CenterStudent.objects.filter(center=center_profile).select_related("student").order_by("-joined_at")


class InstructorPrivateStudentListView(generics.ListAPIView):
    serializer_class = InstructorStudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if user.role != UserRole.INSTRUCTOR:
            return InstructorStudent.objects.none()

        return InstructorStudent.objects.filter(instructor=user).select_related("student").order_by("-joined_at")
