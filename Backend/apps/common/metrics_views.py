import ipaddress

from django.conf import settings
from django.http import HttpResponse
from rest_framework.permissions import BasePermission
from rest_framework.views import APIView

try:
    from django_prometheus.exports import ExportToDjangoView

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


class InternalIPPermission(BasePermission):
    """
    Allow access only from private network IPs (e.g., internal Docker networks).
    """

    def has_permission(self, request, view):
        client_ip = request.META.get("REMOTE_ADDR")
        if not client_ip:
            return False
        try:
            ip = ipaddress.ip_address(client_ip)
            return ip.is_private or ip.is_loopback
        except ValueError:
            return False


class MetricsView(APIView):
    permission_classes = [InternalIPPermission]
    authentication_classes = []

    def get(self, request):
        if PROMETHEUS_AVAILABLE:
            return ExportToDjangoView(request)

        # Fallback manual metrics if django_prometheus isn't set up yet
        from django.contrib.auth import get_user_model

        User = get_user_model()

        try:
            active_users = User.objects.filter(is_active=True).count()
        except Exception:
            active_users = 0

        # Try to get queue length if possible
        queue_len = 0
        try:
            import redis

            redis_url = getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0")
            r = redis.from_url(redis_url)
            queue_len = r.llen("video_queue")
        except Exception:
            pass

        metrics_data = [
            "# HELP courssat_active_users_total Total number of active users",
            "# TYPE courssat_active_users_total gauge",
            f"courssat_active_users_total {active_users}",
            "",
            "# HELP courssat_video_queue_length Current length of video processing queue",
            "# TYPE courssat_video_queue_length gauge",
            f"courssat_video_queue_length {queue_len}",
        ]

        return HttpResponse("\n".join(metrics_data) + "\n", content_type="text/plain; version=0.0.4")
