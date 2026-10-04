from __future__ import annotations

import re
from typing import Any

from rest_framework import serializers


QUESTION_IMAGE_PREFIX = "/media/questions/webp/"
QUESTION_IMAGE_RE = re.compile(r"^/media/questions/webp/question_[a-f0-9]{12}\.webp$")


def normalize_question_image_url(value: Any) -> str:
    """
    Only persist URLs produced by the authenticated question-image endpoint.

    Keeping the value relative lets the same database work locally and in
    production without storing a development hostname.
    """
    image_url = str(value or "").strip()
    if not image_url:
        return ""
    if not QUESTION_IMAGE_RE.fullmatch(image_url):
        raise serializers.ValidationError(
            "رابط صورة السؤال غير صالح. ارفع الصورة من أداة رفع صور الأسئلة."
        )
    return image_url