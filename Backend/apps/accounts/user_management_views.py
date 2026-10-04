from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db.models import Q
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User, UserRole
from apps.common.middleware import log_audit_event
from apps.common.permissions import IsSuperAdmin

from .user_management_serializers import (
    SuperAdminUserDetailSerializer,
    SuperAdminUserListSerializer,
    UserDeleteConfirmationSerializer,
    UserRoleChangeSerializer,
    UserSuspendSerializer,
)


class SuperAdminUserViewSet(viewsets.ModelViewSet):
    """Full-featured User Management ViewSet for Super Admin."""

    queryset = User.objects.all().order_by("-created_at")
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SuperAdminUserDetailSerializer
        if self.action == "suspend":
            return UserSuspendSerializer
        if self.action == "change_role":
            return UserRoleChangeSerializer
        if self.action == "destroy":
            return UserDeleteConfirmationSerializer
        return SuperAdminUserListSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        # Role filter
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)

        # Status filter
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            if is_active.lower() in ("true", "1"):
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ("false", "0"):
                qs = qs.filter(is_active=False)

        # Search filter
        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )

        # Date Joined filters
        date_after = self.request.query_params.get("date_joined_after")
        if date_after:
            qs = qs.filter(created_at__gte=date_after)
        date_before = self.request.query_params.get("date_joined_before")
        if date_before:
            qs = qs.filter(created_at__lte=date_before)

        return qs

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        """Suspend a user account."""
        target_user = self.get_object()
        serializer = UserSuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "Admin suspension")

        if (
            target_user.role == UserRole.SUPER_ADMIN
            and User.objects.filter(role=UserRole.SUPER_ADMIN, is_active=True).count() <= 1
        ):
            return Response(
                {"detail": "Cannot suspend the sole active Super Admin in the system."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_status = target_user.is_active
        target_user.is_active = False
        target_user.save(update_fields=["is_active"])

        log_audit_event(
            request=request,
            action_type="USER_SUSPENDED",
            target_model="User",
            target_id=str(target_user.id),
            old_value={"is_active": old_status},
            new_value={"is_active": False, "reason": reason},
        )

        return Response(
            {
                "message": f"User {target_user.email} has been suspended.",
                "user": SuperAdminUserListSerializer(target_user).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        """Activate a suspended user account."""
        target_user = self.get_object()
        old_status = target_user.is_active
        target_user.is_active = True
        target_user.save(update_fields=["is_active"])

        log_audit_event(
            request=request,
            action_type="USER_ACTIVATED",
            target_model="User",
            target_id=str(target_user.id),
            old_value={"is_active": old_status},
            new_value={"is_active": True},
        )

        return Response(
            {
                "message": f"User {target_user.email} has been activated.",
                "user": SuperAdminUserListSerializer(target_user).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="change-role")
    def change_role(self, request, pk=None):
        """Change user role with safeguards."""
        target_user = self.get_object()
        serializer = UserRoleChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data["role"]

        if target_user.role == UserRole.SUPER_ADMIN and new_role != UserRole.SUPER_ADMIN:
            if User.objects.filter(role=UserRole.SUPER_ADMIN, is_active=True).count() <= 1:
                return Response(
                    {"detail": "Cannot demote the sole active Super Admin in the system."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_role = target_user.role
        target_user.role = new_role
        if new_role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            target_user.is_staff = True
        target_user.save(update_fields=["role", "is_staff"])

        log_audit_event(
            request=request,
            action_type="USER_ROLE_CHANGED",
            target_model="User",
            target_id=str(target_user.id),
            old_value={"role": old_role},
            new_value={"role": new_role},
        )

        return Response(
            {
                "message": f"User role for {target_user.email} updated to {new_role}.",
                "user": SuperAdminUserListSerializer(target_user).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="reset-password-link")
    def reset_password_link(self, request, pk=None):
        """Generate & dispatch password reset email token link. NEVER exposes password or token."""
        target_user = self.get_object()

        uid = urlsafe_base64_encode(force_bytes(target_user.pk))
        token = default_token_generator.make_token(target_user)
        frontend_url = getattr(settings, "FRONTEND_URL", "https://courssat.online").rstrip("/")
        reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        # Send reset email
        try:
            send_mail(
                subject="رابط إعادة تعيين كلمة المرور - أكاديمية كورسات",
                message=(
                    f"مرحباً {target_user.first_name}،\n\n"
                    f"تم استلام طلب لإعادة تعيين كلمة المرور الخاصة بحسابك في أكاديمية كورسات.\n"
                    f"يمكنك تعيين كلمة مرور جديدة من خلال الرابط التالي:\n\n"
                    f"{reset_link}\n\n"
                    f"هذا الرابط صالح للاستخدام لمدة 15 دقيقة فقط لأسباب أمنية.\n\n"
                    f"إذا لم تكن أنت من طلب ذلك، يرجى تجاهل هذه الرسالة أو التواصل مع الدعم الفني."
                ),
                from_email="noreply@courssat.online",
                recipient_list=[target_user.email],
                fail_silently=False,
            )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error("Failed to send password reset email to %s: %s", target_user.email, str(e), exc_info=True)
            return Response(
                {"detail": "Failed to send password reset email. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        log_audit_event(
            request=request,
            action_type="USER_PASSWORD_RESET_REQUESTED",
            target_model="User",
            target_id=str(target_user.id),
            new_value={"email_sent_to": target_user.email},
        )

        return Response(
            {
                "message": f"Password reset email link has been sent to {target_user.email}.",
            }
        )

    def destroy(self, request, *args, **kwargs):
        """Delete user account with strong email confirmation."""
        target_user = self.get_object()

        if target_user == request.user:
            return Response(
                {"detail": "Super Admin cannot delete their own active account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            target_user.role == UserRole.SUPER_ADMIN
            and User.objects.filter(role=UserRole.SUPER_ADMIN, is_active=True).count() <= 1
        ):
            return Response(
                {"detail": "Cannot delete the sole active Super Admin in the system."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = UserDeleteConfirmationSerializer(data=request.data, context={"user": target_user})
        serializer.is_valid(raise_exception=True)

        user_id = target_user.id
        user_email = target_user.email

        target_user.delete()

        log_audit_event(
            request=request,
            action_type="USER_DELETED",
            target_model="User",
            target_id=str(user_id),
            old_value={"email": user_email},
        )

        return Response(
            {"message": f"User account {user_email} has been permanently deleted."},
            status=status.HTTP_200_OK,
        )
