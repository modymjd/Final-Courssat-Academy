from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class LegacyCheckoutDisabledView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(
            {
                "detail": "The legacy checkout endpoint is disabled. Use /finance/checkout/session/ for Kashier checkout."
            },
            status=status.HTTP_410_GONE,
        )
