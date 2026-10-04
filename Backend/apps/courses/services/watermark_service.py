"""
Watermark Service: Dynamic PDF Stamping, Policy-Based Identification, and Audit Logging.

Features:
- ReportLab overlay canvas with semi-transparent, diagonal text stamping.
- Merging with PyPDF (with graceful fallback if PyPDF is unavailable).
- Policy-based text generation:
  * FULL: Full name, unmasked National ID, Student Code.
  * MASKED: Full name, masked National ID (e.g. 2990101******4), Student Code.
  * STUDENT_CODE: Full name, Student Code only.
- Invisible trace UUID embedded in PDF metadata (/TraceID).
- Server-side private file cache at Backend/var/private_cache/stamped_pdfs/ (outside web root).
- Concurrency slot limiter via Redis (max 3 concurrent stamping operations).
- Audit log recording via FileDownloadAuditLog.
"""

from __future__ import annotations

import hashlib
import io
import logging
import uuid
from enum import StrEnum
from pathlib import Path
from typing import Any

from django.conf import settings

from apps.accounts.services.crypto_service import decrypt_national_id, mask_national_id
from apps.assessments.models import FileDownloadAuditLog
from apps.common.services.redis_service import concurrency_slot

logger = logging.getLogger(__name__)


class WatermarkPolicy(StrEnum):
    FULL = "FULL"
    MASKED = "MASKED"
    STUDENT_CODE = "STUDENT_CODE"


def generate_watermark_text(student: Any, policy: WatermarkPolicy = WatermarkPolicy.MASKED) -> str:
    """
    Constructs the watermark identification string according to the specified policy.
    Supports Arabic text reshaping for correct rendering in PDF canvases.
    """
    student_name = ""
    if hasattr(student, "get_full_name") and student.get_full_name():
        student_name = student.get_full_name()
    elif getattr(student, "first_name", None):
        student_name = f"{student.first_name} {getattr(student, 'last_name', '')}".strip()
    elif getattr(student, "email", None):
        student_name = student.email

    student_code = ""
    profile = getattr(student, "student_profile", None)
    if profile and getattr(profile, "student_code", None):
        student_code = profile.student_code
    else:
        student_code = f"STU-{student.id}"

    # Extract National ID
    raw_nid = ""
    if getattr(student, "national_id_encrypted", None):
        raw_nid = decrypt_national_id(student.national_id_encrypted)
    elif getattr(student, "national_id", None):
        raw_nid = student.national_id

    if policy == WatermarkPolicy.FULL:
        nid_part = raw_nid if raw_nid else "N/A"
        text = f"{student_name} | {nid_part} | {student_code}"
    elif policy == WatermarkPolicy.MASKED:
        masked = mask_national_id(raw_nid) if raw_nid else "N/A"
        text = f"{student_name} | {masked} | {student_code}"
    else:  # STUDENT_CODE
        text = f"{student_name} | {student_code}"

    # Reshape Arabic characters if necessary
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
    except Exception:
        return text


def create_watermark_overlay_stream(text: str, width: float, height: float) -> io.BytesIO:
    """
    Generates a single-page PDF containing a semi-transparent diagonal watermark overlay
    sized to (width, height) using ReportLab.
    """
    from reportlab.lib.colors import Color
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(width, height))

    # Watermark styling: subtle gray, semi-transparent
    watermark_color = Color(0.6, 0.6, 0.6, alpha=0.18)
    c.setFillColor(watermark_color)
    c.setFont("Helvetica", 14)

    # Save state, translate to center, rotate 45 degrees
    c.saveState()
    c.translate(width / 2.0, height / 2.0)
    c.rotate(45)

    # Draw centered repeating text lines
    step = 120
    for y_offset in (-2 * step, -step, 0, step, 2 * step):
        c.drawCentredString(0, y_offset, text)

    c.restoreState()
    c.showPage()
    c.save()

    buffer.seek(0)
    return buffer


