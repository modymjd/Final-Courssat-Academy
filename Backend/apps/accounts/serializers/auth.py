import uuid
from typing import Any, cast

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import (
    CenterProfile,
    GuardianProfile,
    InstructorProfile,
    StudentProfile,
    User,
    UserManager,
    UserRole,
)
from apps.common.exceptions import PrivilegeEscalationError
from apps.common.serializers import FlexiCaseModelSerializer

from .base import (
    ALLOWED_PUBLIC_REGISTRATION_ROLES,
    PRIVILEGED_ROLES,
    _check_forbidden_system_fields,
    _log_privilege_escalation_attempt,
    _sanitize_string,
    validate_and_extract_national_id,
    validate_egyptian_phone,
    validate_minor_guardian,
    validate_name_parts,
    validate_national_id_structure,
    validate_student_education,
)
from .profile import GuardianSerializer
from .user import UserSerializer


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8, validators=[validate_password])


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField(required=True, help_text="Google OAuth2 ID token credential")
    role = serializers.CharField(required=False, allow_blank=True, help_text="Role to sign up as (student, instructor, center, guardian)")

    def validate_role(self, value):
        if not value:
            return UserRole.STUDENT
        role_value = str(value).strip().lower()
        if role_value not in ALLOWED_PUBLIC_REGISTRATION_ROLES:
            raise serializers.ValidationError(f"Role '{role_value}' is not allowed for public registration.")
        return role_value


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        device_id = uuid.uuid4().hex
        user.active_device_id = device_id
        user.save(update_fields=["active_device_id"])
        token["device_id"] = device_id
        token["role"] = user.role
        return token

    def validate(self, attrs: Any) -> dict[str, Any]:
        data: dict[str, Any] = dict(super().validate(attrs))  # type: ignore[assignment]
        data["user"] = UserSerializer(self.user, context=self.context).data
        return data


