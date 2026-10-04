from celery import shared_task
from django.db import transaction

from apps.accounts.models import GuardianProfile
from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification, NotificationType

from .models import Exam


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def notify_exam_audience_task(exam_id: int) -> int:
    exam = Exam.objects.select_related("course").get(pk=exam_id)
    course = exam.course
    if not exam.is_published:
        return 0

    if course is not None:
        student_ids = set(
            Enrollment.objects.filter(course_id=course.id).values_list("student_id", flat=True)
        )
        title = f"اختبار جديد: {exam.title}"
        message = f"تم نشر الاختبار {exam.title} في دورة {course.title}. افتح الاختبار لمعرفة الموعد والتعليمات."
    else:
        from apps.accounts.models import StudentProfile

        matching_students = StudentProfile.objects.all()
        if exam.educational_stage:
            matching_students = matching_students.filter(education_level=exam.educational_stage)
        if exam.educational_grade:
            matching_students = matching_students.filter(grade_level=exam.educational_grade)
        if exam.educational_track:
            matching_students = matching_students.filter(educational_track=exam.educational_track)

        student_ids = set(matching_students.values_list("user_id", flat=True))
        title = f"اختبار جديد: {exam.title}"
        message = f"تم نشر اختبار جديد \"{exam.title}\" مخصص لصفك الدراسي. افتح الاختبار لمعرفة الموعد والتعليمات."

    if not student_ids:
        return 0

    guardian_ids = set(
        GuardianProfile.objects.filter(
            student_profile__user_id__in=student_ids,
            guardian_user__isnull=False,
        ).values_list("guardian_user_id", flat=True)
    )

    action_url = f"/exam/{exam.id}"
    recipients = student_ids | guardian_ids
    notifications = []
    for user_id in recipients:
        notifications.append(
            Notification(
                user_id=user_id,
                type=NotificationType.EXAM,
                title=title,
                message=message,
                action_url=action_url,
            )
        )

    with transaction.atomic():
        created = 0
        for notification in notifications:
            _, was_created = Notification.objects.get_or_create(
                user_id=notification.user_id,
                type=notification.type,
                action_url=notification.action_url,
                defaults={
                    "title": notification.title,
                    "message": notification.message,
                },
            )
            created += int(was_created)

    return created
