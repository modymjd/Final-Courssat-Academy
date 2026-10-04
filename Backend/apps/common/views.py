import psutil
import redis
from django.conf import settings
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            db_ok = True
        except Exception:
            db_ok = False
        return Response({"status": "ok", "database": "ok" if db_ok else "error"})


class LivenessProbeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"status": "live"})


class ReadinessProbeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        checks = {}
        status_code = 200

        # Check DB
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "error"
            status_code = 503

        # Check Redis
        try:
            redis_url = getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0")
            r = redis.from_url(redis_url)
            r.ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "error"
            status_code = 503

        # Check Disk Space
        try:
            disk_usage = psutil.disk_usage("/")
            free_gb = disk_usage.free / (1024**3)
            checks["disk_free_gb"] = round(free_gb, 2)
            if free_gb < 10:
                checks["disk_space"] = "warning - low disk space"
        except Exception:
            checks["disk_free_gb"] = 0

        status_text = "ready" if status_code == 200 else "not_ready"
        return Response({"status": status_text, "checks": checks}, status=status_code)
