from rest_framework import serializers

from .models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source="course.id", read_only=True, default=None)
    course_name = serializers.CharField(source="course.title", read_only=True, default=None)

    class Meta:
        model = CalendarEvent
        fields = ("id", "title", "type", "date", "time", "course", "course_id", "course_name", "description")
        read_only_fields = ("id",)
