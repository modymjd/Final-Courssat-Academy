import logging

from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.notifications.models import ParentConsent, ParentReportLog

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task
def send_weekly_parent_reports_task():
    """
    Celery Beat task scheduled every Sunday at 08:00 PM.
    Iterates over active parent consent records and dispatches weekly progress summaries via Telegram.
    """
    logger.info("Starting weekly automated Telegram parent reports dispatch task...")
    from apps.notifications.models import ParentReportChannel
    from apps.notifications.telegram_service import TelegramService

    consents = ParentConsent.objects.filter(consent_given=True).exclude(telegram_chat_id="").select_related("student")
    sent_count = 0
    failed_count = 0

    for consent in consents:
        student = consent.student
        try:
            text, markup = TelegramService.format_weekly_report(student, consent.parent_name)
            success = TelegramService.send_message(consent.telegram_chat_id, text, reply_markup=markup)

            ParentReportLog.objects.create(
                student=student,
                sent_by=student,
                channel=ParentReportChannel.TELEGRAM,
                report_data_json=TelegramService.get_student_metrics(student),
                status="SENT" if success else "FAILED",
                error_message="" if success else "Failed to deliver via Telegram API",
            )
            if success:
                sent_count += 1
            else:
                failed_count += 1
        except Exception as e:
            logger.error(f"Failed to send weekly Telegram report for student {student.id}: {e}", exc_info=True)
            failed_count += 1

    logger.info(f"Completed weekly parent reports dispatch. Sent: {sent_count}, Failed: {failed_count}")
    return {"sent": sent_count, "failed": failed_count}


@shared_task
def send_telegram_exam_alert_task(student_exam_id: int):
    """
    Asynchronous task to deliver instant Telegram alert to parent when an exam is graded/submitted.
    """
    from apps.notifications.telegram_service import TelegramService

    try:
        return TelegramService.send_exam_graded_alert(student_exam_id)
    except Exception as e:
        logger.error(f"Error in send_telegram_exam_alert_task for exam #{student_exam_id}: {e}", exc_info=True)
        return False


@shared_task
def send_telegram_certificate_alert_task(certificate_id: int):
    """
    Asynchronous task to deliver instant celebration alert to parent when a course certificate is issued.
    """
    from apps.notifications.telegram_service import TelegramService

    try:
        return TelegramService.send_certificate_earned_alert(certificate_id)
    except Exception as e:
        logger.error(f"Error in send_telegram_certificate_alert_task for cert #{certificate_id}: {e}", exc_info=True)
        return False


@shared_task
def evaluate_at_risk_students_task():
    """
    Celery Beat task scheduled daily at 02:00 AM.
    Evaluates student inactivity and updates/creates idempotent AT_RISK_ALERT tasks for instructors.
    """
    logger.info("Starting daily idempotent at-risk student evaluation task...")
    from apps.academic_tools.models import AcademicTask
    from apps.enrollments.models import Enrollment

    # Find inactive student enrollments
    cutoff = timezone.now() - timezone.timedelta(days=7)
    at_risk_enrollments = Enrollment.objects.filter(last_accessed_at__lt=cutoff).select_related(
        "course", "course__instructor", "student"
    )

    updated_tasks = 0
    created_tasks = 0

    for enrollment in at_risk_enrollments:
        instructor = enrollment.course.instructor
        student = enrollment.student

        # Idempotent check: update existing pending AT_RISK_ALERT task or create new one
        existing_task = AcademicTask.objects.filter(
            user=instructor,
            student=student,
            course=enrollment.course,
            task_type="AT_RISK_ALERT",
            status__in=["PENDING", "IN_PROGRESS"],
        ).first()

        if existing_task:
            existing_task.description = f"الطالب {student.first_name} لم يسجل دخول منذ {cutoff.strftime('%Y-%m-%d')} في دورة {enrollment.course.title}."
            existing_task.priority = "HIGH"
            existing_task.save(update_fields=["description", "priority", "updated_at"])
            updated_tasks += 1
        else:
            AcademicTask.objects.create(
                user=instructor,
                student=student,
                course=enrollment.course,
                task_type="AT_RISK_ALERT",
                title=f"تنبيه طالب متعثر: {student.first_name}",
                description=f"الطالب {student.first_name} غائب عن الدورة منذ أكثر من 7 أيام.",
                priority="HIGH",
                status="PENDING",
            )
            created_tasks += 1

    logger.info(f"Completed at-risk evaluation. Created: {created_tasks}, Updated: {updated_tasks}")
    return {"created": created_tasks, "updated": updated_tasks}


@shared_task
def broadcast_course_announcement_task(course_id: int, title: str, message: str):
    """
    Asynchronously broadcasts an announcement to all students enrolled in a course.
    """
    from apps.courses.models import Course
    from apps.enrollments.models import Enrollment
    from apps.notifications.models import Notification, NotificationType

    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        logger.error(f"Course #{course_id} not found for broadcast announcement.")
        return 0

    student_ids = list(Enrollment.objects.filter(course=course).values_list("student_id", flat=True))
    notifications_to_create = [
        Notification(
            user_id=student_id,
            type=NotificationType.COURSE_UPDATE,
            title=title or f"إعلان: {course.title}",
            message=message,
            action_url=f"/course/{course.id}",
        )
        for student_id in student_ids
    ]
    if notifications_to_create:
        Notification.objects.bulk_create(notifications_to_create, batch_size=500)
    logger.info(f"Broadcast announcement sent to {len(notifications_to_create)} students for course #{course_id}")
    return len(notifications_to_create)
