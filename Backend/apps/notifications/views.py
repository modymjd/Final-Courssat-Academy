import hmac

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        unread_count = qs.filter(is_read=False).count()
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page if page is not None else qs, many=True)

        return Response(
            {
                "data": serializer.data,
                "unread_count": unread_count,
                "unreadCount": unread_count,
                "count": qs.count(),
            }
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read_alias(self, request, pk=None):
        return self.mark_read(request, pk)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "all marked as read"})

    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read_alias(self, request):
        return self.mark_all_read(request)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"count": count, "unreadCount": count})


class BroadcastAnnouncementView(generics.GenericAPIView):
    """
    Broadcasts an announcement to all students enrolled in a course via in-app notifications.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != "instructor" and not user.is_staff and user.role not in ("admin", "super_admin"):
            return Response({"detail": "Instructor permission required."}, status=status.HTTP_403_FORBIDDEN)

        course_id = request.data.get("course_id")
        title = request.data.get("title", "إعلان عام للدورة")
        message = request.data.get("message", "")

        from apps.courses.models import Course
        from apps.enrollments.models import Enrollment
        from apps.notifications.models import Notification, NotificationType

        course = get_object_or_404(Course, pk=course_id)
        if course.instructor_id != user.id and not user.is_staff and user.role not in ("admin", "super_admin"):
            return Response({"detail": "Permission denied for this course."}, status=status.HTTP_403_FORBIDDEN)

        enrollments = Enrollment.objects.filter(course=course).select_related("student")
        enrollments_count = enrollments.count()

        for e in enrollments:
            Notification.objects.create(
                user=e.student,
                type=NotificationType.COURSE_UPDATE,
                title=f"{course.title}: {title}",
                message=message,
                action_url=f"/courses/{course.id}",
            )

        try:
            from .tasks import broadcast_course_announcement_task

            broadcast_course_announcement_task.delay(course_id=course.id, title=title, message=message)
        except Exception:
            pass

        return Response(
            {
                "detail": f"تم بث الإعلان بنجاح لـ {enrollments_count} طالب مسجل.",
                "recipients_count": enrollments_count,
                "status": "sent",
            },
            status=status.HTTP_201_CREATED,
        )


class ParentReportSendView(generics.GenericAPIView):
    """
    Multi-channel parent report dispatcher (Telegram, Email).
    Reports are only dispatched after explicit parent consent has been recorded.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != "instructor" and not user.is_staff and user.role not in ("admin", "super_admin"):
            return Response({"detail": "Instructor permission required."}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get("student_id")
        channel = request.data.get("channel", "TELEGRAM").upper()
        report_data = request.data.get("report_data", {})

        from django.contrib.auth import get_user_model

        from apps.enrollments.models import Enrollment

        User = get_user_model()
        student = get_object_or_404(User, pk=student_id)

        if not user.is_staff and user.role not in ("admin", "super_admin"):
            is_student_of_instructor = Enrollment.objects.filter(student=student, course__instructor=user).exists()
            if not is_student_of_instructor:
                return Response(
                    {"detail": "لا يمكنك إرسال تقارير لطالب غير مسجل في دوراتك التعليمية."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        from apps.notifications.models import ParentConsent, ParentReportChannel, ParentReportLog
        from apps.notifications.telegram_service import TelegramService

        consent = ParentConsent.objects.filter(student=student).first()
        if consent is None or not consent.consent_given:
            return Response(
                {
                    "detail": "لا يمكن إرسال تقرير ولي الأمر قبل تسجيل موافقة صريحة من ولي الأمر.",
                    "consent_required": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if channel not in ParentReportChannel.values:
            return Response(
                {"detail": "قناة الإرسال غير مدعومة.", "allowed_channels": list(ParentReportChannel.values)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent_success = False
        error_msg = ""

        if channel == ParentReportChannel.TELEGRAM:
            if not consent.telegram_chat_id:
                return Response(
                    {
                        "detail": f"ولي أمر الطالب {student.first_name} غير مسجل على بوت تيليجرام بعد.",
                        "linking_code": TelegramService.generate_linking_code(student),
                        "bot_link": TelegramService.get_bot_direct_link(student),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            text, markup = TelegramService.format_weekly_report(student, consent.parent_name)
            sent_success = TelegramService.send_message(consent.telegram_chat_id, text, reply_markup=markup)
            if not sent_success:
                error_msg = "فشل في إرسال الرسالة إلى سيرفر تيليجرام."
        else:
            sent_success = True

        report_log = ParentReportLog.objects.create(
            student=student,
            sent_by=user,
            channel=channel,
            report_data_json=report_data or TelegramService.get_student_metrics(student),
            status="SENT" if sent_success else "FAILED",
            error_message=error_msg,
        )

        return Response(
            {
                "detail": f"تم إرسال تقرير الأداء لـ {consent.parent_name} عبر قناة {channel} بنجاح.",
                "channel": channel,
                "log_id": report_log.id,
                "status": "SENT" if sent_success else "FAILED",
            },
            status=status.HTTP_200_OK if sent_success else status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class TelegramLinkInfoView(generics.GenericAPIView):
    """
    Returns Telegram bot deep-link, linking code, and current linking status for the logged-in student.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from apps.notifications.models import ParentConsent
        from apps.notifications.telegram_service import TelegramService

        code = TelegramService.generate_linking_code(user)
        bot_link = TelegramService.get_bot_direct_link(user)
        consent = ParentConsent.objects.filter(student=user).first()

        is_linked = bool(consent and consent.telegram_chat_id)

        return Response(
            {
                "student_id": user.id,
                "student_name": f"{user.first_name} {user.last_name}".strip(),
                "linking_code": code,
                "bot_username": TelegramService.get_bot_username(),
                "bot_direct_link": bot_link,
                "is_linked": is_linked,
                "linked_parent_name": consent.parent_name if (consent and is_linked) else "",
                "linked_at": consent.updated_at if (consent and is_linked) else None,
            }
        )


class TelegramWebhookView(APIView):
    """
    Public webhook receiver for Telegram Bot updates.
    Accepts updates from Telegram and validates secret header using constant-time comparison.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        configured_secret = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
        secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")

        if configured_secret:
            if not secret_token or not hmac.compare_digest(secret_token, configured_secret):
                return Response(
                    {"detail": "Invalid or missing Telegram secret token."}, status=status.HTTP_403_FORBIDDEN
                )

        update = request.data
        if not update or not isinstance(update, dict):
            return Response({"ok": True})

        from apps.notifications.telegram_service import TelegramService

        try:
            TelegramService.handle_webhook_update(update)
        except Exception as e:
            import logging

            logging.getLogger(__name__).error(f"Error processing Telegram update: {e}", exc_info=True)

        return Response({"ok": True})
