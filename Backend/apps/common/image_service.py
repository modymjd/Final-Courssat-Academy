import logging
import uuid
from pathlib import Path
from typing import Any

from django.conf import settings
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_IMAGE_PIXELS = 40_000_000


class ImageProcessingError(Exception):
    """Raised when an image fails validation or conversion."""
    pass


def process_and_save_webp(
    image_file: Any,
    subfolder: str = "uploads/webp",
    max_dimension: int = 2560,
    quality: int = 85,
    filename_prefix: str = "img",
) -> dict[str, Any]:
    """
    Validates, optimizes, and automatically converts an uploaded image file into WebP format.

    Args:
        image_file: Django UploadedFile or file-like object
        subfolder: Subfolder under MEDIA_ROOT (e.g., 'avatars/webp' or 'courses/webp')
        max_dimension: Maximum width/height to downscale if exceeded (LANCZOS)
        quality: WebP compression quality (1-100, default 85)
        filename_prefix: Prefix for generated file name

    Returns:
        Dict with relative_url, absolute_path, format, width, height, size_bytes
    """
    if not image_file:
        raise ImageProcessingError("ملف الصورة مطلوب.")

    if hasattr(image_file, "size") and image_file.size > MAX_IMAGE_BYTES:
        raise ImageProcessingError("حجم الصورة يتجاوز الحد الأقصى المسموح به (10 ميجابايت).")

    try:
        image: Image.Image = Image.open(image_file)
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise ImageProcessingError("أبعاد الصورة كبيرة جداً. الحد الأقصى هو 40 مليون بكسل.")
        # Transpose image according to EXIF orientation tag if present
        image = ImageOps.exif_transpose(image)
    except ImageProcessingError:
        raise
    except Exception as e:
        logger.warning("Invalid image file uploaded: %s", str(e))
        raise ImageProcessingError("الملف المرفوع ليس صورة صالحة أو تالف.") from e

    # Color mode normalization
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")

    # Downscale smoothly if exceeds maximum resolution
    orig_w, orig_h = image.size
    if orig_w > max_dimension or orig_h > max_dimension:
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    # Destination setup
    dest_dir = Path(settings.MEDIA_ROOT) / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)

    unique_id = uuid.uuid4().hex[:12]
    filename = f"{filename_prefix}_{unique_id}.webp"
    target_path = dest_dir / filename

    try:
        # Save as WebP with optimal settings
        image.save(target_path, format="WEBP", quality=quality, method=6)
    except Exception as e:
        logger.exception("Failed to encode image to WebP: %s", str(e))
        raise ImageProcessingError("حدث خطأ أثناء معالجة وضغط الصورة بصيغة WebP.") from e

    file_size = target_path.stat().st_size
    relative_url = f"{settings.MEDIA_URL}{subfolder.rstrip('/')}/{filename}"

    return {
        "url": relative_url,
        "filename": filename,
        "absolute_path": str(target_path),
        "format": "webp",
        "width": image.width,
        "height": image.height,
        "size_bytes": file_size,
    }
