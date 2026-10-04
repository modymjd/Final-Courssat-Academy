import sentry_sdk
from cryptography.fernet import Fernet
from decouple import config
from django.core.exceptions import ImproperlyConfigured
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from urllib.parse import urlsplit

from .base import *  # noqa: F401,F403,F405

DEBUG = False
CELERY_TASK_ALWAYS_EAGER = False

if SECRET_KEY in {  # noqa: F405
    "change-me-in-production",
    "change_me_to_a_secure_random_string",
    "local-only-secret-key-change-before-production",
}:
    raise ImproperlyConfigured("SECRET_KEY must be configured with a secure production secret key.")

_database_password = config("DB_PASSWORD", default="")
if not _database_password or _database_password in {
    "postgres",
    "change_me_secure_db_password",
}:
    raise ImproperlyConfigured("DB_PASSWORD must be configured with a non-default production password.")

if not NGINX_SECURE_LINK_SECRET or NGINX_SECURE_LINK_SECRET in {  # noqa: F405
    "secret",
    "change-me-in-production",
    "change_me_to_secure_hls_secret",  # the literal placeholder from .env.production.example
    "courssat_nginx_local_hls_secret_key_2026",  # local-dev fallback baked into apps/courses/views.py
}:
    raise ImproperlyConfigured("NGINX_SECURE_LINK_SECRET must be configured with a non-default production secret.")

# Security: Strictly enforce enterprise-grade password hashers in production.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]
if any("MD5" in h for h in PASSWORD_HASHERS):
    raise ImproperlyConfigured("MD5PasswordHasher must NEVER be active in production.")

# The generic payment webhook is intentionally fail-closed at request time. It is not
# required for application startup while the platform is using its provider-specific
# payment flow. When this integration is activated, configure PAYMENT_WEBHOOK_SECRET
# before exposing the generic webhook endpoint to a payment provider.

# Production Cache: shared Redis is required for rate limiting and distributed workers.
REDIS_URL = config("REDIS_URL", default="")
if not REDIS_URL:
    raise ImproperlyConfigured("REDIS_URL is required in production.")

_redis_password = config("REDIS_PASSWORD", default="")
if not _redis_password or _redis_password in {"redis", "change_me_secure_redis_password"}:
    raise ImproperlyConfigured("REDIS_PASSWORD must be configured with a non-default production password.")

for _name, _url in {
    "REDIS_URL": REDIS_URL,
    "CELERY_BROKER_URL": CELERY_BROKER_URL,  # noqa: F405
    "CELERY_RESULT_BACKEND": CELERY_RESULT_BACKEND,  # noqa: F405
}.items():
    try:
        _parts = urlsplit(_url)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{_name} is not a valid Redis URL.") from exc
    if _parts.scheme not in {"redis", "rediss"} or not _parts.hostname:
        raise ImproperlyConfigured(f"{_name} must be a redis:// or rediss:// URL.")
    if _parts.password != _redis_password:
        raise ImproperlyConfigured(
            f"{_name} must include the same password configured in REDIS_PASSWORD."
        )

REQUIRE_VIDEO_CDN = config("REQUIRE_VIDEO_CDN", default=False, cast=bool)
if REQUIRE_VIDEO_CDN and VIDEO_STORAGE_ADAPTER == "local":  # noqa: F405
    raise ImproperlyConfigured(
        "REQUIRE_VIDEO_CDN=True requires a validated external VIDEO_STORAGE_ADAPTER. "
        "Local HLS must not be used for a 500-viewer launch."
    )

_national_id_keys = [
    item.strip()
    for item in config("NATIONAL_ID_FERNET_KEYS", default="").split(",")
    if item.strip()
]
if not _national_id_keys:
    raise ImproperlyConfigured(
        "NATIONAL_ID_FERNET_KEYS is required in production so encrypted student data "
        "does not depend on SECRET_KEY."
    )
try:
    for _key in _national_id_keys:
        Fernet(_key.encode("utf-8"))
except (TypeError, ValueError) as exc:
    raise ImproperlyConfigured(
        "Every NATIONAL_ID_FERNET_KEYS value must be a valid Fernet key."
    ) from exc

_national_id_pepper = config("NATIONAL_ID_PEPPER", default="")
if len(_national_id_pepper) < 32:
    raise ImproperlyConfigured("NATIONAL_ID_PEPPER must be at least 32 characters in production.")

CACHES = {
    "default": {
        "BACKEND": config(
            "CACHE_BACKEND",
            default="django.core.cache.backends.redis.RedisCache",
        ),
        "LOCATION": REDIS_URL,
    }
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
X_FRAME_OPTIONS = "DENY"

# Only trust the real production web origin in production. Additional origins must be
# explicitly supplied through CORS_ALLOWED_ORIGINS rather than silently enabling CORS.
_cors_origins = [origin.strip().rstrip("/") for origin in config("CORS_ALLOWED_ORIGINS", default="https://courssat.online,https://www.courssat.online", cast=lambda value: value.split(",")) if origin.strip()]
CORS_ALLOWED_ORIGINS = _cors_origins
CORS_ALLOW_ALL_ORIGINS = False

CSRF_TRUSTED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in config(
        "CSRF_TRUSTED_ORIGINS",
        default="https://courssat.online,https://www.courssat.online",
        cast=lambda value: value.split(","),
    )
    if origin.strip()
]

# Canonical production frontend domain
FRONTEND_URL = config("FRONTEND_URL", default="https://courssat.online").rstrip("/")
FRONTEND_BASE_URL = config("FRONTEND_BASE_URL", default=FRONTEND_URL).rstrip("/")
KASHIER_FRONTEND_SUCCESS_URL = config("KASHIER_FRONTEND_SUCCESS_URL", default=f"{FRONTEND_URL}/checkout/success")
KASHIER_FRONTEND_FAILURE_URL = config("KASHIER_FRONTEND_FAILURE_URL", default=f"{FRONTEND_URL}/checkout/failed")


def _scrub_sensitive_data(event, hint):
    sensitive_keys = ["password", "token", "national_id", "phone", "totp_secret", "authorization"]

    if "request" in event and "data" in event["request"]:
        data = event["request"]["data"]
        if isinstance(data, dict):
            for key in sensitive_keys:
                if key in data:
                    data[key] = "[Filtered]"

    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        for key in list(headers.keys()):
            if "token" in key.lower() or "authorization" in key.lower():
                headers[key] = "[Filtered]"

    return event


SENTRY_DSN = config("SENTRY_DSN", default="")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration(), RedisIntegration()],
        traces_sample_rate=config("SENTRY_TRACES_RATE", default=0.1, cast=float),
        send_default_pii=False,
        before_send=_scrub_sensitive_data,
        environment=config("ENVIRONMENT", default="production"),
        release=config("APP_VERSION", default="1.0.0"),
    )

STATICFILES_STORAGE = "django.contrib.staticfiles.storage.ManifestStaticFilesStorage"
STATIC_URL = config("STATIC_CDN_URL", default="/static/")
