import sys
from datetime import timedelta
from pathlib import Path

from celery.schedules import crontab
from corsheaders.defaults import default_headers
from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

from config.logging import configure_structlog, get_logging_config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY", default=None)
if not SECRET_KEY:
    raise ImproperlyConfigured("SECRET_KEY environment variable is required and must not be empty.")

DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())
GOOGLE_CLIENT_ID = config(
    "GOOGLE_CLIENT_ID", default="440041713770-tvs55jh8h5batgsf1iha96b85en7tek3.apps.googleusercontent.com"
)

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "django_celery_beat",
    "django_prometheus",
]

LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.courses",
    "apps.enrollments",
    "apps.assessments",
    "apps.notifications",
    "apps.messaging",
    "apps.live_sessions",
    "apps.calendar_events",
    "apps.certificates",
    "apps.finance",
    "apps.analytics",
    "apps.platform_content",
    "apps.academic_tools",
    "apps.activation_codes",
]


INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.common.middleware.QueryParamSnakeCaseMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.ProfileCompletionMiddleware",
    "apps.accounts.middleware.SingleActiveDeviceMiddleware",
    "apps.common.middleware.SecurityNoCacheApiMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.common.middleware.AuditLogMiddleware",
]


ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="edusmart"),
        "USER": config("DB_USER", default="postgres"),
        "PASSWORD": config("DB_PASSWORD", default="postgres"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": config("CONN_MAX_AGE", default=120, cast=int),
    }
}

# Upload requests are chunked at 8 MiB by the video uploader. Keep Django's
# request/parser ceiling above one chunk so multipart overhead never rejects a
# valid chunk before the view can validate it. Large source videos are never
# held in memory as a single request.
DATA_UPLOAD_MAX_MEMORY_SIZE = config("DATA_UPLOAD_MAX_MEMORY_SIZE", default=16 * 1024 * 1024, cast=int)
FILE_UPLOAD_MAX_MEMORY_SIZE = config("FILE_UPLOAD_MAX_MEMORY_SIZE", default=8 * 1024 * 1024, cast=int)

# Celery Configuration
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = config("CELERY_TASK_TIME_LIMIT", default=2 * 60 * 60, cast=int)
CELERY_TASK_ALWAYS_EAGER = config("CELERY_TASK_ALWAYS_EAGER", default=True, cast=bool)
CELERY_TASK_EAGER_PROPAGATES = config("CELERY_TASK_EAGER_PROPAGATES", default=False, cast=bool)

CELERY_BEAT_SCHEDULE = {
    "cleanup-video-scratch-daily": {
        "task": "apps.common.tasks.cleanup_video_scratch_dir_task",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM
    },
}

AUTH_USER_MODEL = "accounts.User"

# DRF throttles rely on Django's cache. LocMem is per-process â€” for multi-worker
# deployments, override CACHE_URL to a shared backend (Redis/Memcached).
CACHES = {
    "default": {
        "BACKEND": config(
            "CACHE_BACKEND",
            default="django.core.cache.backends.locmem.LocMemCache",
        ),
        "LOCATION": config("CACHE_LOCATION", default="unique-snowflake"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
        "apps.accounts.permissions.IsProfileCompleted",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.CamelCasePageNumberPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
        "djangorestframework_camel_case.render.CamelCaseBrowsableAPIRenderer",
    ),
    "DEFAULT_PARSER_CLASSES": (
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "djangorestframework_camel_case.parser.CamelCaseFormParser",
        "djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": config("THROTTLE_ANON", default="60/min"),
        "user": config("THROTTLE_USER", default="1000/hour"),
        "auth_login": config("THROTTLE_AUTH_LOGIN", default="5/min"),
        "auth_register": config("THROTTLE_AUTH_REGISTER", default="3/min"),
        "auth_refresh": config("THROTTLE_AUTH_REFRESH", default="60/min"),
        "video_stream": config("THROTTLE_VIDEO_STREAM", default="20/min"),
        "password_reset": config("THROTTLE_PASSWORD_RESET", default="3/hour"),
        "activation_codes": config("THROTTLE_ACTIVATION_CODES", default="20/min"),
        "certificate_verify": config("THROTTLE_CERTIFICATE_VERIFY", default="30/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=config("JWT_ACCESS_MINUTES", default=60, cast=int)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=config("JWT_REFRESH_DAYS", default=14, cast=int)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Courssat Academy API (أكاديمية كورسات)",
    "DESCRIPTION": "Enterprise Learning Management System API for Courssat Academy (courssat.online)",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "CAMELIZE_NAMES": True,
    "SERVE_PERMISSIONS": (
        ["rest_framework.permissions.AllowAny"]
        if config("DEBUG", default=False, cast=bool)
        else ["apps.common.permissions.IsAdmin"]
    ),
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "drf_spectacular.contrib.djangorestframework_camel_case.camelize_serializer_fields",
        "apps.common.openapi.postprocess_error_responses",
    ],
}

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:8080,http://127.0.0.1:8080",
    cast=Csv(),
)

CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-correlation-id",
    "idempotency-key",
    "authorization",
    "content-type",
    "accept",
]
CORS_EXPOSE_HEADERS = [
    "x-correlation-id",
    "retry-after",
]