class RegisterSerializer(FlexiCaseModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, validators=[validate_password])
    role = serializers.CharField(required=False, default=UserRole.STUDENT)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=80)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=80)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=32)
    national_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=14)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=[("male", "ذكر"), ("female", "أنثى")], required=False, allow_blank=True)
    governorate = serializers.CharField(required=False, allow_blank=True, max_length=80)
    city = serializers.CharField(required=False, allow_blank=True, max_length=80)
    bio = serializers.CharField(required=False, allow_blank=True)

    education_level = serializers.ChoiceField(
        choices=[
            ("primary", "ابتدائي"),
            ("prep", "إعدادي"),
            ("secondary", "ثانوي"),
            ("baccalaureate", "بكالوريا مصرية"),
            ("university", "جامعي"),
        ],
        required=False,
        allow_blank=True,
    )
    school_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    grade_level = serializers.CharField(required=False, allow_blank=True, max_length=80)
    educational_track = serializers.CharField(required=False, allow_blank=True, max_length=40)
    second_language = serializers.ChoiceField(
        choices=[("french", "فرنسي"), ("german", "ألماني"), ("italian", "إيطالي"), ("spanish", "إسباني")],
        required=False,
        allow_blank=True,
    )
    religion = serializers.ChoiceField(
        choices=[("islamic", "إسلامي"), ("christian", "مسيحي")],
        required=False,
        allow_blank=True,
    )
    university_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    faculty_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    guardian = GuardianSerializer(required=False, allow_null=True)

    title = serializers.CharField(required=False, allow_blank=True, max_length=120)
    specialization = serializers.CharField(required=False, allow_blank=True, max_length=120)
    teaching_subject = serializers.CharField(required=False, allow_blank=True, max_length=50)
    teaching_stages = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    teaching_grades = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    years_of_experience = serializers.IntegerField(required=False, default=0)
    qualification = serializers.CharField(required=False, allow_blank=True, max_length=150)

    student_national_id = serializers.CharField(required=False, allow_blank=True, max_length=14)
    guardian_relationship = serializers.ChoiceField(
        choices=[("father", "أب"), ("mother", "أم"), ("guardian", "وصي")],
        required=False,
        default="father",
    )

    institution_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    institution_type = serializers.ChoiceField(
        choices=[
            ("center", "سنتر تعليمي"),
            ("college", "كلية"),
            ("university", "جامعة"),
            ("institute", "معهد"),
            ("academy", "أكاديمية"),
        ],
        required=False,
        default="center",
    )
    address = serializers.CharField(required=False, allow_blank=True)
    license_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    website = serializers.URLField(required=False, allow_blank=True)

    class Meta:  # type: ignore[misc]
        model = User
        fields = (
            "email", "password", "role", "full_name", "first_name", "last_name", "phone", "national_id",
            "date_of_birth", "gender", "governorate", "city", "bio", "education_level", "school_name",
            "grade_level", "educational_track", "second_language", "religion", "university_name",
            "faculty_name", "guardian", "title", "specialization", "teaching_subject", "teaching_stages",
            "teaching_grades", "years_of_experience",
            "qualification", "student_national_id", "guardian_relationship", "institution_name",
            "institution_type", "address", "license_number", "website",
        )
        extra_kwargs = {
            "email": {
                "error_messages": {
                    "unique": "البريد الإلكتروني مسجّل بالفعل لمستخدم آخر. يرجى تسجيل الدخول أو استخدام بريد آخر.",
                }
            }
        }

    def validate(self, attrs):
        raw_data = self.initial_data
        request = self.context.get("request")

        submitted_role = raw_data.get("role")
        if submitted_role is not None:
            role_value = str(submitted_role).strip().lower()
            if role_value in PRIVILEGED_ROLES:
                _log_privilege_escalation_attempt(
                    raw_data, request, reason=f"Attempted public registration with forbidden privileged role: '{submitted_role}'"
                )
                raise PrivilegeEscalationError(detail="Administrative role registration is forbidden via this endpoint.")
            if role_value not in ALLOWED_PUBLIC_REGISTRATION_ROLES:
                raise serializers.ValidationError({"role": f"الدور '{role_value}' غير متاح للتسجيل العام."})
            attrs["role"] = role_value
        else:
            attrs.setdefault("role", UserRole.STUDENT)

        target_role = attrs["role"]
        _check_forbidden_system_fields(raw_data, request)

        for field_name in (
            "full_name", "first_name", "last_name", "governorate", "city", "bio", "title",
            "specialization", "qualification", "institution_name", "address", "license_number",
        ):
            value = attrs.get(field_name)
            if value and isinstance(value, str):
                attrs[field_name] = _sanitize_string(value)

        validate_name_parts(attrs, user=getattr(self, "instance", None))
        validate_egyptian_phone(attrs.get("phone"))

        if attrs.get("national_id"):
            validate_and_extract_national_id(attrs.get("national_id"), attrs)

        if target_role == UserRole.STUDENT:
            validate_minor_guardian(attrs)
            validate_student_education(attrs)
        elif target_role == UserRole.INSTRUCTOR:
            teaching_subject = attrs.get("teaching_subject", "")
            specialization = attrs.get("specialization", "")
            if not specialization and teaching_subject:
                attrs["specialization"] = teaching_subject
            elif not specialization:
                attrs["specialization"] = "معلم عام"
        elif target_role == UserRole.CENTER:
            if not attrs.get("institution_name"):
                full_name = attrs.get("full_name") or f"{attrs.get('first_name', '')} {attrs.get('last_name', '')}".strip()
                attrs["institution_name"] = f"سنتر {full_name}" if full_name else "سنتر تعليمي"
        elif target_role == UserRole.GUARDIAN:
            student_nid = attrs.get("student_national_id", "").strip()
            if not student_nid:
                raise serializers.ValidationError({"student_national_id": "الرقم القومي للطالب المراد متابعته إلزامي لإنشاء حساب ولي الأمر."})
            validate_national_id_structure(student_nid)
            student_user = User.objects.filter(national_id=student_nid, role=UserRole.STUDENT).first()
            if not student_user:
                raise serializers.ValidationError({"student_national_id": "لم يتم العثور على حساب طالب مسجل بهذا الرقم القومي. يرجى التأكد من تسجيل حساب الطالب أولاً."})
            self._linked_student = student_user

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        target_role = validated_data.get("role", UserRole.STUDENT)
        validated_data.pop("full_name", None)
        guardian_data = validated_data.pop("guardian", None)
        education_level = validated_data.pop("education_level", "")
        school_name = validated_data.pop("school_name", "")
        grade_level = validated_data.pop("grade_level", "")
        educational_track = validated_data.pop("educational_track", "")
        second_language = validated_data.pop("second_language", "")
        religion = validated_data.pop("religion", "")
        university_name = validated_data.pop("university_name", "")
        faculty_name = validated_data.pop("faculty_name", "")
        title = validated_data.pop("title", "")
        specialization = validated_data.pop("specialization", "")
        teaching_subject = validated_data.pop("teaching_subject", "")
        teaching_stages = validated_data.pop("teaching_stages", [])
        teaching_grades = validated_data.pop("teaching_grades", [])
        years_of_experience = validated_data.pop("years_of_experience", 0)
        qualification = validated_data.pop("qualification", "")
        validated_data.pop("student_national_id", "")
        guardian_relationship = validated_data.pop("guardian_relationship", "father")
        institution_name = validated_data.pop("institution_name", "")
        institution_type = validated_data.pop("institution_type", "center")
        address = validated_data.pop("address", "")
        license_number = validated_data.pop("license_number", "")
        website = validated_data.pop("website", "")

        user = cast(UserManager, User.objects).create_user(**validated_data)

        if target_role == UserRole.STUDENT:
            student_profile, _ = StudentProfile.objects.get_or_create(user=user)
            student_profile.education_level = education_level
            student_profile.school_name = school_name
            student_profile.grade_level = grade_level
            student_profile.educational_track = educational_track
            student_profile.second_language = second_language
            student_profile.religion = religion
            student_profile.university_name = university_name
            student_profile.faculty_name = faculty_name
            student_profile.save()
            if guardian_data:
                GuardianProfile.objects.create(
                    student_profile=student_profile, full_name=guardian_data.get("full_name", ""),
                    relationship=guardian_data.get("relationship", "father"), phone=guardian_data.get("phone", ""),
                    national_id=guardian_data.get("national_id") or "",
                )
        elif target_role == UserRole.INSTRUCTOR:
            instructor_profile, _ = InstructorProfile.objects.get_or_create(user=user)
            instructor_profile.title = title or "معلم"
            instructor_profile.specialization = specialization or teaching_subject or "عام"
            instructor_profile.teaching_subject = teaching_subject or specialization or ""
            instructor_profile.teaching_stages = teaching_stages or []
            instructor_profile.teaching_grades = teaching_grades or []
            instructor_profile.years_of_experience = years_of_experience or 0
            instructor_profile.qualification = qualification or "مؤهل عالي"
            instructor_profile.save()
        elif target_role == UserRole.CENTER:
            center_profile, _ = CenterProfile.objects.get_or_create(user=user)
            center_profile.institution_name = institution_name or f"سنتر {user.full_name}"
            center_profile.institution_type = institution_type or "center"
            center_profile.address = address
            center_profile.license_number = license_number
            center_profile.website = website
            center_profile.save()
        elif target_role == UserRole.GUARDIAN:
            student_user = getattr(self, "_linked_student", None)
            if student_user:
                student_profile, _ = StudentProfile.objects.get_or_create(user=student_user)
                GuardianProfile.objects.create(
                    guardian_user=user, student_profile=student_profile, full_name=user.full_name,
                    relationship=guardian_relationship, phone=user.phone or "", national_id=user.national_id or "",
                )
                from apps.notifications.models import ParentConsent
                ParentConsent.objects.update_or_create(
                    student=student_user,
                    defaults={"parent_name": user.full_name, "parent_email": user.email, "parent_phone": user.phone or "", "consent_given": True},
                )
        return user


