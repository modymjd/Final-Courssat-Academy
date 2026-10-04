import os

from rest_framework.exceptions import ValidationError

# Known magic byte signatures
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF-"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpeg": [b"\xff\xd8\xff"],
    "jpg": [b"\xff\xd8\xff"],
    "webp": [b"RIFF"],  # With WEBP at offset 8
    "gif": [b"GIF87a", b"GIF89a"],
}

# MP4 / MOV brand indicators inside the 'ftyp' box
MP4_FTYP_BRANDS = {
    b"isom",
    b"iso2",
    b"mp41",
    b"mp42",
    b"avc1",
    b"M4V ",
    b"M4A ",
    b"qt  ",
    b"MSNV",
    b"dash",
    b"3gp4",
    b"3gp5",
    b"3gp6",
}


def _sniff_magic_bytes(file_obj, read_size=2048) -> bytes:
    """Safely reads the initial binary header bytes and resets file pointer."""
    initial_pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
    try:
        header = file_obj.read(read_size)
    finally:
        if hasattr(file_obj, "seek"):
            file_obj.seek(initial_pos)
    return header if isinstance(header, bytes) else b""


def validate_is_mp4_or_mov(file_obj) -> bool:
    """
    Validates ISO base media file format (MP4 / MOV / M4V).
    According to ISO/IEC 14496-12, the first 4 bytes are size, bytes 4-8 are 'ftyp',
    and bytes 8-12 indicate major brand.
    """
    header = _sniff_magic_bytes(file_obj, 64)
    if len(header) < 12:
        return False

    # Check for 'ftyp' box at index 4..8
    if header[4:8] == b"ftyp":
        major_brand = header[8:12]
        if major_brand in MP4_FTYP_BRANDS:
            return True
        # Check compatible brands in the rest of the ftyp box
        for brand in MP4_FTYP_BRANDS:
            if brand in header[8:32]:
                return True
        return True

    # Check for raw Apple QuickTime atom ('moov' or 'mdat' or 'wide')
    if header[4:8] in (b"moov", b"mdat", b"wide", b"free"):
        return True

    return False


def validate_is_pdf(file_obj) -> bool:
    """Validates PDF file header starts with %PDF-."""
    header = _sniff_magic_bytes(file_obj, 1024)
    return header.startswith(b"%PDF-") or b"%PDF-" in header[:1024]


def validate_is_image(file_obj) -> bool:
    """Validates JPEG, PNG, WebP, or GIF binary signatures."""
    header = _sniff_magic_bytes(file_obj, 32)
    if not header:
        return False

    # JPEG
    if header.startswith(b"\xff\xd8\xff"):
        return True
    # PNG
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    # GIF
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return True
    # WebP (starts with RIFF and contains WEBP at index 8..12)
    if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP":
        return True

    return False


def validate_video_upload(file_obj):
    """
    DRF Validator: Ensures uploaded video is a genuine MP4 / MOV file.
    Rejects disguised executable scripts, PHP shells, or invalid formats.
    """
    if not file_obj:
        return file_obj

    filename = getattr(file_obj, "name", "").lower()
    ext = os.path.splitext(filename)[1].lstrip(".")
    if ext not in ("mp4", "mov", "m4v", "mkv", "webm"):
        raise ValidationError("نوع ملف الفيديو غير مدعوم. الصيغ المسموحة: MP4, MOV, MKV, WebM.")

    if not validate_is_mp4_or_mov(file_obj):
        # Fallback for WebM / MKV (EBML signature: 0x1A 0x45 0xDF 0xA3)
        header = _sniff_magic_bytes(file_obj, 16)
        if header.startswith(b"\x1a\x45\xdf\xa3"):
            return file_obj
        raise ValidationError("الملف المرفوع ليس ملف فيديو صالح أو يحتوي على ترويسة تالفة.")

    return file_obj


def validate_pdf_upload(file_obj):
    """
    DRF Validator: Ensures uploaded document is a genuine PDF file.
    """
    if not file_obj:
        return file_obj

    filename = getattr(file_obj, "name", "").lower()
    ext = os.path.splitext(filename)[1].lstrip(".")
    if ext != "pdf":
        raise ValidationError("نوع الملف غير مسموح. يرجى رفع ملف PDF فقط.")

    if not validate_is_pdf(file_obj):
        raise ValidationError("الملف المرفوع تالف أو ليس مستند PDF حقيقي.")

    return file_obj


def validate_image_upload(file_obj):
    """
    DRF Validator: Ensures uploaded avatar/banner is a genuine image.
    """
    if not file_obj:
        return file_obj

    filename = getattr(file_obj, "name", "").lower()
    ext = os.path.splitext(filename)[1].lstrip(".")
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        raise ValidationError("نوع الصورة غير مدعوم. الصيغ المسموحة: JPG, PNG, WebP.")

    if not validate_is_image(file_obj):
        raise ValidationError("الملف المرفوع ليس صورة صالحة أو يحتوي على بيانات مشبوهة.")

    return file_obj
