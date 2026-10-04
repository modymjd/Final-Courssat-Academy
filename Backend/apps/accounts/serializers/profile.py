import re

from rest_framework import serializers

from apps.accounts.models import GuardianProfile, StudentProfile

from .base import validate_national_id_structure


class GuardianSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(max_length=150, required=True)
    relationship = serializers.ChoiceField(
        choices=[("father", "أب"), ("mother", "أم"), ("guardian", "وصي")], required=True
    )
    phone = serializers.CharField(max_length=20, required=True)
    national_id = serializers.CharField(max_length=14, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = GuardianProfile
        fields = ("full_name", "relationship", "phone", "national_id")

    def validate_phone(self, value):
        if value and not re.match(r"^01[0125]\d{8}$", value):
            raise serializers.ValidationError(
                "رقم هاتف ولي الأمر يجب أن يكون رقم مصري صحيح يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015."
            )
        return value

    def validate_national_id(self, value):
        if value:
            validate_national_id_structure(value)
        return value


class StudentProfileSerializer(serializers.ModelSerializer):
    # GuardianProfile is a reverse ForeignKey (`student_profile.guardians`),
    # so the API exposes the first linked guardian under the singular
    # `guardian` contract expected by the frontend.
    guardian = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = (
            "education_level",
            "school_name",
            "grade_level",
            "educational_track",
            "second_language",
            "religion",
            "university_name",
            "faculty_name",
            "study_streak",
            "guardian",
        )

    def get_guardian(self, obj):
        guardian = obj.guardians.order_by("-created_at").first()
        return GuardianSerializer(guardian).data if guardian else None
