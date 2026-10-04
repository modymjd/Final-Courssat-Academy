import hashlib
import time

from django.conf import settings


def generate_signed_hls_url(video_id: str, client_ip: str = "0.0.0.0", expires_in_seconds: int = 7200) -> str:
    """Generates a secure expiration-bound signed HLS video playback URL for Bunny Stream DRM."""
    token_key = getattr(settings, "BUNNY_STREAM_TOKEN_KEY", "edusmart-secure-drm-key-2026")
    library_id = getattr(settings, "BUNNY_STREAM_LIBRARY_ID", "345912")
    expiration = int(time.time()) + expires_in_seconds

    # Token Hash Construction: token_key + video_id + expiration + client_ip
    hashable = f"{token_key}{video_id}{expiration}{client_ip}"
    token_hash = hashlib.sha256(hashable.encode("utf-8")).hexdigest()

    stream_url = f"https://video.bunnycdn.com/play/{library_id}/{video_id}?token={token_hash}&expires={expiration}"
    return stream_url


def generate_bunny_upload_signature(title: str) -> dict:
    """Generates direct-to-CDN upload parameters for chunked video uploads."""
    library_id = getattr(settings, "BUNNY_STREAM_LIBRARY_ID", "345912")
    expiration = int(time.time()) + 3600

    return {
        "library_id": library_id,
        "expiration": expiration,
        "upload_endpoint": f"https://video.bunnycdn.com/library/{library_id}/videos",
        "title": title,
    }
