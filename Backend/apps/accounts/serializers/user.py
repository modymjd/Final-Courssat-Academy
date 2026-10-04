from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from apps.accounts.models import GuardianProfile, StudentProfile, User, UserRole

from .base import _check_forbidden_system_fields
from .profile import GuardianSerializer, StudentProfileSerializer


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    avatar = serializers.SerializerMethodField()
    student_profile = StudentProfileSerializer(read_only=True)

    education_level = serializers.ChoiceField(
        choices=[
            ("primary", "ابتدائي"),
            ("prep", "إعدادي"),
            ("secondary", "ثانوي"),
            ("baccalaureate", "بكالوريا مصرية"),
            ("university", "جامعي"),
        ],
        write_only=True,
        required=False,
        allow_blank=True,
    )
    school_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    grade_level = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=80)
    educational_track = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=40)
    second_language = serializers.ChoiceField(
        choices=[("french", "فرنسي"), ("german", "ألماني"), ("italian", "إيطالي"), ("spanish", "إسباني")],
        write_only=True,
        required=False,
        allow_blank=True,
    )
    religion = serializers.ChoiceField(
        choices=[("islamic", "إسلامي"), ("christian", "مسيحي")],
        write_only=True,
        required=False,
        allow_blank=True,
    )
    university_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    faculty_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    guardian = GuardianSerializer(write_only=True, required=False, allow_null=True)


    qualification = serializers.CharField(source="instructor_profile.qualification", read_only=True, default="")
    specialization = serializers.CharField(source="instructor_profile.specialization", read_only=True, default="")
    teaching_subject = serializers.CharField(source="instructor_profile.teaching_subject", read_only=True, default="")
    teaching_stages = serializers.JSONField(source="instructor_profile.teaching_stages", read_only=True, default=list)  # type: ignore[arg-type]
    teaching_grades = serializers.JSONField(source="instructor_profile.teaching_grades", read_only=True, default=list)  # type: ignore[arg-type]
    years_of_experience = serializers.IntegerField(source="instructor_profile.years_of_experience", read_only=True, default=0)
    teacher_uid = serializers.CharField(source="instructor_profile.teacher_uid", read_only=True, default="")

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "full_name", "avatar", "role", "auth_provider",
            "profile_completed", "must_change_password", "is_first_login", "teacher_uid", "phone", "national_id",
            "date_of_birth", "gender", "governorate", "city", "bio", "student_profile", "education_level",
            "school_name", "grade_level", "educational_track", "second_language", "religion",
            "university_name", "faculty_name", "guardian", "qualification",
            "specialization", "teaching_subject", "teaching_stages", "teaching_grades", "years_of_experience",
            "created_at", "last_login_at", "tutorial_completed_at", "tutorial_version",
        )
        read_only_fields = (
            "id", "role", "auth_provider", "created_at", "last_login_at", "teacher_uid",
            "profile_completed", "must_change_password", "is_first_login",
        )

    def validate(self, attrs):
        _check_forbidden_system_fields(self.initial_data, self.context.get("request"))
        if attrs.get("guardian") is not None:
            instance = self.instance
            if instance is not None and instance.role != UserRole.STUDENT:
                raise serializers.ValidationError({"guardian": "بيانات ولي الأمر متاحة لحساب الطالب فقط."})
        return attrs

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    @transaction.atomic
    def update(self, instance, validated_data):
        student_fields = {
            "education_level",
            "school_name",
            "grade_level",
            "educational_track",
            "second_language",
            "religion",
            "university_name",
            "faculty_name",
        }

        student_profile_data = {
            field: validated_data.pop(field) for field in list(student_fields) if field in validated_data
        }
        guardian_data = validated_data.pop("guardian", serializers.empty)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if instance.role == UserRole.STUDENT and (student_profile_data or guardian_data is not serializers.empty):
            student_profile, _ = StudentProfile.objects.get_or_create(user=instance)
            for attr, value in student_profile_data.items():
                setattr(student_profile, attr, value)
            student_profile.save()

            if guardian_data is not serializers.empty:
                if guardian_data is None:
                    GuardianProfile.objects.filter(student_profile=student_profile).delete()
                else:
                    guardian_profile = (
                        GuardianProfile.objects.filter(student_profile=student_profile)
                        .order_by("-created_at", "-id")
                        .first()
                    )
                    if guardian_profile is None:
                        guardian_profile = GuardianProfile(student_profile=student_profile)
                    for attr, value in guardian_data.items():
                        setattr(guardian_profile, attr, value)
                    guardian_profile.save()

        instance.refresh_from_db()
        return instance


class UserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    full_name = serializers.CharField(read_only=True)
    student_profile = StudentProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "full_name", "role", "is_active", "phone",
            "national_id", "date_of_birth", "gender", "governorate", "city", "bio", "student_profile",
            "created_at", "password",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        password = validated_data.pop("password", None) or User.objects.make_random_password()
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RoleChangeSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserRole.choices)

    def validate_role(self, value):
        if value == UserRole.SUPER_ADMIN:
            request = self.context.get("request")
            if not request or not request.user or request.user.role != UserRole.SUPER_ADMIN:
                raise serializers.ValidationError("Super Admin role can only be granted by an existing Super Admin.")
        return value


class InstructorPublicSerializer(UserSerializer):
    title = serializers.CharField(source="instructor_profile.title", read_only=True, default="")
    specialization = serializers.CharField(source="instructor_profile.specialization", read_only=True, default="")
    teaching_subject = serializers.CharField(source="instructor_profile.teaching_subject", read_only=True, default="")
    teaching_stages = serializers.JSONField(source="instructor_profile.teaching_stages", read_only=True, default=list)  # type: ignore[arg-type]
    teaching_grades = serializers.JSONField(source="instructor_profile.teaching_grades", read_only=True, default=list)  # type: ignore[arg-type]
    years_of_experience = serializers.IntegerField(source="instructor_profile.years_of_experience", read_only=True, default=0)
    qualification = serializers.CharField(source="instructor_profile.qualification", read_only=True, default="")
    is_verified = serializers.BooleanField(source="instructor_profile.is_verified", read_only=True, default=False)
    is_featured = serializers.BooleanField(source="instructor_profile.is_featured", read_only=True, default=False)
    students_count = serializers.IntegerField(read_only=True, default=0)
    courses_count = serializers.IntegerField(read_only=True, default=0)
    rating_avg = serializers.FloatField(read_only=True, default=0.0)
    review_count = serializers.IntegerField(read_only=True, default=0)
    joined_at = serializers.DateTimeField(source="created_at", read_only=True)
    profile_url = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = (
            "id", "email", "first_name", "last_name", "full_name", "avatar", "role", "bio", "title",
            "specialization", "teaching_subject", "teaching_stages", "teaching_grades", "years_of_experience",
            "qualification", "is_verified", "is_featured", "students_count", "courses_count",
            "rating_avg", "review_count", "joined_at", "profile_url",
        )  # type: ignore[assignment]

    def get_profile_url(self, obj) -> str:
        slug = slugify(obj.full_name, allow_unicode=True)
        if slug:
            return f"/instructors/{obj.id}-{slug}"
        return f"/instructors/{obj.id}"
