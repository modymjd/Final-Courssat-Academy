import logging

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.throttles import NotesBulkImportRateThrottle, NotesWriteRateThrottle
from apps.common.pagination import CamelCasePageNumberPagination
from apps.common.permissions import IsStudent
from apps.courses.models import Course, Lesson

from .models import Enrollment, LessonCompletion, StudentNote
from .serializers import (
    EnrollCreateSerializer,
    EnrollmentSerializer,
    LessonCompleteSerializer,
    StudentNoteBulkImportSerializer,
    StudentNoteSerializer,
)

logger = logging.getLogger(__name__)


class EnrollmentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Avg, Count, OuterRef, Prefetch, Subquery, Value
        from django.db.models.functions import Coalesce

        from apps.accounts.models import CenterInstructor, GuardianProfile, UserRole
        from apps.certificates.models import Certificate
        from apps.courses.models import Module

        user = self.request.user
        course_queryset = (
            Course.objects.select_related("instructor", "category")
            .annotate(
                _student_count=Count("enrollments", distinct=True),
                _rating=Coalesce(Avg("reviews__rating"), Value(0.0)),
                _review_count=Count("reviews", distinct=True),
                _lesson_count=Count("modules__lessons", distinct=True),
            )
            .prefetch_related(
                Prefetch(
                    "modules",
                    queryset=Module.objects.order_by("order", "id").prefetch_related(
                        "lessons"
                    ),
                )
            )
        )
        certificate_id_subquery = Certificate.objects.filter(
            student_id=OuterRef("student_id"),
            course_id=OuterRef("course_id"),
        ).values("id")[:1]
        certificate_serial_subquery = Certificate.objects.filter(
            student_id=OuterRef("student_id"),
            course_id=OuterRef("course_id"),
        ).values("serial")[:1]

        qs = (
            Enrollment.objects.select_related("student")
            .prefetch_related(
                "lesson_completions",
                Prefetch("course", queryset=course_queryset),
            )
            .annotate(
                total_lessons=Count("course__modules__lessons", distinct=True),
                _certificate_id=Subquery(certificate_id_subquery),
                _certificate_serial=Subquery(certificate_serial_subquery),
            )
            .order_by("-last_accessed_at")
        )
        if not user.is_authenticated:
            return qs.none()

        role = getattr(user, "role", None)
        if role == UserRole.STUDENT:
            qs = qs.filter(student=user)
        elif role == UserRole.INSTRUCTOR:
            qs = qs.filter(course__instructor=user)
        elif role == UserRole.GUARDIAN:
            student_ids = GuardianProfile.objects.filter(guardian_user=user).values_list(
                "student_profile__user_id", flat=True
            )
            qs = qs.filter(student_id__in=student_ids)
        elif role == UserRole.CENTER:
            center_profile = getattr(user, "center_profile", None)
            if center_profile:
                instructor_ids = CenterInstructor.objects.filter(
                    center=center_profile, is_active=True
                ).values_list("instructor_id", flat=True)
                qs = qs.filter(course__instructor_id__in=instructor_ids)
            else:
                return qs.none()
        elif role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            pass
        else:
            return qs.none()

        course_param = self.request.query_params.get("course_id") or self.request.query_params.get("course")
        if course_param:
            qs = qs.filter(course_id=course_param)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(student__email__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        from decimal import Decimal

        from apps.accounts.models import UserRole

        if request.user.role not in (UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return Response({"detail": "التسجيل في الدورات متاح للطلاب ومسؤولي المنصة."}, status=status.HTTP_403_FORBIDDEN)
        serializer = EnrollCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = get_object_or_404(Course, pk=serializer.validated_data["course_id"], status="published")

        # Security & Financial Gate: Prevent free direct enrollment in paid courses
        is_free_course = course.is_free or (course.price is not None and course.price <= Decimal("0.00"))
        if not is_free_course:
            return Response(
                {"detail": "هذه الدورة مدفوعة، يرجى إتمام عملية الشراء أو استخدام كود تفعيل صالح للتسجيل بها."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment, created = Enrollment.objects.get_or_create(student=request.user, course=course)
        return Response(
            EnrollmentSerializer(enrollment, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="complete-lesson", permission_classes=[IsStudent])
    @transaction.atomic
    def complete_lesson(self, request, pk=None):
        enrollment = Enrollment.objects.select_for_update().filter(pk=pk).first()
        if not enrollment:
            return Response({"detail": "Enrollment not found."}, status=status.HTTP_404_NOT_FOUND)
        if enrollment.student_id != request.user.id:
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        serializer = LessonCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lesson = get_object_or_404(
            Lesson,
            pk=serializer.validated_data["lesson_id"],
            module__course=enrollment.course,
        )

        # 1. Backward compatibility & Idempotency: If already completed, return 200 OK immediately
        already_completed = LessonCompletion.objects.filter(enrollment=enrollment, lesson=lesson).exists()
        if already_completed:
            return Response(EnrollmentSerializer(enrollment, context={"request": request}).data, status=status.HTTP_200_OK)

        # 2. A locked lesson cannot be completed by calling the endpoint directly.
        from apps.courses.services.progression_service import can_complete_lesson, is_lesson_unlocked

        if enrollment.course.enforce_quiz_gate:
            is_unlocked, lock_reason = is_lesson_unlocked(enrollment, lesson)
            if not is_unlocked:
                return Response(
                    {
                        "detail": lock_reason or "هذه الحصة مقفلة حتى تستكمل متطلبات الحصة السابقة.",
                        "code": "lesson_locked",
                        "lesson_id": lesson.id,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # 3. Delegate completion eligibility check to progression_service
        can_complete, rejection_reason = can_complete_lesson(enrollment, lesson)
        if not can_complete:
            payload = {"detail": rejection_reason}
            if "شاهدت" in (rejection_reason or ""):
                import re
                m = re.search(r"شاهدت (\d+)%", rejection_reason or "")
                if m:
                    payload["watched_percent"] = int(m.group(1))
                    payload["required_percent"] = 90
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        LessonCompletion.objects.get_or_create(enrollment=enrollment, lesson=lesson)

        try:
            from apps.analytics.streak_service import record_student_activity

            record_student_activity(request.user, minutes_spent=15, lessons_completed=1)
        except Exception:
            pass


        total = Lesson.objects.filter(module__course=enrollment.course).count()
        if total and enrollment.lesson_completions.count() >= total and not enrollment.completed_at:
            enrollment.completed_at = timezone.now()
            enrollment.save(update_fields=["completed_at"])

            # Auto-issue certificate of completion
            from apps.certificates.models import Certificate

            cert, created = Certificate.objects.get_or_create(
                student=enrollment.student, course=enrollment.course, defaults={"grade": "A+"}
            )

            if created:
                # Dispatch Telegram alert to parent
                try:
                    from apps.notifications.tasks import send_telegram_certificate_alert_task

                    send_telegram_certificate_alert_task.delay(cert.id)
                except Exception:
                    pass

            # Create notification
            from apps.notifications.models import Notification, NotificationType

            Notification.objects.create(
                user=enrollment.student,
                type=NotificationType.CERTIFICATE,
                title=f"مبروك! حصلت على شهادة إتمام دورة: {enrollment.course.title}",
                message=f"لقد أتممت بنجاح جميع دروس دورة {enrollment.course.title}. رقم الشهادة: {cert.serial}",
                action_url="/certificates",
            )

        return Response(EnrollmentSerializer(enrollment, context={"request": request}).data)


class StudentNotePagination(CamelCasePageNumberPagination):
    page_size = 50
    max_page_size = 100


class StudentNoteViewSet(viewsets.ModelViewSet):
    serializer_class = StudentNoteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StudentNotePagination
    throttle_classes = [NotesWriteRateThrottle]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return StudentNote.objects.none()

        # Strict IDOR isolation: users can ONLY query and manipulate their own notes.
        # Queries for notes belonging to other students will return 404.
        qs = (
            StudentNote.objects.filter(student=user)
            .select_related("course", "lesson")
            .order_by("-is_pinned", "-created_at")
        )

        course_id = self.request.query_params.get("course_id") or self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        lesson_id = self.request.query_params.get("lesson_id") or self.request.query_params.get("lesson")
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id).order_by("-is_pinned", "timestamp_seconds", "-created_at")

        is_pinned = self.request.query_params.get("is_pinned")
        if is_pinned is not None:
            if str(is_pinned).lower() in ("true", "1"):
                qs = qs.filter(is_pinned=True)
            elif str(is_pinned).lower() in ("false", "0"):
                qs = qs.filter(is_pinned=False)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(content__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-import",
        throttle_classes=[NotesBulkImportRateThrottle],
    )
    def bulk_import(self, request):
        serializer = StudentNoteBulkImportSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        notes_data = serializer.validated_data["notes"]
        mapping = {}
        imported_count = 0

        with transaction.atomic():
            for item in notes_data:
                client_id = item["client_id"]
                created_at = item.get("created_at") or timezone.now()
                note, created = StudentNote.objects.update_or_create(
                    student=request.user,
                    client_id=client_id,
                    defaults={
                        "course": item.get("course"),
                        "lesson": item.get("lesson"),
                        "title": item.get("title", "ملاحظة بدون عنوان"),
                        "content": item.get("content", ""),
                        "timestamp_seconds": item.get("timestamp_seconds"),
                        "tags": item.get("tags", []),
                        "color": item.get("color", "default"),
                        "is_pinned": item.get("is_pinned", False),
                        "blocks": item.get("blocks", []),
                        "created_at": created_at,
                    },
                )
                mapping[str(client_id)] = note.id
                imported_count += 1

        return Response(
            {
                "status": "ok",
                "imported_count": imported_count,
                "mapping": mapping,
            },
            status=status.HTTP_200_OK,
        )
