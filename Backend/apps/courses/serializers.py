import re
from decimal import Decimal

from rest_framework import serializers

from apps.common.sanitizers import sanitize_html_content
from apps.common.serializers import FlexiCaseModelSerializer

from .curriculum_service import validate_academic_targeting
from .models import (
    Category,
    Course,
    CourseStatus,
    Lesson,
    LessonSummary,
    Module,
    Review,
    Video,
)
from .services.course_quality import flatten_quality_errors, validate_course_publish_quality

MAX_VIDEO_UPLOAD_SIZE_BYTES = 1024 * 1024 * 1024
MAX_VIDEO_CHUNK_SIZE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_UPLOAD_CHUNKS = MAX_VIDEO_UPLOAD_SIZE_BYTES // MAX_VIDEO_CHUNK_SIZE_BYTES
UPLOAD_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class VideoSerializer(serializers.ModelSerializer):
    uploader_id = serializers.IntegerField(source="uploader.id", read_only=True)
    uploader_name = serializers.CharField(source="uploader.full_name", read_only=True)

    class Meta:
        model = Video
        fields = (
            "id",
            "title",
            "uploader_id",
            "uploader_name",
            "status",
            "duration_seconds",
            "file_size_bytes",
            "resolutions",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class VideoUploadChunkSerializer(serializers.Serializer):
    upload_id = serializers.CharField(max_length=64)
    chunk_index = serializers.IntegerField(min_value=0)
    total_chunks = serializers.IntegerField(
        min_value=1,
        max_value=MAX_VIDEO_UPLOAD_CHUNKS,
    )
    chunk = serializers.FileField()

    def validate_upload_id(self, value):
        if not UPLOAD_ID_PATTERN.fullmatch(value):
            raise serializers.ValidationError("Invalid upload identifier.")
        return value

    def validate_chunk(self, value):
        if value.size > MAX_VIDEO_CHUNK_SIZE_BYTES:
            raise serializers.ValidationError(
                f"Chunk size must not exceed {MAX_VIDEO_CHUNK_SIZE_BYTES} bytes."
            )
        return value

    def validate(self, attrs):
        if attrs["chunk_index"] >= attrs["total_chunks"]:
            raise serializers.ValidationError(
                {"chunk_index": "chunk_index must be smaller than total_chunks."}
            )
        return attrs


class VideoUploadCompleteSerializer(serializers.Serializer):
    upload_id = serializers.CharField(max_length=64)
    title = serializers.CharField(max_length=255, trim_whitespace=True)
    total_chunks = serializers.IntegerField(
        min_value=1,
        max_value=MAX_VIDEO_UPLOAD_CHUNKS,
    )
    file_name = serializers.CharField(max_length=255, trim_whitespace=True)

    def validate_upload_id(self, value):
        if not UPLOAD_ID_PATTERN.fullmatch(value):
            raise serializers.ValidationError("Invalid upload identifier.")
        return value

    def validate_title(self, value):
        if not value:
            raise serializers.ValidationError("Video title is required.")
        return value

    def validate_file_name(self, value):
        if not value or value in {".", ".."}:
            raise serializers.ValidationError("A valid video filename is required.")
        return value


class LessonSummarySerializer(serializers.ModelSerializer):
    lesson_id = serializers.IntegerField(source="lesson.id", read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = LessonSummary
        fields = (
            "id",
            "lesson_id",
            "content",
            "attachment",
            "attachment_name",
            "attachment_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "lesson_id",
            "attachment_url",
            "created_at",
            "updated_at",
        )

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        url = obj.attachment.url
        return request.build_absolute_uri(url) if request else url

    def validate_content(self, value):
        return sanitize_html_content(value)


class CategorySerializer(serializers.ModelSerializer):
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "icon", "color", "course_count")

    def get_course_count(self, obj):
        return getattr(obj, "_course_count", 0)


class InstructorSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField(source="full_name")
    avatar = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    def get_title(self, obj):
        profile = getattr(obj, "instructor_profile", None)
        return profile.title if profile else ""


class LessonListSerializer(serializers.ModelSerializer):
    module_id = serializers.IntegerField(source="module.id", read_only=True)
    video_id = serializers.IntegerField(source="video.id", read_only=True, allow_null=True)
    video = VideoSerializer(read_only=True)
    summary = LessonSummarySerializer(read_only=True)
    video_url = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()

    quiz = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    lock_reason = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = (
            "id",
            "module_id",
            "title",
            "type",
            "duration",
            "order",
            "is_free",
            "is_published",
            "available_from",
            "video_id",
            "video",
            "video_url",
            "content",
            "summary",
            "quiz",
            "is_locked",
            "lock_reason",
        )

    def _can_view_content(self, obj) -> bool:
        if obj.is_free:
            return True
        if getattr(obj, "_is_locked", False):
            return False
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "role", "") in ("admin", "super_admin") or getattr(
            user, "is_staff", False
        ):
            return True
        course = obj.module.course
        if course.instructor_id == user.id:
            return True

        cached_enrollments = getattr(course, "_user_enrollments", None)
        if cached_enrollments is not None:
            enrollment = cached_enrollments[0] if cached_enrollments else None
            return bool(enrollment and enrollment.has_active_access)

        cache = self.context.get("_enrolled_course_ids")
        if cache is None:
            from apps.enrollments.models import Enrollment

            cache = set(
                Enrollment.objects.filter(student=user).active_access().values_list(
                    "course_id", flat=True
                )
            )
            if isinstance(self.context, dict):
                self.context["_enrolled_course_ids"] = cache
        return course.id in cache

    def get_video_url(self, obj):
        return obj.video_url if self._can_view_content(obj) else ""

    def get_content(self, obj):
        return obj.content if self._can_view_content(obj) else ""

    def get_quiz(self, obj):
        exams = obj.exams.all() if hasattr(obj, "exams") else []
        if not exams:
            return None
        exam = exams[0]
        exam_data = {
            "id": exam.id,
            "title": exam.title,
            "pass_threshold": exam.pass_threshold,
            "cooldown_seconds": exam.cooldown_seconds,
            "kind": getattr(exam, "kind", ""),
        }
        if hasattr(exam, "_user_quiz_attempts"):
            attempts = exam._user_quiz_attempts
            if attempts:
                last = attempts[0]
                exam_data["is_passed"] = any(a.is_passed for a in attempts)
                exam_data["attempts_count"] = len(attempts)
                from django.utils import timezone

                now = timezone.now()
                elapsed = (now - last.created_at).total_seconds()
                cooldown = max(0, exam.cooldown_seconds - elapsed)
                exam_data["cooldown_remaining_seconds"] = int(cooldown) if not exam_data["is_passed"] else 0
            else:
                exam_data["is_passed"] = False
                exam_data["attempts_count"] = 0
                exam_data["cooldown_remaining_seconds"] = 0
        else:
            exam_data["is_passed"] = False
            exam_data["attempts_count"] = 0
            exam_data["cooldown_remaining_seconds"] = 0
            request = self.context.get("request")
            user = getattr(request, "user", None) if request else None
            if user and user.is_authenticated:
                from apps.assessments.models import StudentExam

                attempts = list(StudentExam.objects.filter(student=user, exam=exam).order_by("-created_at"))
                if attempts:
                    last = attempts[0]
                    exam_data["is_passed"] = any(a.is_passed for a in attempts)
                    exam_data["attempts_count"] = len(attempts)
                    from django.utils import timezone

                    now = timezone.now()
                    elapsed = (now - last.created_at).total_seconds()
                    cooldown = max(0, exam.cooldown_seconds - elapsed)
                    exam_data["cooldown_remaining_seconds"] = int(cooldown) if not exam_data["is_passed"] else 0
        return exam_data

    def get_is_locked(self, obj):
        if not obj.module.course.enforce_quiz_gate:
            return False
        if obj.is_free:
            return False
        # In a real app we'd determine unlock status by traversing earlier lessons/modules
        # For O(1) query constraint with prefetch, assume logic checks prefetched completions.
        return getattr(obj, "_is_locked", False)

    def get_lock_reason(self, obj):
        return getattr(obj, "_lock_reason", None) if self.get_is_locked(obj) else None


