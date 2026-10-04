"""
Crypto Service: MultiFernet Encryption, HMAC-SHA256 Blind Indexing, and Masking.

Secures sensitive student identification data (such as Egyptian National ID):
- Reversible field-level encryption using Cryptography's MultiFernet (supporting key rotation).
- Blind indexing / deterministic search hashing using HMAC-SHA256 with a dedicated pepper.
- PII masking helpers for safe display in watermarks and user interfaces.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from collections.abc import Sequence

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings

logger = logging.getLogger(__name__)


def _derive_fallback_key() -> bytes:
    """Derives a deterministic, 32-byte urlsafe base64-encoded key from Django's SECRET_KEY."""
    secret = getattr(settings, "SECRET_KEY", "edusmart_secret_fallback_key_2026")
    digest = hashlib.sha256(f"edusmart_fernet_{secret}".encode()).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet_keys() -> list[bytes]:
    """
    Collects configured Fernet keys from Django settings.
    Supports list, tuple, or comma-separated string.
    Falls back to settings.SECRET_KEY derived key if no explicit keys are provided.
    """
    raw_keys = (
        getattr(settings, "NATIONAL_ID_FERNET_KEYS", None)
        or getattr(settings, "NATIONAL_ID_FERNET_KEY", None)
        or getattr(settings, "FERNET_KEY", None)
    )

    keys: list[bytes] = []

    if isinstance(raw_keys, (list, tuple)):
        for k in raw_keys:
            if isinstance(k, str) and k.strip():
                keys.append(k.strip().encode("utf-8"))
            elif isinstance(k, bytes) and k:
                keys.append(k)
    elif isinstance(raw_keys, str) and raw_keys.strip():
        for k in raw_keys.split(","):
            cleaned = k.strip()
            if cleaned:
                keys.append(cleaned.encode("utf-8"))
    elif isinstance(raw_keys, bytes) and raw_keys:
        keys.append(raw_keys)

    if not keys:
        keys.append(_derive_fallback_key())

    return keys


def get_multi_fernet(keys: Sequence[bytes] | None = None) -> MultiFernet:
    """
    Builds a MultiFernet instance from given or configured keys.
    The first key is used for encryption; all keys are attempted in order for decryption.
    """
    fernet_keys = keys or get_fernet_keys()
    instances = [Fernet(k) for k in fernet_keys]
    return MultiFernet(instances)


def encrypt_national_id(national_id: str, keys: Sequence[bytes] | None = None) -> str:
    """
    Encrypts a national ID string using MultiFernet.

    Args:
        national_id: Plain text national ID.
        keys: Optional custom keys (used in tests or key rotation).

    Returns:
        Urlsafe base64-encoded ciphertext string, or empty string if input is blank.
    """
    if not national_id:
        return ""

    multi_fernet = get_multi_fernet(keys)
    encrypted_bytes = multi_fernet.encrypt(national_id.strip().encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_national_id(ciphertext: str, keys: Sequence[bytes] | None = None) -> str:
    """
    Decrypts a national ID ciphertext using MultiFernet.

    Args:
        ciphertext: Base64-encoded encrypted token.
        keys: Optional custom keys.

    Returns:
        Plain text national ID, or empty string if decryption fails or input is blank.
    """
    if not ciphertext:
        return ""

    multi_fernet = get_multi_fernet(keys)
    try:
        decrypted_bytes = multi_fernet.decrypt(ciphertext.strip().encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        # Check if legacy base64 plaintext was stored
        try:
            raw = base64.b64decode(ciphertext.strip().encode("utf-8")).decode("utf-8")
            if raw.isdigit() and len(raw) == 14:
                return raw
        except Exception:
            pass
        logger.error("Failed to decrypt national_id ciphertext: InvalidToken.")
        return ""


def rotate_national_id(ciphertext: str, new_keys: Sequence[bytes] | None = None) -> str:
    """
    Re-encrypts a ciphertext with the newest primary key in the rotation set.

    Args:
        ciphertext: Old encrypted token.
        new_keys: Key set with the new key in index 0 and old keys afterwards.

    Returns:
        New ciphertext string encrypted with the latest key.
    """
    if not ciphertext:
        return ""

    multi_fernet = get_multi_fernet(new_keys)
    try:
        rotated_bytes = multi_fernet.rotate(ciphertext.strip().encode("utf-8"))
        return rotated_bytes.decode("utf-8")
    except InvalidToken:
        logger.error("Failed to rotate national_id ciphertext: token cannot be decrypted by any known key.")
        return ciphertext


# ---------------------------------------------------------------------------
# HMAC-SHA256 Pepper Hashing (Blind Indexing)
# ---------------------------------------------------------------------------


def get_national_id_pepper() -> bytes:
    """
    Retrieves the HMAC pepper for National ID hashing from settings.
    Falls back to a secret-key derived hash if NATIONAL_ID_PEPPER is not set.
    """
    pepper = getattr(settings, "NATIONAL_ID_PEPPER", None)
    if pepper:
        if isinstance(pepper, str):
            return pepper.strip().encode("utf-8")
        elif isinstance(pepper, bytes):
            return pepper

    # Deterministic fallback using Django SECRET_KEY
    secret = getattr(settings, "SECRET_KEY", "edusmart_secret_pepper_fallback")
    return hashlib.sha256(f"edusmart_pepper_{secret}".encode()).digest()


def hash_national_id(national_id: str, pepper: bytes | None = None) -> str:
    """
    Generates a secure HMAC-SHA256 blind index hash of a national ID for uniqueness
    and fast search without exposing the plain text in the database.

    Args:
        national_id: Plain text national ID.
        pepper: Optional custom pepper bytes.

    Returns:
        64-character hexadecimal HMAC string, or empty string if input is blank.
    """
    if not national_id:
        return ""

    active_pepper = pepper or get_national_id_pepper()
    normalized = national_id.strip()
    return hmac.new(active_pepper, normalized.encode("utf-8"), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# Masking Helper
# ---------------------------------------------------------------------------


def mask_national_id(national_id: str) -> str:
    """
    Masks a national ID for safe display while retaining sufficient characters
    for verification (e.g. '2990101******4').

    Egyptian National ID standard:
    - Length: 14 digits
    - Format: First 7 digits (century, year, month, day, gov) + 6 asterisks + 1 final check digit.

    Args:
        national_id: Plain text national ID (14 digits) or string.

    Returns:
        Masked string.
    """
    if not national_id:
        return ""

    nid = str(national_id).strip()
    length = len(nid)

    if length == 14:
        # Exact Egyptian National ID: 7 visible, 6 masked, 1 visible
        return f"{nid[:7]}******{nid[-1]}"

    if length > 8:
        # General format: show first 7, mask middle, show last
        return f"{nid[:7]}{'*' * (length - 8)}{nid[-1]}"

    if length <= 4:
        return "*" * length

    # 5 to 8 digits
    return f"{nid[:2]}{'*' * (length - 3)}{nid[-1]}"
