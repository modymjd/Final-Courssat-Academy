import pyotp
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.middleware import log_audit_event
from apps.common.models import AuditLog
from apps.common.permissions import IsSuperAdmin

from .models import UserRole
from .serializers import UserSerializer


class Verify2FASerializer(serializers.Serializer):
    code = serializers.CharField(required=True, max_length=10)


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_email",
            "action_type",
            "target_model",
            "target_id",
            "old_value",
            "new_value",
            "ip_address",
            "user_agent",
            "created_at",
        )
        read_only_fields = fields


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def super_admin_verify_2fa(request):
    """Endpoint to verify 2FA TOTP code for Super Admin and issue an elevated JWT token."""
    user = request.user
    if user.role != UserRole.SUPER_ADMIN:
        return Response(
            {"detail": "Forbidden: Super Admin privilege required."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = Verify2FASerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    code = serializer.validated_data["code"]

    # Ensure user has a valid TOTP secret configured
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.save(update_fields=["totp_secret"])

    is_valid = False
    try:
        totp = pyotp.TOTP(user.totp_secret)
        is_valid = totp.verify(code.strip(), valid_window=1)
    except Exception:
        is_valid = False

    if not is_valid:
        log_audit_event(
            request=request,
            action_type="FAILED_2FA_ATTEMPT",
            target_model="User",
            target_id=str(user.id),
            new_value={"code_provided": "****"},
        )
        return Response(
            {"detail": "رمز المصادقة الثنائية (2FA) غير صحيح أو منتهي الصلاحية."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Generate elevated token with 2FA claim
    refresh = RefreshToken.for_user(user)
    refresh["is_2fa_verified"] = True
    access_token = refresh.access_token
    access_token["is_2fa_verified"] = True

    user.last_login_at = timezone.now()
    user.save(update_fields=["last_login_at"])

    log_audit_event(
        request=request,
        action_type="SUPER_ADMIN_2FA_SUCCESS",
        target_model="User",
        target_id=str(user.id),
        new_value={"session": "elevated_2fa"},
    )

    return Response(
        {
            "user": UserSerializer(user, context={"request": request}).data,
            "access": str(access_token),
            "refresh": str(refresh),
            "is_2fa_verified": True,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def super_admin_session_check(request):
    """Check Super Admin auth session status."""
    user = request.user
    if user.role != UserRole.SUPER_ADMIN:
        return Response({"detail": "Not a Super Admin."}, status=status.HTTP_403_FORBIDDEN)

    auth = request.auth
    is_2fa_verified = False
    if isinstance(auth, dict):
        is_2fa_verified = bool(auth.get("is_2fa_verified") is True)
    elif hasattr(auth, "get"):
        is_2fa_verified = bool(auth.get("is_2fa_verified") is True)

    return Response(
        {
            "user": UserSerializer(user, context={"request": request}).data,
            "is_2fa_verified": is_2fa_verified,
        }
    )


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for Super Admin to inspect Audit Logs."""

    queryset = AuditLog.objects.all().select_related("actor").order_by("-created_at")
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["action_type", "target_model", "actor"]
    search_fields = ["action_type", "target_model", "target_id", "ip_address", "actor__email"]
    ordering_fields = ["created_at", "action_type"]
