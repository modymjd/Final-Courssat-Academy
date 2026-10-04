"""
Question Bank Import Service: JSON Schema Validation, HTML Sanitization, Dry-Run, and Bulk Import.

Provides:
- Strict JSON Schema and business logic validation.
- Plain-text sanitization (stripping any HTML tags).
- Verification of positive points and correct_answer containment within options.
- Atomic dry_run mode returning comprehensive line-by-line validation errors.
- Atomic bulk import inside a database transaction.
"""

from __future__ import annotations

import json
import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.assessments.image_paths import normalize_question_image_url
from apps.assessments.models import Exam, QuestionBankItem

logger = logging.getLogger(__name__)

# Regex for stripping script/style tags including their contents, and all remaining HTML tags
_SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", flags=re.DOTALL | re.IGNORECASE)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def sanitize_plain_text(val: Any) -> str:
    """
    Strips script/style tags with their contents, all other HTML tags, and collapses whitespace.
    """
    if val is None:
        return ""
    text = str(val)
    clean = _SCRIPT_STYLE_RE.sub("", text)
    clean = _HTML_TAG_RE.sub("", clean)
    return clean.strip()


def _parse_boolean_flag(value: Any) -> bool:
    """Normalize JSON boolean-like values without treating "false" as truthy."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "نعم", "صح", "صواب"}:
            return True
        if normalized in {"false", "0", "no", "n", "لا", "خطأ", "خطا"}:
            return False
    return False


def _normalize_question_type(item: dict[str, Any]) -> str:
    """Normalize question-type aliases from both frontend and legacy import contracts."""
    raw_type = item.get("question_type") or item.get("questionType") or item.get("type") or "MULTIPLE_CHOICE"
    normalized = str(raw_type).strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "MCQ": "MULTIPLE_CHOICE",
        "MULTIPLECHOICE": "MULTIPLE_CHOICE",
        "TRUEFALSE": "TRUE_FALSE",
        "TRUE_OR_FALSE": "TRUE_FALSE",
        "TF": "TRUE_FALSE",
        "ESSAY_QUESTION": "ESSAY",
    }
    return aliases.get(normalized, normalized)


def _normalize_options(raw_options: Any) -> list[str]:
    """Normalize legacy string options and AI object options into plain option text."""
    if not isinstance(raw_options, list):
        return []
    normalized: list[str] = []
    for option in raw_options:
        if isinstance(option, dict):
            text = option.get("text", option.get("label", ""))
        else:
            text = option
        clean = sanitize_plain_text(text)
        if clean:
            normalized.append(clean)
    return normalized


def _extract_correct_answer(item: dict[str, Any], options: list[str]) -> str:
    """Resolve correct answer from canonical, frontend, and legacy JSON contracts."""
    raw_correct = (
        item.get("correct_answer")
        if item.get("correct_answer") is not None
        else item.get("correctAnswer")
    )
    if raw_correct is None:
        raw_correct = (
            item.get("correct_answer_json")
            if item.get("correct_answer_json") is not None
            else item.get("correctAnswerJson")
        )

    if isinstance(raw_correct, dict):
        raw_correct = raw_correct.get(
            "correct_option",
            raw_correct.get("answer", raw_correct.get("value", "")),
        )
    if raw_correct is not None and str(raw_correct).strip():
        return sanitize_plain_text(raw_correct)

    raw_options = item.get("options") or item.get("options_json") or []
    if isinstance(raw_options, list):
        for option in raw_options:
            if isinstance(option, dict) and _parse_boolean_flag(
                option.get("isCorrect", option.get("is_correct", False))
            ):
                return sanitize_plain_text(option.get("text", option.get("label", "")))

    return options[0] if _normalize_question_type(item) == "TRUE_FALSE" and options else ""


def validate_question_item(item: dict[str, Any], row_num: int) -> list[dict[str, Any]]:
    """
    Validates a single question definition dictionary against business and schema rules.
    Returns a list of error dicts: [{"row": row_num, "field": field, "message": message}, ...]
    """
    errors: list[dict[str, Any]] = []

    # 1. Question Text
    raw_text = item.get("question_text") or item.get("text")
    clean_text = sanitize_plain_text(raw_text)
    if not clean_text:
        errors.append({
            "row": row_num,
            "field": "question_text",
            "message": "نص السؤال مطلوب ولا يمكن أن يكون فارغاً.",
        })

    raw_image_url = item.get("image_url") or item.get("imageUrl")
    if raw_image_url:
        try:
            normalize_question_image_url(raw_image_url)
        except Exception:
            errors.append({
                "row": row_num,
                "field": "image_url",
                "message": "رابط الصورة غير صالح. ارفع الصورة من أداة رفع صور الأسئلة أولاً.",
            })

    # 2. Points Validation
    points_val = item.get("points", 5.0)
    try:
        points_dec = Decimal(str(points_val))
        if points_dec <= Decimal("0.00"):
            errors.append({
                "row": row_num,
                "field": "points",
                "message": "درجة السؤال يجب أن تكون أكبر من صفر.",
            })
    except (InvalidOperation, ValueError, TypeError):
        errors.append({
            "row": row_num,
            "field": "points",
            "message": "درجة السؤال يجب أن تكون قيمة عددية صالحة.",
        })

    # 3. Question Type
    q_type = _normalize_question_type(item)
    valid_types = [choice[0] for choice in QuestionBankItem.QuestionType.choices]
    if q_type not in valid_types:
        errors.append({
            "row": row_num,
            "field": "question_type",
            "message": f"نوع السؤال '{q_type}' غير معتمد. الأنواع المتاحة: {', '.join(valid_types)}.",
        })

    # 4. Options and Correct Answer Validation
    raw_options = item.get("options") or item.get("options_json") or []
    options = _normalize_options(raw_options)
    correct_ans = _extract_correct_answer(item, options)

    if q_type == "MULTIPLE_CHOICE":
        if len(options) < 2:
            errors.append({
                "row": row_num,
                "field": "options",
                "message": "أسئلة الاختيار من متعدد تتطلب على الأقل خيارين اثنين.",
            })
        elif not isinstance(raw_options, list) or len(options) != len(raw_options):
            errors.append({
                "row": row_num,
                "field": "options",
                "message": "كل خيار يجب أن يحتوي على نص غير فارغ.",
            })

        if not correct_ans:
            errors.append({
                "row": row_num,
                "field": "correct_answer",
                "message": "يجب تحديد الإجابة الصحيحة للسؤال.",
            })
        elif options and correct_ans.casefold() not in [opt.casefold() for opt in options]:
            errors.append({
                "row": row_num,
                "field": "correct_answer",
                "message": "الإجابة الصحيحة غير مطابقة لأي من الاختيارات المتاحة.",
            })

    elif q_type == "TRUE_FALSE":
        if raw_options:
            if len(options) != 2:
                errors.append({
                    "row": row_num,
                    "field": "options",
                    "message": "سؤال الصواب والخطأ يجب أن يحتوي على خيارين فقط.",
                })
            elif not isinstance(raw_options, list) or len(options) != len(raw_options):
                errors.append({
                    "row": row_num,
                    "field": "options",
                    "message": "كل خيار يجب أن يحتوي على نص غير فارغ.",
                })

        clean_correct = correct_ans.casefold()
        valid_tf = {"true", "false", "صواب", "خطأ", "صح", "1", "0"}
        if clean_correct not in valid_tf:
            errors.append({
                "row": row_num,
                "field": "correct_answer",
                "message": "إجابة صواب/خطأ يجب أن تكون صواب أو خطأ (True/False).",
            })

    elif q_type == "ESSAY":
        # Essay questions intentionally have no option/correct-answer contract.
        pass

    # 5. Video Timestamps (Optional)
    ts_start = item.get("video_timestamp_start")
    ts_end = item.get("video_timestamp_end")
    if ts_start is not None and ts_end is not None:
        try:
            if int(ts_end) < int(ts_start):
                errors.append({
                    "row": row_num,
                    "field": "video_timestamp_end",
                    "message": "ثانية نهاية الفيديو يجب أن تكون أكبر من أو تساوي ثانية البداية.",
                })
        except (ValueError, TypeError):
            errors.append({
                "row": row_num,
                "field": "video_timestamp_start",
                "message": "ثواني توقيت الفيديو يجب أن تكون أرقاماً صحيحة.",
            })

    return errors


def dry_run(file_content: str | bytes | list[dict[str, Any]]) -> dict[str, Any]:
    """
    Scans and validates questions from raw JSON content without saving to the database.

    Returns:
        {
            "is_valid": bool,
            "total_scanned": int,
            "valid_count": int,
            "error_count": int,
            "errors": [
                {"row": int, "field": str, "message": str},
                ...
            ]
        }
    """
    if isinstance(file_content, bytes):
        try:
            content_str = file_content.decode("utf-8")
        except UnicodeDecodeError:
            return {
                "is_valid": False,
                "total_scanned": 0,
                "valid_count": 0,
                "error_count": 1,
                "errors": [{"row": 0, "field": "file", "message": "ترميز الملف غير صالح (يجب أن يكون UTF-8)."}],
            }
    elif isinstance(file_content, str):
        content_str = file_content
    elif isinstance(file_content, list):
        data = file_content
        content_str = None
    else:
        return {
            "is_valid": False,
            "total_scanned": 0,
            "valid_count": 0,
            "error_count": 1,
            "errors": [{"row": 0, "field": "file", "message": "صيغة المحتوى غير صالحة."}],
        }

    if content_str is not None:
        try:
            data = json.loads(content_str)
        except json.JSONDecodeError as exc:
            return {
                "is_valid": False,
                "total_scanned": 0,
                "valid_count": 0,
                "error_count": 1,
                "errors": [{"row": 0, "field": "file", "message": f"صيغة ملف JSON غير صالحة: {exc.msg}."}],
            }

    # If data is a dict with a "questions" key, extract list
    if isinstance(data, dict):
        data = data.get("questions", [])

    if not isinstance(data, list):
        return {
            "is_valid": False,
            "total_scanned": 0,
            "valid_count": 0,
            "error_count": 1,
            "errors": [{"row": 0, "field": "file", "message": "الملف يجب أن يحتوي على قائمة (array) من الأسئلة."}],
        }

    all_errors: list[dict[str, Any]] = []
    error_rows: set[int] = set()

    for idx, item in enumerate(data):
        row_num = idx + 1
        if not isinstance(item, dict):
            all_errors.append({
                "row": row_num,
                "field": "item",
                "message": "كل عنصر في القائمة يجب أن يكون كائن JSON صالح.",
            })
            error_rows.add(row_num)
            continue

        item_errors = validate_question_item(item, row_num)
        if item_errors:
            question_text = sanitize_plain_text(item.get("question_text") or item.get("text"))
            for error in item_errors:
                error.setdefault("question_text", question_text or "سؤال بدون نص")
            all_errors.extend(item_errors)
            error_rows.add(row_num)

    total_scanned = len(data)
    valid_count = total_scanned - len(error_rows)

    if total_scanned == 0:
        return {
            "is_valid": False,
            "total_scanned": 0,
            "valid_count": 0,
            "error_count": 1,
            "error_question_count": 0,
            "errors": [{"row": 0, "field": "questions", "message": "يجب أن يحتوي الاستيراد على سؤال واحد على الأقل."}],
            "questions": [],
        }

    return {
        "is_valid": len(all_errors) == 0,
        "total_scanned": total_scanned,
        "valid_count": valid_count,
        "error_count": len(all_errors),
        "error_question_count": len(error_rows),
        "errors": all_errors,
        "questions": data if not all_errors else [],
    }


def import_questions(
    file_content: str | bytes | list[dict[str, Any]],
    instructor: Any,
    exam: Exam | None = None,
) -> list[QuestionBankItem]:
    """
    Imports questions atomically into the QuestionBankItem table.
    If any error occurs during validation, the entire transaction is rolled back.

    Args:
        file_content: Raw JSON string, bytes, or parsed list of question dicts.
        instructor: The User model instance of the instructor.
        exam: Optional Exam to associate questions with.

    Returns:
        List of created QuestionBankItem instances.

    Raises:
        ValidationError: If validation fails in dry_run mode.
    """
    validation_result = dry_run(file_content)
    if not validation_result["is_valid"]:
        raise ValidationError(validation_result)

    # Parse data again for creation
    if isinstance(file_content, bytes):
        data = json.loads(file_content.decode("utf-8"))
    elif isinstance(file_content, str):
        data = json.loads(file_content)
    else:
        data = file_content

    if isinstance(data, dict):
        data = data.get("questions", [])

    created_items: list[QuestionBankItem] = []

    with transaction.atomic():
        for idx, item in enumerate(data):
            q_type = _normalize_question_type(item)
            raw_options = item.get("options") or item.get("options_json") or []
            cleaned_options = _normalize_options(raw_options)

            # Format options for TRUE_FALSE if not given
            if q_type == "TRUE_FALSE" and not cleaned_options:
                cleaned_options = ["صواب", "خطأ"]

            # Normalize correct_answer to the grading contract used by ExamViewSet.
            normalized_correct = _extract_correct_answer(item, cleaned_options)
            correct_payload = {"correct_option": normalized_correct}

            points = Decimal(str(item.get("points", 5.0)))
            difficulty = item.get("difficulty") or QuestionBankItem.Difficulty.MEDIUM
            explanation = sanitize_plain_text(item.get("explanation", ""))

            ts_start = item.get("video_timestamp_start")
            ts_end = item.get("video_timestamp_end")

            bank_item = QuestionBankItem.objects.create(
                instructor=instructor,
                exam=exam,
                question_text=sanitize_plain_text(item.get("question_text") or item.get("text")),
                image_url=normalize_question_image_url(item.get("image_url") or item.get("imageUrl")),
                question_type=q_type,
                options_json=cleaned_options,
                correct_answer_json=correct_payload,
                points=points,
                order=idx + 1,
                difficulty=difficulty,
                explanation=explanation,
                video_timestamp_start=int(ts_start) if ts_start is not None else None,
                video_timestamp_end=int(ts_end) if ts_end is not None else None,
            )
            created_items.append(bank_item)

    return created_items
