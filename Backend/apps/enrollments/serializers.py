import re
import uuid
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.courses.models import Course, Lesson
from apps.courses.serializers import CourseSummarySerializer

from .models import Enrollment, StudentNote


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseSummarySerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(source="course", read_only=True)
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_email = serializers.CharField(source="student.email", read_only=True)
    completed_lesson_ids = serializers.SerializerMethodField()
    completedLessonIds = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    next_lesson_id = serializers.SerializerMethodField()
    nextLessonId = serializers.SerializerMethodField()
    next_lesson_title = serializers.SerializerMethodField()
    nextLessonTitle = serializers.SerializerMethodField()
    lastAccessedAt = serializers.DateTimeField(source="last_accessed_at", read_only=True)
    enrolledAt = serializers.DateTimeField(source="enrolled_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)
    expiresAt = serializers.DateTimeField(source="expires_at", read_only=True)
    accessStatus = serializers.CharField(source="access_status", read_only=True)
    isExpired = serializers.BooleanField(source="is_expired", read_only=True)
    isInGracePeriod = serializers.BooleanField(source="is_in_grace_period", read_only=True)
    isLifetime = serializers.BooleanField(source="is_lifetime", read_only=True)

    def _get_completed_lesson_ids(self, obj):
        cached = getattr(obj, "_cached_completed_lesson_ids", None)
        if cached is not None:
            return cached
        # The list endpoint prefetches lesson_completions. Keep a safe fallback for
        # serializers used outside that queryset.
        cached = [lc.lesson_id for lc in obj.lesson_completions.all()]
        obj._cached_completed_lesson_ids = cached
        return cached

    def get_completed_lesson_ids(self, obj):
        return self._get_completed_lesson_ids(obj)

    def get_completedLessonIds(self, obj):
        return self._get_completed_lesson_ids(obj)

    def get_progress(self, obj):
        return obj.progress

    def _get_next_lesson(self, obj):
        cached = getattr(obj, "_cached_next_lesson", None)
        if cached is not None:
            return cached
        completed_ids = set(self._get_completed_lesson_ids(obj))
        # Enrollment list/retrieve querysets prefetch course -> modules -> lessons,
        # so traversing the curriculum here must remain in-memory.
        modules = list(obj.course.modules.all())
        for module in modules:
            lessons = list(module.lessons.all())
            for lesson in lessons:
                if lesson.id not in completed_ids:
                    obj._cached_next_lesson = lesson
                    return lesson
        for module in modules:
            lessons = list(module.lessons.all())
            if lessons:
                obj._cached_next_lesson = lessons[0]
                return lessons[0]
        obj._cached_next_lesson = None
        return None

    def get_next_lesson_id(self, obj):
        lesson = self._get_next_lesson(obj)
        return lesson.id if lesson else None

    def get_nextLessonId(self, obj):
        return self.get_next_lesson_id(obj)

    def get_next_lesson_title(self, obj):
        lesson = self._get_next_lesson(obj)
        return lesson.title if lesson else None

    def get_nextLessonTitle(self, obj):
        return self.get_next_lesson_title(obj)

    certificate_id = serializers.SerializerMethodField()
    certificateId = serializers.SerializerMethodField()
    certificate_serial = serializers.SerializerMethodField()

    def _get_certificate(self, obj):
        cached = getattr(obj, "_cached_certificate", None)
        if cached is not None:
            return cached

        certificate_id = getattr(obj, "_certificate_id", None)
        certificate_serial = getattr(obj, "_certificate_serial", None)
        if certificate_id is not None or certificate_serial is not None:
            obj._cached_certificate = (certificate_id, certificate_serial)
            return obj._cached_certificate

        try:
            from apps.certificates.models import Certificate

            certificate = Certificate.objects.filter(
                student_id=obj.student_id,
                course_id=obj.course_id,
            ).first()
            obj._cached_certificate = certificate
            return certificate
        except Exception:
            obj._cached_certificate = None
            return None

    def get_certificate_id(self, obj):
        cert = self._get_certificate(obj)
        if isinstance(cert, tuple):
            return cert[0]
        return cert.id if cert else None

    def get_certificateId(self, obj):
        return self.get_certificate_id(obj)

    def get_certificate_serial(self, obj):
        cert = self._get_certificate(obj)
        if isinstance(cert, tuple):
            return cert[1]
        return cert.serial if cert else None

    class Meta:
        model = Enrollment
        fields = (
            "id",
            "course_id",
            "student_id",
            "student_name",
            "student_email",
            "course",
            "progress",
            "completed_lesson_ids",
            "completedLessonIds",
            "next_lesson_id",
            "nextLessonId",
            "next_lesson_title",
            "nextLessonTitle",
            "last_accessed_at",
            "lastAccessedAt",
            "enrolled_at",
            "enrolledAt",
            "completed_at",
            "completedAt",
            "expires_at",
            "expiresAt",
            "status",
            "access_status",
            "accessStatus",
            "is_expired",
            "isExpired",
            "is_in_grace_period",
            "isInGracePeriod",
            "is_lifetime",
            "isLifetime",
            "certificate_id",
            "certificateId",
            "certificate_serial",
        )



class EnrollCreateSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()


class LessonCompleteSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()


class StudentNoteSerializer(serializers.ModelSerializer):
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(),
        required=False,
        allow_null=True,
        source="course",
    )
    lesson_id = serializers.PrimaryKeyRelatedField(
        queryset=Lesson.objects.select_related("module__course").all(),
        required=False,
        allow_null=True,
        source="lesson",
    )
    course_title = serializers.CharField(source="course.title", read_only=True)
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    content = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    client_id = serializers.UUIDField(required=False)
    created_at = serializers.DateTimeField(required=False)

    class Meta:
        model = StudentNote
        fields = (
            "id",
            "client_id",
            "course_id",
            "course_title",
            "lesson_id",
            "lesson_title",
            "title",
            "content",
            "timestamp_seconds",
            "tags",
            "color",
            "is_pinned",
            "blocks",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "updated_at", "course_title", "lesson_title")

    def validate_content(self, value):
        if not value:
            return ""
        clean_text = re.sub(r"<[^>]*>", "", value)
        if len(clean_text) > 5000:
            raise serializers.ValidationError("محتوى الملاحظة لا يمكن أن يتجاوز 5000 حرف.")
        return clean_text

    def validate_created_at(self, value):
        if value and value > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError("تاريخ إنشاء الملاحظة لا يمكن أن يكون في المستقبل.")
        return value

    def validate_timestamp_seconds(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("التوقيت الزمني لا يمكن أن يكون سالباً.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None

        lesson = attrs.get("lesson")
        course = attrs.get("course")

        if lesson:
            inferred_course = lesson.module.course
            if course and course.id != inferred_course.id:
                raise serializers.ValidationError(
                    {"lesson_id": "الدرس لا ينتمي إلى الدورة المحددة."}
                )
            course = inferred_course
            attrs["course"] = inferred_course

            timestamp_seconds = attrs.get("timestamp_seconds")
            if timestamp_seconds is not None:
                video_duration = 0
                if getattr(lesson, "video", None) and getattr(lesson.video, "duration_seconds", 0) > 0:
                    video_duration = lesson.video.duration_seconds
                elif getattr(lesson, "duration", ""):
                    try:
                        from apps.courses.management.commands.audit_lesson_durations import parse_duration_string
                        video_duration = parse_duration_string(lesson.duration)
                    except Exception:
                        video_duration = 0
                if video_duration > 0 and timestamp_seconds > (video_duration + 60):
                    raise serializers.ValidationError(
                        {"timestamp_seconds": f"التوقيت يتجاوز مدة الدرس ({video_duration} ثانية)."}
                    )

        if course and user and user.is_authenticated and getattr(user, "role", "") == "student":
            is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
            if not is_enrolled:
                raise serializers.ValidationError(
                    {"course_id": "يجب أن تكون مسجلاً في الدورة لإضافة ملاحظة عليها."}
                )

        if not attrs.get("client_id") and not self.instance:
            attrs["client_id"] = uuid.uuid4()

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["student"] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("client_id", None)
        validated_data.pop("student", None)
        return super().update(instance, validated_data)


class StudentNoteImportItemSerializer(StudentNoteSerializer):
    client_id = serializers.UUIDField(required=True)


class StudentNoteBulkImportSerializer(serializers.Serializer):
    notes = serializers.ListField(
        child=StudentNoteImportItemSerializer(),
        max_length=500,
        allow_empty=False,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if hasattr(self.fields.get("notes"), "child"):
            self.fields["notes"].child._context = self.context