# Telegram Parent Bot Configuration
TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_BOT_USERNAME = config("TELEGRAM_BOT_USERNAME", default="EduSmartAcademyBot")
TELEGRAM_WEBHOOK_SECRET = config("TELEGRAM_WEBHOOK_SECRET", default="")

# ============================================================================
# KASHIER PAYMENT GATEWAY CONFIGURATION
# ============================================================================
KASHIER_MERCHANT_ID = config("KASHIER_MERCHANT_ID", default="MID-24326-928")
KASHIER_API_KEY = config("KASHIER_API_KEY", default="sandbox_kashier_api_key")
KASHIER_IFRAME_KEY = config("KASHIER_IFRAME_KEY", default="sandbox_kashier_iframe_key")
KASHIER_SECRET_KEY = config("KASHIER_SECRET_KEY", default="sandbox_kashier_iframe_key")
KASHIER_MODE = config("KASHIER_MODE", default="test")  # 'test' or 'live'
KASHIER_BASE_URL = config(
    "KASHIER_BASE_URL",
    default="https://test-api.kashier.io" if KASHIER_MODE == "test" else "https://api.kashier.io",
)
KASHIER_CHECKOUT_URL = config(
    "KASHIER_CHECKOUT_URL",
    default="https://test-checkout.kashier.io" if KASHIER_MODE == "test" else "https://checkout.kashier.io",
)
KASHIER_CURRENCY = config("KASHIER_CURRENCY", default="EGP")
KASHIER_WEBHOOK_SECRET = config("KASHIER_WEBHOOK_SECRET", default=KASHIER_IFRAME_KEY)
KASHIER_FRONTEND_SUCCESS_URL = config(
    "KASHIER_FRONTEND_SUCCESS_URL",
    default="http://localhost:8080/checkout/success",
)
KASHIER_FRONTEND_FAILURE_URL = config(
    "KASHIER_FRONTEND_FAILURE_URL",
    default="http://localhost:8080/checkout/failed",
)


VIDEO_STORAGE_ADAPTER = config("VIDEO_STORAGE_ADAPTER", default="local")
NGINX_SECURE_LINK_SECRET = config("NGINX_SECURE_LINK_SECRET", default="secret")
BUNNY_STREAM_LIBRARY_ID = config("BUNNY_STREAM_LIBRARY_ID", default="")
BUNNY_STREAM_API_KEY = config("BUNNY_STREAM_API_KEY", default="")
BUNNY_STREAM_TOKEN_KEY = config("BUNNY_STREAM_TOKEN_KEY", default="")
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:8080").rstrip("/")
FRONTEND_BASE_URL = config("FRONTEND_BASE_URL", default=FRONTEND_URL).rstrip("/")

# Lesson Watch Threshold (Enforces >=90% watch before marking lesson as completed)
ENFORCE_WATCH_THRESHOLD = config("ENFORCE_WATCH_THRESHOLD", default=False, cast=bool)

# Quiz Gating Kill Switch (Emergency bypass for quiz gates)
QUIZ_GATE_KILL_SWITCH = config("QUIZ_GATE_KILL_SWITCH", default=False, cast=bool)

# National ID Crypto & Pepper
NATIONAL_ID_PEPPER = config("NATIONAL_ID_PEPPER", default="")
NATIONAL_ID_FERNET_KEYS = config("NATIONAL_ID_FERNET_KEYS", default="")

# Fast hasher ONLY for Django's explicit test command.
# Do not search for the substring "test" in every argument: shell commands can
# legitimately contain values such as an email ending in ".test", which would
# otherwise cause real passwords to be stored with the test-only MD5 hasher.
_is_running_tests = len(sys.argv) > 1 and sys.argv[1] == "test"
_is_production = config("DJANGO_SETTINGS_MODULE", default="").endswith("production")

if _is_running_tests and not _is_production:
    PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]

LOGGING = get_logging_config()
configure_structlog()
