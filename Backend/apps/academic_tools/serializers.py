from rest_framework import serializers

from apps.academic_tools.models import AcademicTask


class AcademicTaskSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = AcademicTask
        fields = [
            "id",
            "title",
            "description",
            "priority",
            "status",
            "task_type",
            "due_date",
            "course",
            "course_title",
            "student",
            "student_name",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "completed_at", "created_at", "updated_at"]