def stamp_pdf_for_student(
    source_pdf_bytes: bytes,
    student: Any,
    lesson_summary: Any,
    policy: WatermarkPolicy = WatermarkPolicy.MASKED,
    ip_address: str | None = None,
    user_agent: str = "",
) -> tuple[Path, uuid.UUID]:
    """
    Applies the student watermark onto a source PDF:
    1. Checks the private server-side cache at Backend/var/private_cache/stamped_pdfs/.
    2. If not cached, acquires a concurrency slot (max 3 concurrent stamping tasks).
    3. Merges ReportLab overlay with source pages and embeds invisible trace UUID in metadata.
    4. Records download in FileDownloadAuditLog.

    Returns:
        tuple (cached_pdf_path: Path, trace_uuid: uuid.UUID)
    """
    trace_uuid = uuid.uuid4()
    watermark_text = generate_watermark_text(student, policy)

    # Ensure private cache directory exists
    cache_dir = Path(settings.BASE_DIR) / "var" / "private_cache" / "stamped_pdfs"
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Compute source content hash for cache naming
    source_hash = hashlib.sha256(source_pdf_bytes).hexdigest()[:16]
    cached_file_path = cache_dir / f"{source_hash}_{student.id}_{policy.value}.pdf"

    # Check if a stamped version is already cached
    if cached_file_path.exists() and cached_file_path.stat().st_size > 0:
        # Record audit log
        FileDownloadAuditLog.objects.create(
            student=student,
            lesson_summary=lesson_summary,
            trace_uuid=trace_uuid,
            ip_address=ip_address,
            user_agent=user_agent[:500],
        )
        return (cached_file_path, trace_uuid)

    # Acquire concurrency slot (max 3 concurrent PDF stamping operations)
    with concurrency_slot("watermark:active_jobs", max_slots=3, timeout_seconds=60):
        # Double check cache inside the lock
        if cached_file_path.exists() and cached_file_path.stat().st_size > 0:
            FileDownloadAuditLog.objects.create(
                student=student,
                lesson_summary=lesson_summary,
                trace_uuid=trace_uuid,
                ip_address=ip_address,
                user_agent=user_agent[:500],
            )
            return (cached_file_path, trace_uuid)

        # Attempt stamping using pypdf
        try:
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(source_pdf_bytes))
            writer = pypdf.PdfWriter()

            for page in reader.pages:
                width = float(page.mediabox.width)
                height = float(page.mediabox.height)
                overlay_stream = create_watermark_overlay_stream(watermark_text, width, height)
                overlay_reader = pypdf.PdfReader(overlay_stream)
                page.merge_page(overlay_reader.pages[0])
                writer.add_page(page)

            # Embed invisible trace UUID in PDF metadata
            writer.add_metadata({
                "/TraceID": str(trace_uuid),
                "/Keywords": f"TraceID={trace_uuid}",
            })

            with open(cached_file_path, "wb") as out_f:
                writer.write(out_f)

        except ImportError:
            # Fallback if pypdf is not installed: write source directly to cache
            logger.warning("pypdf is not installed; serving source PDF without visual watermark overlay.")
            with open(cached_file_path, "wb") as out_f:
                out_f.write(source_pdf_bytes)
        except Exception as exc:
            logger.error("Failed to stamp PDF with watermark: %s. Falling back to source file.", exc)
            with open(cached_file_path, "wb") as out_f:
                out_f.write(source_pdf_bytes)

    # Record download in audit log
    if lesson_summary:
        FileDownloadAuditLog.objects.create(
            student=student,
            lesson_summary=lesson_summary,
            trace_uuid=trace_uuid,
            ip_address=ip_address,
            user_agent=user_agent[:500],
        )

    return (cached_file_path, trace_uuid)


def stamp_pdf_with_watermark(
    source_pdf: Path | str | bytes,
    student: Any,
    lesson: Any = None,
    lesson_summary: Any = None,
    request: Any = None,
    policy: WatermarkPolicy = WatermarkPolicy.MASKED,
) -> tuple[Path, uuid.UUID]:
    """
    Convenience wrapper for stamp_pdf_for_student accepting a file path or raw bytes,
    and extracting IP / user-agent from request if provided.
    """
    if isinstance(source_pdf, (str, Path)):
        with open(source_pdf, "rb") as f:
            pdf_bytes = f.read()
    else:
        pdf_bytes = source_pdf

    ip_address = None
    user_agent = ""
    if request:
        x_fwd = request.META.get("HTTP_X_FORWARDED_FOR")
        ip_address = x_fwd.split(",")[0].strip() if x_fwd else request.META.get("REMOTE_ADDR")
        user_agent = request.META.get("HTTP_USER_AGENT", "")

    if lesson_summary is None and lesson and hasattr(lesson, "summary"):
        lesson_summary = getattr(lesson, "summary", None)

    return stamp_pdf_for_student(
        source_pdf_bytes=pdf_bytes,
        student=student,
        lesson_summary=lesson_summary,
        policy=policy,
        ip_address=ip_address,
        user_agent=user_agent,
    )