class LessonSerializer(LessonListSerializer):
    last_position_seconds = serializers.SerializerMethodField()
    watched_percent = serializers.SerializerMethodField()

    class Meta(LessonListSerializer.Meta):
        fields = LessonListSerializer.Meta.fields + (  # type: ignore[assignment]
            "last_position_seconds",
            "watched_percent",
        )

    def _get_progress(self, obj):
        if hasattr(obj, "_cached_progress"):
            return obj._cached_progress
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated or getattr(user, "role", "") != "student":
            obj._cached_progress = None
            return None
        from apps.enrollments.models import LessonProgress

        obj._cached_progress = LessonProgress.objects.filter(
            enrollment__student=user,
            lesson=obj,
        ).first()
        return obj._cached_progress

    def get_last_position_seconds(self, obj) -> int:
        p = self._get_progress(obj)
        return p.last_position_seconds if p else 0

    def get_watched_percent(self, obj) -> int:
        p = self._get_progress(obj)
        if not p or not p.max_position_seconds:
            return 0
        duration = obj.video.duration_seconds if (obj.video and obj.video.duration_seconds > 0) else 0
        if not duration and obj.duration:
            from apps.courses.management.commands.audit_lesson_durations import parse_duration_string

            duration = parse_duration_string(obj.duration)
        if duration > 0:
            return min(100, round((p.max_position_seconds / duration) * 100))
        return 0


class ModuleSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source="course.id", read_only=True)
    lessons = LessonListSerializer(many=True, read_only=True)
    unit_exams = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ("id", "course_id", "title", "order", "is_published", "available_from", "lessons", "unit_exams")

    def get_unit_exams(self, obj):
        out = []
        for exam in obj.unit_exams.all() if hasattr(obj, "unit_exams") else []:
            exam_data = {
                "id": exam.id,
                "title": exam.title,
                "pass_threshold": exam.pass_threshold,
                "cooldown_seconds": exam.cooldown_seconds,
                "kind": getattr(exam, "kind", ""),
            }
            if hasattr(exam, "_user_unit_attempts"):
                attempts = exam._user_unit_attempts
                if attempts:
                    last = attempts[0]
                    exam_data["is_passed"] = any(a.is_passed for a in attempts)
                    exam_data["attempts_count"] = len(attempts)
                    from django.utils import timezone
                    now = timezone.now()
                    elapsed = (now - last.created_at).total_seconds()
                    cooldown = max(0, exam.cooldown_seconds - elapsed)
                    exam_data["cooldown_remaining_seconds"] = int(cooldown) if not exam_data["is_passed"] else 0
                else:
                    exam_data["is_passed"] = False
                    exam_data["attempts_count"] = 0
                    exam_data["cooldown_remaining_seconds"] = 0
            out.append(exam_data)
        return out


class ReviewSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_avatar = serializers.SerializerMethodField()
    course_id = serializers.IntegerField(source="course.id", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "course_id",
            "student_id",
            "student_name",
            "student_avatar",
            "rating",
            "comment",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def get_student_avatar(self, obj):
        if not obj.student.avatar:
            return None
        request = self.context.get("request")
        url = obj.student.avatar.url
        return request.build_absolute_uri(url) if request else url

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("rating must be between 1 and 5")
        return value


class CourseSummarySerializer(serializers.ModelSerializer):
    instructor = InstructorSummarySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "short_description",
            "description",
            "instructor",
            "category",
            "image",
            "educational_stage",
            "educational_grade",
            "educational_track",
            "subject",
            "subject_branch",
            "price",
            "rating",
            "review_count",
            "student_count",
            "lesson_count",
            "duration",
            "level",
            "is_free",
            "status",
            "language",
            "requirements",
            "objectives",
            "created_at",
            "updated_at",
        )

    def get_image(self, obj):
        if obj.image:
            request = self.context.get("request")
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return obj.image_url or ""

    def get_rating(self, obj):
        val = getattr(obj, "_rating", None)
        return round(float(val), 2) if val is not None else obj.rating

    def get_review_count(self, obj):
        val = getattr(obj, "_review_count", None)
        return val if val is not None else obj.review_count

    def get_student_count(self, obj):
        val = getattr(obj, "_student_count", None)
        return val if val is not None else obj.student_count

    def get_lesson_count(self, obj):
        val = getattr(obj, "_lesson_count", None)
        return val if val is not None else obj.lesson_count


