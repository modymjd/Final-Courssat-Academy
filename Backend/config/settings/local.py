"""Local Docker settings only. Never use this module in production."""

import sys

from .development import *  # noqa: F401,F403

# Absolute URLs are required for Django admin assets and uploaded media.
STATIC_URL = "/static/"
MEDIA_URL = "/media/"

# Keep the test suite deterministic and independent from Docker networking.
# Runtime development still uses Redis normally; only `manage.py test` switches
# locking/cache and Celery to in-process implementations.
if "test" in sys.argv:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "courssat-local-tests",
        }
    }
    REDIS_URL = ""
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = "cache+memory://"
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
