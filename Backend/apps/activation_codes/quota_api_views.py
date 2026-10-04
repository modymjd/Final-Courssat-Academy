from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.quota import QuotaService


class ActivationCodeQuotaStatusView(APIView):
    """Authenticated quota status for instructors and centers."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(QuotaService.get_quota_snapshot(request.user))
