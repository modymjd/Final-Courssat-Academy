import base64
import hashlib
import json
import logging
import os
import time
from collections.abc import Mapping
from pathlib import Path

from decouple import config
from django.conf import settings
from django.db import models, transaction
from django.db.models import Avg, Count, Max, Prefetch, Q, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.accounts.throttles import FinalProgressRateThrottle, VideoStreamRateThrottle
from apps.common.permissions import (
    IsCourseOwnerOrAdmin,
    IsInstructorOrAdmin,
    IsLessonCourseOwnerOrAdmin,
    IsModuleCourseOwnerOrAdmin,
)
from apps.enrollments.models import Enrollment

from .bunny import generate_bunny_upload_signature, generate_signed_hls_url
from .curriculum_service import CURRICULUM_TAXONOMY
from .filters import CourseFilter
from .models import Category, Course, CourseStatus, Lesson, LessonSummary, Module, Review, Video, VideoStatus
from .serializers import (
    CategorySerializer,
    CourseDetailSerializer,
    CourseSummarySerializer,
    CourseWriteSerializer,
    LessonSerializer,
    LessonSummarySerializer,
    LessonWriteSerializer,
    ModuleSerializer,
    ModuleWriteSerializer,
    ReviewSerializer,
    VideoSerializer,
    VideoUploadChunkSerializer,
    VideoUploadCompleteSerializer,
)
from .tasks import transcode_video_to_hls_task

logger = logging.getLogger(__name__)

MAX_VIDEO_BYTES = 1024 * 1024 * 1024  # 1 GiB maximum source video
MAX_CHUNK_BYTES = 8 * 1024 * 1024  # 8 MiB upload chunks
UPLOAD_ROOT = "scratch/uploads"
RAW_VIDEO_ROOT = "scratch/raw_videos"


def _enforce_lesson_progression_access(user, lesson: Lesson, enrollment: Enrollment | None) -> None:
    """Reject direct access to a lesson that is still locked by course progression rules."""
    course = lesson.module.course
    is_owner = course.instructor_id == user.id
    is_staff_or_admin = bool(user.is_staff or getattr(user, "role", "") in ("admin", "super_admin"))
    if (
        not course.enforce_quiz_gate
        or lesson.is_free
        or is_owner
        or is_staff_or_admin
        or not enrollment
    ):
        return

    from .services.progression_service import is_lesson_unlocked

    unlocked, reason = is_lesson_unlocked(enrollment, lesson)
    if not unlocked:
        raise PermissionDenied(
            {
                "detail": reason or "هذه الحصة مقفلة حتى تستكمل متطلبات الحصة السابقة.",
                "code": "lesson_locked",
                "lesson_id": lesson.id,
                "course_id": course.id,
            }
        )


def _upload_dir(user_id: int, upload_id: str) -> Path:
    return Path(settings.MEDIA_ROOT) / UPLOAD_ROOT / str(user_id) / upload_id


def _upload_manifest_path(upload_dir: Path) -> Path:
    return upload_dir / "manifest.json"


def _write_manifest_once(path: Path, payload: dict) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(path, flags, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, separators=(",", ":"))
    except Exception:
        try:
            path.unlink(missing_ok=True)
        finally:
            raise


def _read_manifest(path: Path) -> dict | None:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, dict) else None
    except (OSError, ValueError, TypeError):
        return None


@method_decorator(cache_page(60 * 60 * 24), name="dispatch")
class CategoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Category.objects.annotate(
        _course_count=Count("courses", filter=Q(courses__status=CourseStatus.PUBLISHED))
    ).order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"


class CourseIdempotencyConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "مفتاح التكرار مستخدم بالفعل لطلب إنشاء دورة مختلفة."
    default_code = "idempotency_conflict"