class CompleteProfileSerializer(RegisterSerializer):
    password = None  # type: ignore[assignment]

    class Meta(RegisterSerializer.Meta):
        model = User
        fields = (
            "role", "full_name", "first_name", "last_name", "phone", "national_id", "date_of_birth", "gender",
            "governorate", "city", "bio", "education_level", "school_name", "grade_level",
            "educational_track", "second_language", "religion", "university_name",
            "faculty_name", "guardian", "title", "specialization", "teaching_subject", "teaching_stages",
            "teaching_grades", "years_of_experience", "qualification", "student_national_id",
            "guardian_relationship", "institution_name", "institution_type", "address", "license_number", "website",
        )  # type: ignore[assignment]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        if instance is not None and instance.profile_completed:
            submitted_role = attrs.get("role", instance.role)
            if submitted_role != instance.role:
                raise serializers.ValidationError({"role": "لا يمكن تغيير نوع الحساب بعد إكمال التسجيل. تواصل مع الإدارة إذا كنت تحتاج إلى تغيير رسمي للدور."})
            attrs["role"] = instance.role
        elif instance is not None and instance.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
            raise PrivilegeEscalationError(detail="لا يمكن استخدام استكمال الملف لتعديل حساب إداري.")
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        validated_data.pop("full_name", None)
        guardian_data = validated_data.pop("guardian", None)
        education_level = validated_data.pop("education_level", "")
        school_name = validated_data.pop("school_name", "")
        grade_level = validated_data.pop("grade_level", "")
        educational_track = validated_data.pop("educational_track", "")
        second_language = validated_data.pop("second_language", "")
        religion = validated_data.pop("religion", "")
        university_name = validated_data.pop("university_name", "")
        faculty_name = validated_data.pop("faculty_name", "")
        qualification = validated_data.pop("qualification", "")
        specialization = validated_data.pop("specialization", "")
        teaching_subject = validated_data.pop("teaching_subject", "")
        teaching_stages = validated_data.pop("teaching_stages", [])
        teaching_grades = validated_data.pop("teaching_grades", [])
        years_of_experience = validated_data.pop("years_of_experience", 0)
        validated_data.pop("student_national_id", "")
        guardian_relationship = validated_data.pop("guardian_relationship", "father")
        institution_name = validated_data.pop("institution_name", "")
        institution_type = validated_data.pop("institution_type", "center")
        address = validated_data.pop("address", "")
        license_number = validated_data.pop("license_number", "")
        website = validated_data.pop("website", "")

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.profile_completed = True
        instance.save()

        if instance.role == UserRole.STUDENT:
            student_profile, _ = StudentProfile.objects.get_or_create(user=instance)
            if education_level:
                student_profile.education_level = education_level
            if school_name:
                student_profile.school_name = school_name
            if grade_level:
                student_profile.grade_level = grade_level
            if educational_track:
                student_profile.educational_track = educational_track
            if second_language:
                student_profile.second_language = second_language
            if religion:
                student_profile.religion = religion
            if university_name:
                student_profile.university_name = university_name
            if faculty_name:
                student_profile.faculty_name = faculty_name
            student_profile.save()
            if guardian_data:
                guardian_profile, _ = GuardianProfile.objects.get_or_create(student_profile=student_profile)
                for g_attr, g_val in guardian_data.items():
                    setattr(guardian_profile, g_attr, g_val)
                guardian_profile.save()
        elif instance.role == UserRole.INSTRUCTOR:
            instructor_profile, _ = InstructorProfile.objects.get_or_create(user=instance)
            if qualification:
                instructor_profile.qualification = qualification
            if specialization:
                instructor_profile.specialization = specialization
            elif teaching_subject:
                instructor_profile.specialization = teaching_subject
            if teaching_subject:
                instructor_profile.teaching_subject = teaching_subject
            if teaching_stages:
                instructor_profile.teaching_stages = teaching_stages
            if teaching_grades:
                instructor_profile.teaching_grades = teaching_grades
            if years_of_experience:
                instructor_profile.years_of_experience = years_of_experience
            instructor_profile.save()
        elif instance.role == UserRole.CENTER:
            center_profile, _ = CenterProfile.objects.get_or_create(user=instance)
            if institution_name:
                center_profile.institution_name = institution_name
            if institution_type:
                center_profile.institution_type = institution_type
            if address:
                center_profile.address = address
            if license_number:
                center_profile.license_number = license_number
            if website:
                center_profile.website = website
            center_profile.save()
        elif instance.role == UserRole.GUARDIAN:
            student_user = getattr(self, "_linked_student", None)
            if student_user:
                student_profile, _ = StudentProfile.objects.get_or_create(user=student_user)
                GuardianProfile.objects.create(
                    guardian_user=instance, student_profile=student_profile, full_name=instance.full_name,
                    relationship=guardian_relationship, phone=instance.phone or "", national_id=instance.national_id or "",
                )
                from apps.notifications.models import ParentConsent
                ParentConsent.objects.update_or_create(
                    student=student_user,
                    defaults={"parent_name": instance.full_name, "parent_email": instance.email, "parent_phone": instance.phone or "", "consent_given": True},
                )
        return instance
