from rest_framework import serializers

from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source="course.id", read_only=True)
    course_name = serializers.CharField(source="course.title", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    instructor_name = serializers.CharField(source="course.instructor.full_name", read_only=True, default="إديوسمارت")

    class Meta:
        model = Certificate
        fields = ("id", "course_id", "course_name", "student_name", "instructor_name", "issued_at", "grade", "serial")
        read_only_fields = fields
