from django.db.models import Avg, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.assessments.models import Exam, Grade, StudentExam
from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification

from .models import GuardianProfile


class GuardianDashboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", "") != "guardian":
            return Response({"detail": "Guardian access required."}, status=status.HTTP_403_FORBIDDEN)

        links = GuardianProfile.objects.filter(
            guardian_user=request.user,
        ).select_related("student_profile__user")

        children = []
        for link in links:
            student = link.student_profile.user
            enrollments = Enrollment.objects.filter(student=student).select_related("course", "course__instructor")
            recent_grades = Grade.objects.filter(student=student).select_related("course").order_by("-graded_at")[:10]
            attempts = (
                StudentExam.objects.filter(student=student)
                .select_related("exam", "exam__course")
                .order_by("-created_at")[:10]
            )

            course_ids = list(enrollments.values_list("course_id", flat=True))
            upcoming_exams = Exam.objects.none()
            if course_ids:
                upcoming_exams = (
                    Exam.objects.filter(course_id__in=course_ids, is_published=True)
                    .filter(
                        Q(start_time__isnull=True) | Q(start_time__gte=timezone.now()),
                        Q(end_time__isnull=True) | Q(end_time__gte=timezone.now()),
                    )
                    .select_related("course")
                    .order_by("start_time", "-created_at")[:10]
                )

            average_grade = Grade.objects.filter(student=student).aggregate(avg=Avg("score"))["avg"] or 0

            children.append(
                {
                    "student": {
                        "id": student.id,
                        "full_name": student.full_name,
                        "email": student.email,
                        "education_level": getattr(student.student_profile, "education_level", ""),
                        "grade_level": getattr(student.student_profile, "grade_level", ""),
                        "school_name": getattr(student.student_profile, "school_name", ""),
                        "university_name": getattr(student.student_profile, "university_name", ""),
                        "faculty_name": getattr(student.student_profile, "faculty_name", ""),
                    },
                    "courses": [
                        {
                            "id": enrollment.course_id,
                            "title": enrollment.course.title,
                            "instructor": enrollment.course.instructor.full_name,
                        }
                        for enrollment in enrollments
                    ],
                    "grades": [
                        {
                            "id": grade.id,
                            "course": grade.course.title,
                            "score": float(grade.score),
                            "max_score": grade.max_score,
                            "percentage": grade.percentage,
                            "feedback": grade.feedback,
                            "graded_at": grade.graded_at,
                        }
                        for grade in recent_grades
                    ],
                    "exam_attempts": [
                        {
                            "id": attempt.id,
                            "exam_id": attempt.exam_id,
                            "exam_title": attempt.exam.title,
                            "course": attempt.exam.course.title if attempt.exam.course else None,
                            "status": attempt.status,
                            "score": float(attempt.score) if attempt.score is not None else None,
                            "started_at": attempt.started_at,
                            "submitted_at": attempt.submitted_at,
                        }
                        for attempt in attempts
                    ],
                    "upcoming_exams": [
                        {
                            "id": exam.id,
                            "title": exam.title,
                            "course_id": exam.course_id,
                            "course_title": exam.course.title if exam.course else None,
                            "start_time": exam.start_time,
                            "end_time": exam.end_time,
                        }
                        for exam in upcoming_exams
                    ],
                    "average_grade": round(float(average_grade), 2),
                }
            )

        notification_qs = Notification.objects.filter(user=request.user).order_by("-created_at")[:10]
        unread_count = Notification.objects.filter(user=request.user, is_read=False).count()

        stats = {
            "children_count": len(children),
            "enrolled_courses": sum(len(child["courses"]) for child in children),
            "upcoming_exams": sum(len(child["upcoming_exams"]) for child in children),
            "unread_notifications": unread_count,
        }

        return Response(
            {
                "children": children,
                "stats": stats,
                "notifications": [
                    {
                        "id": note.id,
                        "title": note.title,
                        "message": note.message,
                        "type": note.type,
                        "is_read": note.is_read,
                        "created_at": note.created_at,
                        "action_url": note.action_url,
                    }
                    for note in notification_qs
                ],
            },
            status=status.HTTP_200_OK,
        )
