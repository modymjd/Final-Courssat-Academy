"""
Question Bank Import Views: Dry-Run, Bulk Import, and JSON Template.

Endpoints:
- POST /api/v1/assessments/questions/import/dry-run/
- POST /api/v1/assessments/questions/import/
- GET /api/v1/assessments/questions/template/
"""

from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assessments.models import Exam
from apps.assessments.services import question_import_service
from apps.common.image_service import ImageProcessingError, process_and_save_webp
from apps.common.permissions import IsInstructorOrAdmin

logger = logging.getLogger(__name__)


class QuestionImageUploadView(APIView):
    """Validate and convert a question image to a compact WebP file."""

    permission_classes = [IsInstructorOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image_file = request.FILES.get("image") or request.FILES.get("file")
        if not image_file:
            return Response(
                {"detail": "يجب اختيار صورة للسؤال."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = process_and_save_webp(
                image_file,
                subfolder="questions/webp",
                max_dimension=1920,
                quality=82,
                filename_prefix="question",
            )
        except ImageProcessingError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "url": result["url"],
                "absolute_url": request.build_absolute_uri(result["url"]),
                "format": result["format"],
                "width": result["width"],
                "height": result["height"],
                "size_bytes": result["size_bytes"],
            },
            status=status.HTTP_201_CREATED,
        )


def _extract_file_content(request) -> str | bytes | list | dict:
    """Extracts raw content from either an uploaded file or JSON payload."""
    if "file" in request.FILES:
        return request.FILES["file"].read()

    data = request.data
    if isinstance(data, (dict, list)):
        if isinstance(data, dict) and "questions" in data:
            return data["questions"]
        return data

    return ""


class QuestionImportDryRunView(APIView):
    """
    Validates question definitions without saving to the database.
    Returns line-by-line validation errors.
    """

    permission_classes = [IsInstructorOrAdmin]

    def post(self, request):
        content = _extract_file_content(request)
        if not content:
            return Response(
                {"detail": "يجب رفع ملف JSON أو إرسال كائنات الأسئلة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = question_import_service.dry_run(content)
        return Response(result, status=status.HTTP_200_OK)


class QuestionImportCommitView(APIView):
    """
    Atomically imports validated questions into the QuestionBankItem table.
    """

    permission_classes = [IsInstructorOrAdmin]

    def post(self, request):
        content = _extract_file_content(request)
        if not content:
            return Response(
                {"detail": "يجب رفع ملف JSON أو إرسال كائنات الأسئلة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exam_id = (request.data.get("exam_id") if isinstance(request.data, dict) else None) or request.query_params.get("exam_id")
        exam = get_object_or_404(Exam, id=exam_id) if exam_id else None

        try:
            imported = question_import_service.import_questions(
                file_content=content,
                instructor=request.user,
                exam=exam,
            )
            return Response(
                {
                    "status": "success",
                    "imported_count": len(imported),
                    "message": f"تم استيراد {len(imported)} سؤالاً بنجاح.",
                },
                status=status.HTTP_201_CREATED,
            )
        except ValidationError as exc:
            err_data = exc.message_dict if hasattr(exc, "message_dict") else getattr(exc, "params", str(exc))
            return Response(err_data, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error("Failed to import questions: %s", exc)
            return Response(
                {"detail": "حدث خطأ غير متوقع أثناء استيراد الأسئلة."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class QuestionImportTemplateView(APIView):
    """
    Provides a standardized JSON template for question bank import.
    """

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        template = [
            {
                "question_text": "ما هي وحدة قياس القوة في النظام الدولي للوحدات؟",
                "image_url": "",
                "question_type": "MULTIPLE_CHOICE",
                "options": ["النيوتن", "الجول", "الواط", "الباسكال"],
                "correct_answer": "النيوتن",
                "points": 5.0,
                "difficulty": "MEDIUM",
                "explanation": "النيوتن هو وحدة قياس القوة، ويساوي كجم.م/ث^2.",
                "video_timestamp_start": 120,
                "video_timestamp_end": 180,
            },
            {
                "question_text": "الأرض كروية الشكل تماماً.",
                "question_type": "TRUE_FALSE",
                "options": ["صواب", "خطأ"],
                "correct_answer": "خطأ",
                "points": 2.5,
                "difficulty": "EASY",
                "explanation": "الأرض مفلطحة عند القطبين ومنبعجة عند خط الاستواء (شبه كروية).",
            },
        ]
        return Response(template, status=status.HTTP_200_OK)
