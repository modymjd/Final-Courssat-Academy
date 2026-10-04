from rest_framework import serializers

from .models import LiveSession


class LiveSessionSerializer(serializers.ModelSerializer):
    instructor_id = serializers.IntegerField(source="instructor.id", read_only=True)
    instructor_name = serializers.CharField(source="instructor.full_name", read_only=True)
    course_id = serializers.IntegerField(source="course.id", read_only=True, default=None)
    course_name = serializers.CharField(source="course.title", read_only=True, default=None)
    participant_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = LiveSession
        fields = (
            "id",
            "title",
            "description",
            "instructor_id",
            "instructor_name",
            "course",
            "course_id",
            "course_name",
            "scheduled_at",
            "duration",
            "status",
            "participant_count",
            "max_participants",
            "meeting_url",
        )
        read_only_fields = ("id", "participant_count")
