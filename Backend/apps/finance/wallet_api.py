from decimal import Decimal

from decouple import config
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import KashierService, get_center_wallet, get_instructor_wallet, get_student_wallet


class WalletTopUpPayloadSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    gateway = serializers.ChoiceField(
        choices=[
            "kashier",
            "vodafone_cash",
            "orange_cash",
            "etisalat_cash",
            "we_pay",
            "fawry",
            "meeza",
            "card",
            "instapay",
            "wallet",
        ],
        default="kashier",
    )
    return_url = serializers.URLField(required=False, allow_blank=True)


class SecureWalletTopUpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopUpPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        role = getattr(request.user, "role", "student")
        if role == "instructor":
            wallet = get_instructor_wallet(request.user)
        elif role in ("center", "center_admin"):
            wallet = get_center_wallet(request.user)
        elif role == "student":
            wallet = get_student_wallet(request.user)
        else:
            return Response(
                {"detail": "This account type cannot top up a personal wallet."},
                status=status.HTTP_403_FORBIDDEN,
            )

        merchant_order_id = f"WLT-{wallet.id}-{int(timezone.now().timestamp())}"
        default_frontend = getattr(settings, "FRONTEND_URL", None) or ("https://courssat.online" if not getattr(settings, "DEBUG", True) else "http://localhost:8080")
        return_url = serializer.validated_data.get("return_url") or config("FRONTEND_BASE_URL", default=default_frontend)
        return_url = return_url.rstrip("/")

        try:
            session = KashierService().create_checkout_session(
                resource_type="wallet_deposit",
                resource_id=wallet.id,
                user=request.user,
                amount=amount,
                merchant_order_id=merchant_order_id,
                return_url=return_url,
            )
        except Exception:
            return Response(
                {"detail": "تعذر إنشاء جلسة الدفع. حاول مرة أخرى."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                **session,
                "wallet_id": wallet.id,
                "status": "checkout_created",
            },
            status=status.HTTP_201_CREATED,
        )
