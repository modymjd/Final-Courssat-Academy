"""
Watermark and Student File Consent Views.

Endpoints:
- POST /api/v1/courses/lessons/<int:lesson_id>/watermarked-pdf/
- POST /api/v1/courses/student-file-consent/
- GET /api/v1/courses/student-file-consent/status/
"""

from __future__ import annotations

import logging
from pathlib import Path

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assessments.models import StudentFileConsent
from apps.common.services import redis_service
from apps.courses.models import Lesson, LessonSummary
from apps.courses.services import watermark_service
from apps.enrollments.models import Enrollment

logger = logging.getLogger(__name__)


class WatermarkDownloadView(APIView):
    """
    Delivers a personalized watermarked PDF for a lesson summary or attachment.
    Enforces active enrollment access, rate limiting (5 DLs / 10 min), and digital consent.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id: int):
        user = request.user

        # 1. Retrieve lesson
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), id=lesson_id)
        course = lesson.module.course

        # 2. Permission check: Enrolled student with active access OR instructor OR admin
        is_owner = bool(course.instructor_id == user.id)
        is_admin = bool(user.is_staff or getattr(user, "role", "") in ("admin", "super_admin"))

        if not (is_owner or is_admin):
            enrollment = Enrollment.objects.filter(student=user, course=course).first()
            if not enrollment or not enrollment.has_active_access:
                raise Http404("Resource not found.")

        # 3. Rate limiting check: max 5 files per 10 minutes (600 seconds)
        rate_key = f"watermark_dl:{user.id}"
        if not redis_service.check_rate_limit(rate_key, limit=5, window_seconds=600):
            return Response(
                {"detail": "لقد تجاوزت الحد المسموح لتنزيل الملفات (5 ملفات خلال 10 دقائق). يرجى الانتظار."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 4. Consent check: student must have agreed to watermark terms
        if getattr(user, "role", "") == "student":
            if not StudentFileConsent.objects.filter(student=user).exists():
                return Response(
                    {
                        "detail": "يجب الموافقة على إقرار العلامة المائية الرقمية أولاً قبل تنزيل الملفات.",
                        "code": "CONSENT_REQUIRED",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # 5. Inspect source PDF
        summary = LessonSummary.objects.filter(lesson=lesson).first()
        source_file = None

        if summary and summary.attachment and hasattr(summary.attachment, "path"):
            source_file = summary.attachment.path
        elif summary and hasattr(summary, "pdf_file") and getattr(summary, "pdf_file", None):
            source_file = summary.pdf_file.path
        elif hasattr(lesson, "attachment") and getattr(lesson, "attachment", None):
            source_file = lesson.attachment.path

        if not source_file or not Path(source_file).exists():
            return Response(
                {"detail": "لا يوجد ملف PDF مرفق بهذا الدرس."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 6. Apply watermark
        try:
            stamped_path, trace_uuid = watermark_service.stamp_pdf_with_watermark(
                source_pdf=source_file,
                student=user,
                lesson=lesson,
                lesson_summary=summary,
                request=request,
            )
        except Exception as exc:
            logger.error("Failed to generate watermarked PDF for lesson %s: %s", lesson_id, exc)
            return Response(
                {"detail": "حدث خطأ أثناء معالجة وتجهيز الملف. يرجى المحاولة لاحقاً."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 7. Increment successful download counter
        redis_service.increment_successful_counter(rate_key, window_seconds=600)

        # 8. Stream PDF response
        safe_filename = f"Lesson_{lesson.id}.pdf"
        response = FileResponse(
            open(stamped_path, "rb"),
            content_type="application/pdf",
            filename=safe_filename,
            as_attachment=True,
        )
        response["Cache-Control"] = "private, no-store, max-age=0, must-revalidate"
        response["Pragma"] = "no-cache"
        response["X-Trace-UUID"] = str(trace_uuid)
        return response


class StudentFileConsentView(APIView):
    """
    Manages student digital consent for watermarking before downloading resources.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        has_consented = StudentFileConsent.objects.filter(student=request.user).exists()
        return Response({"has_consented": has_consented}, status=status.HTTP_200_OK)

    def post(self, request):
        x_fwd = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = x_fwd.split(",")[0].strip() if x_fwd else request.META.get("REMOTE_ADDR")

        terms_version = request.data.get("terms_version", "1.0")

        consent, created = StudentFileConsent.objects.get_or_create(
            student=request.user,
            defaults={
                "ip_address": ip,
                "terms_version": terms_version,
            },
        )

        return Response(
            {"status": "success", "has_consented": True, "created": created},
            status=status.HTTP_200_OK,
        )