def _normalize_course_creation_value(value):
    if isinstance(value, models.Model):
        return {"model": value._meta.label_lower, "pk": value.pk}
    if isinstance(value, Mapping):
        return {
            str(key): _normalize_course_creation_value(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
            if key != "idempotency_key"
        }
    if isinstance(value, (list, tuple)):
        return [_normalize_course_creation_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _course_creation_request_hash(request_data):
    normalized = _normalize_course_creation_value(request_data)
    canonical = json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.select_related("instructor", "category")
    filterset_class = CourseFilter
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "price"]

    def create(self, request, *args, **kwargs):
        """
        Create a course with optional DB-backed Idempotency-Key support.

        The key is scoped to the authenticated creator. A repeated key with the
        same canonical request replays the original Course; reusing the key with
        a different request is a 409 conflict. The database constraint, not
        cache state, provides correctness after a response is lost.
        """
        idempotency_key = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key")
        if idempotency_key is not None:
            idempotency_key = str(idempotency_key).strip()
            if not idempotency_key:
                idempotency_key = None
            elif len(idempotency_key) > 128:
                raise serializers.ValidationError(
                    {"idempotency_key": "مفتاح Idempotency-Key يجب ألا يتجاوز 128 حرفًا."}
                )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_hash = _course_creation_request_hash(serializer.validated_data) if idempotency_key else ""

        if idempotency_key:
            existing = Course.objects.filter(
                instructor=request.user,
                creation_idempotency_key=idempotency_key,
            ).first()
            if existing is not None:
                if not existing.creation_request_hash or existing.creation_request_hash != request_hash:
                    raise CourseIdempotencyConflict()
                response = Response(
                    self.get_serializer(existing).data,
                    status=status.HTTP_200_OK,
                )
                response["Idempotency-Replayed"] = "true"
                return response

        from django.db import IntegrityError

        try:
            with transaction.atomic():
                course = serializer.save(
                    creation_idempotency_key=idempotency_key or "",
                    creation_request_hash=request_hash,
                )
        except IntegrityError as exc:
            if not idempotency_key:
                raise

            existing = Course.objects.filter(
                instructor=request.user,
                creation_idempotency_key=idempotency_key,
            ).first()
            if existing is None:
                raise

            if not existing.creation_request_hash or existing.creation_request_hash != request_hash:
                raise CourseIdempotencyConflict() from exc

            response = Response(
                self.get_serializer(existing).data,
                status=status.HTTP_200_OK,
            )
            response["Idempotency-Replayed"] = "true"
            return response

        response = Response(
            self.get_serializer(course).data,
            status=status.HTTP_201_CREATED,
        )
        if idempotency_key:
            response["Idempotency-Key"] = idempotency_key
        return response

    def get_permissions(self):
        if self.action in ("list", "featured", "by_category", "get_lesson", "curriculum_taxonomy"):
            return [AllowAny()]
        if self.action == "retrieve":
            return [AllowAny()]
        if self.action in ("reviews", "reviews_list"):
            return [IsAuthenticatedOrReadOnly()]
        if self.action == "create":
            return [IsInstructorOrAdmin()]
        return [IsCourseOwnerOrAdmin()]

    def get_serializer_class(self):
        if self.action == "list":
            return CourseSummarySerializer
        if self.action in ("create", "update", "partial_update"):
            return CourseWriteSerializer
        return CourseDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Course.objects.select_related("instructor", "instructor__instructor_profile", "category").annotate(
            _student_count=Count("enrollments", distinct=True),
            _rating=Coalesce(Avg("reviews__rating"), Value(0.0)),
            _review_count=Count("reviews", distinct=True),
            _lesson_count=Count("modules__lessons", distinct=True),
        )
        if self.action == "retrieve":
            from apps.assessments.models import Exam, StudentExam
            from apps.enrollments.models import Enrollment

            lesson_exam_qs = Exam.objects.filter(is_published=True)
            unit_exam_qs = Exam.objects.filter(is_published=True)

            if user.is_authenticated:
                user_attempts_qs = StudentExam.objects.filter(student=user).order_by("-created_at")
                lesson_exam_qs = lesson_exam_qs.prefetch_related(Prefetch("attempts", queryset=user_attempts_qs, to_attr="_user_quiz_attempts"))
                unit_exam_qs = unit_exam_qs.prefetch_related(Prefetch("attempts", queryset=user_attempts_qs, to_attr="_user_unit_attempts"))

            lesson_queryset = (
                Lesson.objects.select_related("video", "module__course")
                .prefetch_related("summary", Prefetch("exams", queryset=lesson_exam_qs))
                .order_by("order", "id")
            )

            module_queryset = Module.objects.order_by("order", "id")

            if not (user.is_authenticated and (getattr(user, "role", "") in ("admin", "super_admin", "instructor") or user.is_staff)):
                now = timezone.now()
                lesson_queryset = lesson_queryset.filter(
                    Q(is_published=True) & (Q(available_from__isnull=True) | Q(available_from__lte=now))
                )
                module_queryset = module_queryset.filter(
                    Q(is_published=True) & (Q(available_from__isnull=True) | Q(available_from__lte=now))
                )

            module_queryset = module_queryset.prefetch_related(
                Prefetch("lessons", queryset=lesson_queryset),
                Prefetch("unit_exams", queryset=unit_exam_qs)
            )

            qs = qs.prefetch_related(Prefetch("modules", queryset=module_queryset))
            if user.is_authenticated:
                qs = qs.prefetch_related(
                    Prefetch("enrollments", queryset=Enrollment.objects.filter(student=user).prefetch_related("lesson_completions"), to_attr="_user_enrollments")
                )
        mine = self.request.query_params.get("mine", "").lower() in {"1", "true", "yes"}

        if mine:
            if not user.is_authenticated:
                return qs.none()
            if getattr(user, "role", "") in ("admin", "super_admin", "instructor"):
                return qs.filter(instructor=user)
            return qs.none()

        if self.action in ("list", "featured", "by_category", "retrieve", "get_lesson", "reviews", "reviews_list"):
            if user.is_authenticated and getattr(user, "role", "") == "instructor":
                return qs.filter(Q(status=CourseStatus.PUBLISHED) | Q(instructor=user))
            if user.is_authenticated and (getattr(user, "role", "") in ("admin", "super_admin") or user.is_staff):
                return qs
            return qs.filter(status=CourseStatus.PUBLISHED)

        if user.is_authenticated and (getattr(user, "role", "") in ("admin", "super_admin") or user.is_staff):
            return qs
        if user.is_authenticated and getattr(user, "role", "") == "instructor":
            return qs.filter(instructor=user)
        return qs.none()

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def featured(self, request):
        qs = self.get_queryset().order_by("-id")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CourseSummarySerializer(page, many=True, context={"request": request}).data)
        return Response(CourseSummarySerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="by-category/(?P<slug>[^/.]+)", permission_classes=[AllowAny])
    def by_category(self, request, slug=None):
        qs = self.get_queryset().filter(category__slug=slug)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CourseSummarySerializer(page, many=True, context={"request": request}).data)
        return Response(CourseSummarySerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="curriculum-taxonomy", permission_classes=[AllowAny])
    def curriculum_taxonomy(self, request):
        """Returns the full hierarchical Egyptian educational curriculum taxonomy."""
        return Response(CURRICULUM_TAXONOMY)

    @action(detail=True, methods=["get", "post"], url_path="reviews", permission_classes=[IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        course = self.get_object()
        if request.method == "GET":
            qs = course.reviews.select_related("student").order_by("-created_at")
            page = self.paginate_queryset(qs)
            serializer = ReviewSerializer(page or qs, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

        if not request.user.is_staff and not Enrollment.objects.filter(student=request.user, course=course).exists():
            return Response({"detail": "يجب التسجيل في الدورة أولاً لتتمكن من إضافة تقييم."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ReviewSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        review, _ = Review.objects.update_or_create(
            course=course,
            student=request.user,
            defaults={"rating": serializer.validated_data["rating"], "comment": serializer.validated_data.get("comment", "")},
        )
        return Response(ReviewSerializer(review, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="lessons/(?P<lesson_id>[^/]+)", permission_classes=[AllowAny])
    def get_lesson(self, request, pk=None, lesson_id=None):
        course = self.get_object()
        try:
            lesson = Lesson.objects.select_related("module__course", "video").prefetch_related("summary").get(module__course=course, pk=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "الدرس غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        enrollment = Enrollment.objects.filter(student=user, course=course).first() if user.is_authenticated else None
        is_enrolled = enrollment is not None
        is_owner = user.is_authenticated and course.instructor_id == user.id
        is_staff_or_admin = user.is_authenticated and (user.is_staff or getattr(user, "role", "") in ("admin", "super_admin"))
        if not (lesson.is_free or is_enrolled or is_owner or is_staff_or_admin):
            return Response({"detail": "يجب التسجيل في الدورة أولاً للوصول إلى هذا الدرس."}, status=status.HTTP_403_FORBIDDEN)

        if is_enrolled and not enrollment.has_active_access and not (lesson.is_free or is_owner or is_staff_or_admin):
            raise PermissionDenied({
                "detail": "انتهت فترة اشتراكك في هذه الدورة. يرجى إدخال كود التجديد لمتابعة المشاهدة والامتحانات.",
                "code": "subscription_expired",
                "course_id": course.id,
                "expired_at": enrollment.expires_at,
                "can_renew": True,
            })

        _enforce_lesson_progression_access(user, lesson, enrollment)
        return Response(LessonSerializer(lesson, context={"request": request}).data)


class ModuleViewSet(viewsets.ModelViewSet):
    queryset = Module.objects.select_related("course")
    permission_classes = [IsModuleCourseOwnerOrAdmin]

    def perform_create(self, serializer):
        course = serializer.validated_data["course"]
        requested_order = serializer.validated_data.get("order", 0)
        with transaction.atomic():
            locked_course = Course.objects.select_for_update(of=("self",)).get(pk=course.pk)
            order_taken = Module.objects.filter(course_id=locked_course.pk, order=requested_order).exists()
            if order_taken:
                max_order = Module.objects.filter(course_id=locked_course.pk).aggregate(
                    max_order=Max("order")
                )["max_order"]
                requested_order = (max_order if max_order is not None else -1) + 1
            serializer.save(course=locked_course, order=requested_order)

    def get_serializer_class(self):
        return ModuleWriteSerializer if self.action in ("create", "update", "partial_update") else ModuleSerializer

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related("lessons")
        user = self.request.user
        if user.is_authenticated and user.role in ("admin", "super_admin"):
            return qs
        if user.is_authenticated and user.role == "instructor":
            return qs.filter(course__instructor=user)
        return qs.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request_user"] = self.request.user
        return ctx

    def destroy(self, request, *args, **kwargs):
        from apps.assessments.models import Exam

        module_id = kwargs.get("pk")
        with transaction.atomic():
            module = self.get_queryset().select_for_update(of=("self",)).filter(pk=module_id).first()
            if module is None:
                return Response({"detail": "الوحدة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)
            self.check_object_permissions(request, module)

            # Lock child lessons in the same order used by assessment creation
            # and lesson deletion: Module -> Lesson.
            list(Lesson.objects.select_for_update().filter(module=module).values_list("id", flat=True))

            has_dependent_exam = Exam.objects.filter(
                Q(unit_id=module.id) | Q(lesson__module_id=module.id)
            ).exists()
            if has_dependent_exam:
                raise serializers.ValidationError(
                    {
                        "curriculum": (
                            "لا يمكن حذف الوحدة لارتباطها باختبار. "
                            "احذف الاختبار المرتبط أولًا ثم احذف الوحدة."
                        )
                    }
                )

            module.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.select_related("module__course")
    permission_classes = [IsLessonCourseOwnerOrAdmin]

    def perform_create(self, serializer):
        module = serializer.validated_data["module"]
        requested_order = serializer.validated_data.get("order", 0)
        with transaction.atomic():
            locked_module = Module.objects.select_for_update(of=("self",)).get(pk=module.pk)
            order_taken = Lesson.objects.filter(module_id=locked_module.pk, order=requested_order).exists()
            if order_taken:
                max_order = Lesson.objects.filter(module_id=locked_module.pk).aggregate(
                    max_order=Max("order")
                )["max_order"]
                requested_order = (max_order if max_order is not None else -1) + 1
            serializer.save(module=locked_module, order=requested_order)


    def get_permissions(self):
        if self.action in ("retrieve", "update_progress"):
            return [IsAuthenticated()]
        return [IsLessonCourseOwnerOrAdmin()]

    def get_serializer_class(self):
        return LessonWriteSerializer if self.action in ("create", "update", "partial_update") else LessonSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.role in ("admin", "super_admin"):
            return qs
        if user.role == "instructor":
            return qs.filter(module__course__instructor=user)
        if user.role == "student" and self.action in ("retrieve", "update_progress"):
            now = timezone.now()
            return qs.filter(
                (Q(module__course__enrollments__student=user) | Q(is_free=True)) &
                Q(is_published=True) &
                (Q(available_from__isnull=True) | Q(available_from__lte=now)) &
                Q(module__is_published=True) &
                (Q(module__available_from__isnull=True) | Q(module__available_from__lte=now))
            ).distinct()
        return qs.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request_user"] = self.request.user
        return ctx

    def destroy(self, request, *args, **kwargs):
        from apps.assessments.models import Exam

        lesson_id = kwargs.get("pk")
        # Resolve through the permission-aware queryset first so foreign
        # resources keep the existing 404 isolation behavior. Do not lock the
        # lesson in this first lookup: all lesson mutations use Module -> Lesson
        # lock ordering to avoid deadlocks with assessment create/update and
        # module deletion.
        with transaction.atomic():
            lesson = self.get_queryset().select_related("module").filter(pk=lesson_id).first()
            if lesson is None:
                return Response({"detail": "الدرس غير موجود."}, status=status.HTTP_404_NOT_FOUND)

            module = Module.objects.select_for_update().filter(pk=lesson.module_id).first()
            if module is None:
                return Response({"detail": "الوحدة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

            locked_lesson = Lesson.objects.select_for_update().filter(
                pk=lesson_id,
                module=module,
            ).first()
            if locked_lesson is None:
                return Response(
                    {"detail": "تغيرت بنية الدرس أثناء العملية. أعد المحاولة."},
                    status=status.HTTP_409_CONFLICT,
                )

            self.check_object_permissions(request, locked_lesson)

            if Exam.objects.filter(lesson_id=locked_lesson.id).exists():
                raise serializers.ValidationError(
                    {
                        "curriculum": (
                            "لا يمكن حذف الدرس لارتباطه باختبار. "
                            "احذف الاختبار المرتبط أولًا ثم احذف الدرس."
                        )
                    }
                )

            locked_lesson.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, *args, **kwargs):
        lesson = self.get_object()
        course = lesson.module.course
        user = request.user
        is_owner = user.is_authenticated and course.instructor_id == user.id
        is_staff_or_admin = user.is_authenticated and (user.is_staff or getattr(user, "role", "") in ("admin", "super_admin"))
        enrollment = None
        if user.is_authenticated and not (is_owner or is_staff_or_admin):
            enrollment = Enrollment.objects.filter(student=user, course=course).first()
            if enrollment and not enrollment.has_active_access and not lesson.is_free:
                raise PermissionDenied({
                    "detail": "انتهت فترة اشتراكك في هذه الدورة. يرجى إدخال كود التجديد لمتابعة المشاهدة والامتحانات.",
                    "code": "subscription_expired",
                    "course_id": course.id,
                    "expired_at": enrollment.expires_at,
                    "can_renew": True,
                })
        _enforce_lesson_progression_access(user, lesson, enrollment)
        return super().retrieve(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["put"],
        url_path="progress",
        permission_classes=[IsAuthenticated],
        throttle_classes=[FinalProgressRateThrottle],
    )
    def update_progress(self, request, pk=None):
        lesson = Lesson.objects.select_related("module__course", "video").filter(pk=pk).first()
        if not lesson:
            return Response({"detail": "الدرس غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if getattr(user, "role", "") != "student" and not user.is_staff:
            return Response({"detail": "هذه الميزة مخصصة للطلاب فقط."}, status=status.HTTP_403_FORBIDDEN)

        # 1. Verify active enrollment in this course
        from apps.enrollments.models import Enrollment, LessonProgress

        enrollment = Enrollment.objects.filter(
            student=user,
            course_id=lesson.module.course_id,
        ).first()

        if not enrollment:
            return Response({"detail": "الطالب غير مسجل في هذه الدورة."}, status=status.HTTP_403_FORBIDDEN)

        if not enrollment.has_active_access and not lesson.is_free:
            raise PermissionDenied({
                "detail": "انتهت فترة اشتراكك في هذه الدورة. يرجى إدخال كود التجديد لمتابعة المشاهدة والامتحانات.",
                "code": "subscription_expired",
                "course_id": lesson.module.course_id,
                "expired_at": enrollment.expires_at,
                "can_renew": True,
            })

        _enforce_lesson_progression_access(user, lesson, enrollment)

        # 2. Extract and validate payload
        try:
            position_seconds = int(request.data.get("position_seconds", 0))
        except (ValueError, TypeError):
            return Response({"detail": "قيمة position_seconds غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        position_seconds = max(0, position_seconds)
        video_duration = 0
        if lesson.video and lesson.video.duration_seconds > 0:
            video_duration = lesson.video.duration_seconds
        elif lesson.duration:
            from apps.courses.management.commands.audit_lesson_durations import parse_duration_string

            video_duration = parse_duration_string(lesson.duration)

        if video_duration > 0:
            position_seconds = min(position_seconds, video_duration + 5)

        is_final = bool(request.data.get("final", False))

        now = timezone.now()

        with transaction.atomic():
            progress = (
                LessonProgress.objects.select_for_update()
                .filter(enrollment=enrollment, lesson=lesson)
                .first()
            )

            if not progress:
                # First write: max_position_seconds is anti-cheat capped at 30 seconds maximum
                initial_max = min(position_seconds, 30)
                if video_duration > 0:
                    initial_max = min(initial_max, video_duration)
                progress = LessonProgress.objects.create(
                    enrollment=enrollment,
                    lesson=lesson,
                    last_position_seconds=position_seconds,
                    max_position_seconds=initial_max,
                    last_accepted_at=now,
                )
                return Response({
                    "status": "ok",
                    "last_position_seconds": progress.last_position_seconds,
                    "max_position_seconds": progress.max_position_seconds,
                }, status=status.HTTP_200_OK)

            # 3. Throttling check for non-final requests
            elapsed_seconds = (now - progress.last_accepted_at).total_seconds()
            if not is_final and elapsed_seconds < 10:
                return Response({
                    "status": "throttled",
                    "last_position_seconds": progress.last_position_seconds,
                    "max_position_seconds": progress.max_position_seconds,
                }, status=status.HTTP_200_OK)

            # 4. Anti-cheat calculation
            # delta_t capped at 120s, multiplier 2.5 (player max speed 2x + 25% margin) + 3s buffer
            delta_t = min(max(0.0, elapsed_seconds), 120.0)
            max_allowed_increment = int(delta_t * 2.5 + 3)
            allowed_max_pos = progress.max_position_seconds + max_allowed_increment

            new_max_pos = max(
                progress.max_position_seconds,
                min(position_seconds, allowed_max_pos),
            )
            if video_duration > 0:
                new_max_pos = min(new_max_pos, video_duration)

            # Atomic update: last_position_seconds records actual seek location for resume
            progress.last_position_seconds = position_seconds
            progress.max_position_seconds = new_max_pos
            progress.last_accepted_at = now
            progress.save(update_fields=["last_position_seconds", "max_position_seconds", "last_accepted_at", "updated_at"])

            return Response({
                "status": "ok",
                "last_position_seconds": progress.last_position_seconds,
                "max_position_seconds": progress.max_position_seconds,
            }, status=status.HTTP_200_OK)


class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.select_related("uploader")
    serializer_class = VideoSerializer
    permission_classes = [IsInstructorOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if getattr(user, "role", "") in ("admin", "super_admin") or user.is_staff:
            return qs
        return qs.filter(uploader=user)

    @action(detail=False, methods=["post"], url_path="upload-chunk")
    def upload_chunk(self, request):
        serializer = VideoUploadChunkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload_id = serializer.validated_data["upload_id"]
        chunk_index = serializer.validated_data["chunk_index"]
        total_chunks = serializer.validated_data["total_chunks"]
        chunk_file = serializer.validated_data["chunk"]
        if chunk_file.size > MAX_CHUNK_BYTES:
            return Response({"detail": "حجم القطعة يتجاوز الحد المسموح (10 ميجابايت)."}, status=status.HTTP_400_BAD_REQUEST)

        chunk_dir = _upload_dir(request.user.id, upload_id)
        chunk_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = _upload_manifest_path(chunk_dir)
        manifest = _read_manifest(manifest_path)
        if manifest is None:
            try:
                _write_manifest_once(manifest_path, {"user_id": request.user.id, "total_chunks": total_chunks})
                manifest = {"user_id": request.user.id, "total_chunks": total_chunks}
            except FileExistsError:
                manifest = _read_manifest(manifest_path)

        if not manifest or manifest.get("user_id") != request.user.id or manifest.get("total_chunks") != total_chunks:
            return Response({"detail": "بيانات جلسة الرفع غير متطابقة."}, status=status.HTTP_409_CONFLICT)

        chunk_path = chunk_dir / f"chunk_{chunk_index:05d}"
        with chunk_path.open("wb") as handle:
            for part in chunk_file.chunks():
                handle.write(part)
        return Response({"detail": "تم رفع القطعة بنجاح.", "upload_id": upload_id, "chunk_index": chunk_index})

    @action(detail=False, methods=["post"], url_path="upload-complete")
    def upload_complete(self, request):
        serializer = VideoUploadCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload_id = serializer.validated_data["upload_id"]
        title = serializer.validated_data["title"]
        total_chunks = serializer.validated_data["total_chunks"]
        file_name = serializer.validated_data["file_name"]

        ext = os.path.splitext(file_name)[1].lower()
        if ext not in {".mp4", ".mov", ".mkv", ".webm", ".avi"}:
            return Response({"detail": "صيغة الفيديو غير مدعومة. الصيغ المدعومة: mp4, mov, mkv, webm, avi"}, status=status.HTTP_400_BAD_REQUEST)

        chunk_dir = _upload_dir(request.user.id, upload_id)
        manifest_path = _upload_manifest_path(chunk_dir)
        manifest = _read_manifest(manifest_path)
        if not manifest or manifest.get("user_id") != request.user.id or manifest.get("total_chunks") != total_chunks:
            return Response({"detail": "جلسة الرفع غير موجودة أو غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        expected_names = {f"chunk_{index:05d}" for index in range(total_chunks)}
        chunks = [path for path in chunk_dir.glob("chunk_*") if path.is_file()]
        actual_names = {path.name for path in chunks}
        if actual_names != expected_names:
            return Response({"detail": "لم تكتمل جميع قطع الفيديو أو توجد قطع غير متوقعة."}, status=status.HTTP_400_BAD_REQUEST)

        total_size = sum(path.stat().st_size for path in chunks)
        if total_size <= 0 or total_size > MAX_VIDEO_BYTES:
            return Response({"detail": "حجم الفيديو النهائي يجب أن يكون أكبر من صفر ولا يتجاوز 1 جيجابايت."}, status=status.HTTP_400_BAD_REQUEST)

        raw_dir = Path(settings.MEDIA_ROOT) / RAW_VIDEO_ROOT / str(request.user.id)
        raw_dir.mkdir(parents=True, exist_ok=True)
        safe_filename = os.path.basename(file_name)
        assembled_path = raw_dir / f"{upload_id}_{safe_filename}"

        try:
            with assembled_path.open("xb") as outfile:
                for index in range(total_chunks):
                    with (chunk_dir / f"chunk_{index:05d}").open("rb") as infile:
                        while True:
                            block = infile.read(1024 * 1024)
                            if not block:
                                break
                            outfile.write(block)
            if assembled_path.stat().st_size != total_size:
                assembled_path.unlink(missing_ok=True)
                return Response({"detail": "فشل التحقق من حجم الفيديو المجمع."}, status=status.HTTP_400_BAD_REQUEST)
        except FileExistsError:
            return Response({"detail": "جاري إنهاء عملية رفع هذا الفيديو بالفعل."}, status=status.HTTP_409_CONFLICT)
        except OSError:
            logger.exception("Failed to assemble video upload user=%s upload=%s", request.user.id, upload_id)
            assembled_path.unlink(missing_ok=True)
            return Response({"detail": "تعذر تجميع الفيديو حالياً."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        for chunk_path in chunks:
            chunk_path.unlink(missing_ok=True)
        manifest_path.unlink(missing_ok=True)
        try:
            chunk_dir.rmdir()
        except OSError:
            pass

        video = Video.objects.create(
            title=title,
            uploader=request.user,
            status=VideoStatus.PENDING,
            raw_file_path=str(assembled_path),
            file_size_bytes=total_size,
        )

        try:
            transcode_video_to_hls_task.delay(video.id)
        except Exception:
            logger.exception("Failed to queue transcode_video_to_hls_task for video_id=%s", video.id)
            video.status = VideoStatus.FAILED
            video.save(update_fields=["status", "updated_at"])
            return Response({"detail": "تم استلام الفيديو لكن تعذر بدء المعالجة حالياً.", "video": VideoSerializer(video, context={"request": request}).data}, status=status.HTTP_202_ACCEPTED)

        video.refresh_from_db()
        return Response(VideoSerializer(video, context={"request": request}).data, status=status.HTTP_201_CREATED)


class LessonSummaryViewSet(viewsets.ModelViewSet):
    queryset = LessonSummary.objects.select_related("lesson__module__course")
    serializer_class = LessonSummarySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if getattr(user, "role", "") in ("admin", "super_admin") or user.is_staff:
            return qs
        if user.role == "student":
            return qs.filter(Q(lesson__is_free=True) | Q(lesson__module__course__enrollments__student=user)).distinct()
        if user.role in ("instructor", "center"):
            return qs.filter(lesson__module__course__instructor=user)
        return qs.none()

    def perform_create(self, serializer):
        lesson = serializer.validated_data.get("lesson")
        if not lesson:
            lesson_id = self.request.data.get("lesson_id") or self.request.data.get("lesson")
            try:
                lesson = Lesson.objects.get(id=lesson_id)
            except (Lesson.DoesNotExist, ValueError, TypeError) as exc:
                raise serializers.ValidationError({"lesson": "الدرس المحدد غير موجود."}) from exc
        user = self.request.user
        if getattr(user, "role", "") not in ("admin", "super_admin") and not user.is_staff:
            if lesson.module.course.instructor_id != user.id:
                raise serializers.ValidationError("لا تملك صلاحية إضافة ملخص لهذا الدرس.")

        existing = LessonSummary.objects.filter(lesson=lesson).first()
        if existing:
            for attr, val in serializer.validated_data.items():
                setattr(existing, attr, val)
            existing.save()
            serializer.instance = existing
        else:
            serializer.save(lesson=lesson)


class SignedStreamURLView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [VideoStreamRateThrottle]

    def post(self, request, lesson_id):
        try:
            lesson = Lesson.objects.select_related("module__course", "video").get(id=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "الدرس المطلوب غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        course = lesson.module.course
        enrollment = Enrollment.objects.filter(student=user, course=course).first()
        is_enrolled = enrollment is not None
        is_owner = bool(course.instructor_id == user.id)
        is_staff_or_admin = bool(user.is_staff or getattr(user, "role", "") in ("admin", "super_admin"))
        if not (lesson.is_free or is_enrolled or is_owner or is_staff_or_admin):
            return Response({"detail": "يجب الاشتراك في الدورة أولاً لتتمكن من مشاهدة هذا الدرس."}, status=status.HTTP_403_FORBIDDEN)

        if is_enrolled and not enrollment.has_active_access and not (lesson.is_free or is_owner or is_staff_or_admin):
            raise PermissionDenied({
                "detail": "انتهت فترة اشتراكك في هذه الدورة. يرجى إدخال كود التجديد لمتابعة المشاهدة والامتحانات.",
                "code": "subscription_expired",
                "course_id": course.id,
                "expired_at": enrollment.expires_at,
                "can_renew": True,
            })

        _enforce_lesson_progression_access(user, lesson, enrollment)

        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        client_ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else request.META.get("REMOTE_ADDR", "127.0.0.1")
        expires = int(time.time()) + 7200
        secret = config("NGINX_SECURE_LINK_SECRET", default="courssat_nginx_local_hls_secret_key_2026")
        stream_id = lesson.video_id if lesson.video_id else lesson.id
        uri = f"/hls/{stream_id}/master.m3u8"
        # Sign the stream directory rather than only master.m3u8. Nginx reuses
        # the validated token (via a path-scoped secure cookie) for variant
        # playlists and segments, which is required by HLS clients including
        # native Safari playback.
        stream_scope = f"/hls/{stream_id}/"
        hash_input = f"{expires}{stream_scope}{secret} {client_ip}".encode()
        token = base64.urlsafe_b64encode(hashlib.md5(hash_input).digest()).decode("utf-8").rstrip("=")

        video_adapter = config("VIDEO_STORAGE_ADAPTER", default="local")
        if video_adapter == "bunny" and lesson.video_url and not lesson.video_url.startswith("/"):
            signed_url = generate_signed_hls_url(video_id=lesson.video_url, client_ip=client_ip)
        else:
            signed_url = f"{uri}?token={token}&expires={expires}"
        return Response({"lesson_id": lesson.id, "lesson_title": lesson.title, "video_id": lesson.video_id, "signed_url": signed_url, "expires_in_seconds": 7200, "expires_at": expires, "stream_type": "hls"})


class DirectVideoUploadSignatureView(generics.GenericAPIView):
    permission_classes = [IsInstructorOrAdmin]

    def post(self, request):
        title = request.data.get("title", "درس فيديو جديد")
        params = generate_bunny_upload_signature(title=title)
        return Response(params)


class CourseImageUploadView(generics.GenericAPIView):
    """Uploads course cover or promotional image and automatically converts it to WebP."""

    permission_classes = [IsInstructorOrAdmin]

    def post(self, request):
        file_obj = request.FILES.get("image") or request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "يرجى اختيار ملف الصورة."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.common.image_service import ImageProcessingError, process_and_save_webp

        try:
            result = process_and_save_webp(
                image_file=file_obj,
                subfolder="courses/webp",
                max_dimension=2560,
                quality=85,
                filename_prefix="course_cover",
            )
        except ImageProcessingError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception("Failed to process course image upload")
            return Response({"detail": "تعذر معالجة الصورة حالياً."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        relative_url = result["url"]
        absolute_url = request.build_absolute_uri(relative_url)

        return Response(
            {
                "url": relative_url,
                "absolute_url": absolute_url,
                "format": result["format"],
                "width": result["width"],
                "height": result["height"],
                "size_bytes": result["size_bytes"],
                "message": "تم رفع الصورة وضغطها بصيغة WebP بنجاح.",
            },
            status=status.HTTP_201_CREATED,
        )