class CourseDetailSerializer(serializers.ModelSerializer):
    instructor = InstructorSummarySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    modules = ModuleSerializer(many=True, read_only=True)
    rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    access_status = serializers.SerializerMethodField()
    expires_at = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "description",
            "short_description",
            "instructor",
            "category",
            "image",
            "educational_stage",
            "educational_grade",
            "educational_track",
            "subject",
            "subject_branch",
            "duration",
            "level",
            "language",
            "price",
            "is_free",
            "enforce_quiz_gate",
            "status",
            "rating",
            "review_count",
            "student_count",
            "lesson_count",
            "requirements",
            "objectives",
            "modules",
            "access_status",
            "expires_at",
            "is_enrolled",
            "created_at",
            "updated_at",
        )

    def _get_student_enrollment(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return None
        cached = getattr(obj, "_user_enrollments", None)
        if cached is not None:
            return cached[0] if cached else None
        cache = getattr(self, "_cached_student_enrollments", None)
        if cache is None:
            cache = {}
            self._cached_student_enrollments = cache
        if obj.id not in cache:
            from apps.enrollments.models import Enrollment
            cache[obj.id] = Enrollment.objects.filter(student=user, course=obj).first()
        return cache[obj.id]

    def get_access_status(self, obj):
        enrollment = self._get_student_enrollment(obj)
        return enrollment.access_status if enrollment else None

    def get_expires_at(self, obj):
        enrollment = self._get_student_enrollment(obj)
        return enrollment.expires_at if enrollment else None

    def get_is_enrolled(self, obj):
        enrollment = self._get_student_enrollment(obj)
        return enrollment is not None

    def to_representation(self, instance):
        cached = getattr(instance, "_user_enrollments", None)
        if cached is not None and isinstance(self.context, dict) and "_enrolled_course_ids" not in self.context:
            enrollment = cached[0] if cached else None
            if enrollment and enrollment.has_active_access:
                self.context["_enrolled_course_ids"] = {instance.id}
            else:
                self.context["_enrolled_course_ids"] = set()

        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if (
            instance.enforce_quiz_gate
            and user
            and user.is_authenticated
            and getattr(user, "role", "") == "student"
        ):
            enrollment = self._get_student_enrollment(instance)
            if enrollment:
                from apps.courses.services.progression_service import is_lesson_unlocked

                for module in instance.modules.all():
                    for lesson in module.lessons.all():
                        unlocked, reason = is_lesson_unlocked(enrollment, lesson)
                        lesson._is_locked = not unlocked
                        lesson._lock_reason = reason
        return super().to_representation(instance)

    def get_image(self, obj):
        if obj.image:
            request = self.context.get("request")
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        if obj.image_url:
            if obj.image_url.startswith("/"):
                request = self.context.get("request")
                return request.build_absolute_uri(obj.image_url) if request else obj.image_url
            return obj.image_url
        return ""

    def get_rating(self, obj):
        val = getattr(obj, "_rating", None)
        return round(float(val), 2) if val is not None else obj.rating

    def get_review_count(self, obj):
        val = getattr(obj, "_review_count", None)
        return val if val is not None else obj.review_count

    def get_student_count(self, obj):
        val = getattr(obj, "_student_count", None)
        return val if val is not None else obj.student_count

    def get_lesson_count(self, obj):
        val = getattr(obj, "_lesson_count", None)
        return val if val is not None else obj.lesson_count


class CourseWriteSerializer(FlexiCaseModelSerializer):
    title = serializers.CharField(
        max_length=200,
        error_messages={
            "blank": "يرجى إدخال عنوان الدورة التعليمية.",
            "required": "يرجى إدخال عنوان الدورة التعليمية.",
        },
    )
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        error_messages={
            "null": "يرجى اختيار تصنيف الدورة التعليمية.",
            "required": "يرجى اختيار تصنيف الدورة التعليمية.",
            "does_not_exist": "التصنيف المحدد غير موجود.",
            "incorrect_type": "قيمة التصنيف غير صحيحة.",
        },
    )
    image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    educational_stage = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    educational_grade = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    educational_track = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    subject = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    subject_branch = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    short_description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "short_description",
            "description",
            "category",
            "image",
            "image_url",
            "educational_stage",
            "educational_grade",
            "educational_track",
            "subject",
            "subject_branch",
            "duration",
            "level",
            "language",
            "price",
            "is_free",
            "enforce_quiz_gate",
            "status",
            "requirements",
            "objectives",
        )
        read_only_fields = ("id",)

    def to_internal_value(self, data):
        string_fields = [
            "educational_stage",
            "educational_grade",
            "educational_track",
            "subject",
            "subject_branch",
            "short_description",
            "description",
            "image_url",
        ]
        if isinstance(data, dict):
            data = data.copy()
            for field in string_fields:
                if field in data and data[field] is None:
                    data[field] = ""
        return super().to_internal_value(data)

    def validate_image_url(self, value):
        if not value:
            return ""
        val = value.strip()
        if val.startswith("/") or val.startswith("http://") or val.startswith("https://"):
            return val
        from django.core.exceptions import ValidationError
        from django.core.validators import URLValidator
        try:
            URLValidator()(val)
        except ValidationError as exc:
            raise serializers.ValidationError("يرجى إدخال رابط صالح للصورة.") from exc
        return val

    def validate_description(self, value):
        return sanitize_html_content(value)

    def validate_short_description(self, value):
        return sanitize_html_content(value)

    def validate(self, attrs):
        instance = self.instance
        stage = attrs.get("educational_stage", getattr(instance, "educational_stage", ""))
        grade = attrs.get("educational_grade", getattr(instance, "educational_grade", ""))
        track = attrs.get("educational_track", getattr(instance, "educational_track", ""))
        subject = attrs.get("subject", getattr(instance, "subject", ""))
        branch = attrs.get("subject_branch", getattr(instance, "subject_branch", ""))
        price = attrs.get("price", getattr(instance, "price", Decimal("0")))
        is_free = attrs.get("is_free", getattr(instance, "is_free", False))
        status_value = attrs.get("status", getattr(instance, "status", CourseStatus.DRAFT))

        is_transitioning_to_published = (
            instance is None and status_value == CourseStatus.PUBLISHED
        ) or (
            "status" in attrs and attrs["status"] == CourseStatus.PUBLISHED and getattr(instance, "status", None) != CourseStatus.PUBLISHED
        )
        touches_academic_fields = any(f in attrs for f in ("educational_stage", "educational_grade", "educational_track", "subject", "subject_branch", "price", "is_free"))
        should_validate_publishing = is_transitioning_to_published or (
            status_value == CourseStatus.PUBLISHED and touches_academic_fields
        )

        academic_errors = validate_academic_targeting(
            stage=stage,
            grade=grade,
            track=track,
            subject=subject,
            branch=branch,
            require_all=should_validate_publishing,
        )
        if academic_errors and (should_validate_publishing or any(f in attrs for f in ("educational_stage", "educational_grade", "educational_track", "subject", "subject_branch"))):
            # Only block drafts if user provided an explicitly invalid combination, or if publishing
            if should_validate_publishing:
                raise serializers.ValidationError(academic_errors)
            # For drafts, if they submitted fields that contradict each other (e.g. invalid track for grade), raise errors
            if any(k in attrs for k in ("educational_stage", "educational_grade", "educational_track", "subject")):
                blocking_draft_errors = {
                    k: v for k, v in academic_errors.items()
                    if "مطلوب" not in v  # ignore missing field warnings when drafting
                }
                if blocking_draft_errors:
                    raise serializers.ValidationError(blocking_draft_errors)

        try:
            normalized_price = Decimal(str(price))
        except (ArithmeticError, TypeError, ValueError) as exc:
            raise serializers.ValidationError({"price": "سعر الكورس غير صالح."}) from exc

        if normalized_price < 0:
            raise serializers.ValidationError({"price": "سعر الكورس لا يمكن أن يكون سالبًا."})
        if is_free and normalized_price != 0:
            raise serializers.ValidationError({"price": "الكورس المجاني يجب أن يكون سعره 0."})
        if not is_free and normalized_price <= 0 and should_validate_publishing:
            raise serializers.ValidationError(
                {"price": "الكورس المدفوع يجب أن يكون سعره أكبر من 0 عند النشر."}
            )
        if is_transitioning_to_published:
            if instance is None:
                raise serializers.ValidationError(
                    {"status": "يجب حفظ الدورة كمسودة وبناء المنهج أولاً قبل نشرها."}
                )
            quality_errors = validate_course_publish_quality(instance)
            if quality_errors:
                raise serializers.ValidationError(
                    {
                        "publish_quality": flatten_quality_errors(quality_errors),
                        **quality_errors,
                    }
                )

        return attrs

    def create(self, validated_data):
        validated_data["instructor"] = self.context["request"].user
        return super().create(validated_data)


class ModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ("id", "course", "title", "order", "is_published", "available_from")
        # Order conflicts are resolved atomically by ModuleViewSet.perform_create.
        # DRF's autogenerated UniqueTogetherValidator runs before perform_create,
        # so it must not reject a stale client order before the server can allocate
        # the next safe order.
        validators = []

    def validate_course(self, course):
        request = self.context.get("request")
        user = getattr(request, "user", None) or self.context.get("request_user")
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if getattr(user, "role", "") in ("admin", "super_admin"):
            return course
        if course.instructor_id != user.id:
            raise serializers.ValidationError("You do not own this course.")
        return course


class LessonWriteSerializer(FlexiCaseModelSerializer):
    class Meta:
        model = Lesson
        fields = (
            "id",
            "module",
            "title",
            "type",
            "duration",
            "order",
            "is_free",
            "is_published",
            "available_from",
            "video",
            "video_url",
            "content",
        )
        # Order conflicts are resolved atomically by LessonViewSet.perform_create.
        validators = []

    def validate_content(self, value):
        return sanitize_html_content(value)

    def validate_module(self, module):
        request = self.context.get("request")
        user = getattr(request, "user", None) or self.context.get("request_user")
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if getattr(user, "role", "") in ("admin", "super_admin"):
            return module
        if module.course.instructor_id != user.id:
            raise serializers.ValidationError("You do not own this module's course.")
        return module

    def validate_video(self, video):
        if not video:
            return video
        request = self.context.get("request")
        user = getattr(request, "user", None) or self.context.get("request_user")
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if getattr(user, "role", "") in ("admin", "super_admin"):
            return video
        if video.uploader_id != user.id:
            raise serializers.ValidationError("لا يمكنك ربط فيديو لا تملكه بهذا الدرس.")
        return video
