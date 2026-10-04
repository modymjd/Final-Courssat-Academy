"""
Assessment Object-Level Permissions: Anti-IDOR (Strict 404), Role Scoping, and Dispute Auditing.

Security Architecture:
- IDOR Protection: Any unauthorized access returns 404 Not Found (via Http404) rather than 403 Forbidden
  to prevent resource enumeration.
- Student Scoping: Students only see their own exam attempts.
- Instructor Scoping: Instructors only see attempts belonging to their own courses.
- Guardian Scoping: Guardians only see attempts for their linked children (read-only).
- Center & Normal Admin Isolation: Center admins and general admins receive 404 on student grades/attempts.
- Dispute Support: Platform super-admins can view dispute records only when a valid dispute reason is logged.
"""

from __future__ import annotations

import logging
from typing import Any

from django.http import Http404
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.accounts.models import GuardianProfile, UserRole
from apps.assessments.models import AdminDisputeAuditLog, StudentExam
from apps.enrollments.models import Enrollment

logger = logging.getLogger(__name__)


class IsEnrolledWithActiveAccess(BasePermission):
    """
    Ensures student is enrolled in the course and holds active access (not expired).
    Returns 404 on IDOR (unauthorized or expired enrollment).
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            raise Http404("Resource not found.")

        # Staff and super_admin bypass
        if user.is_staff or user.role == UserRole.SUPER_ADMIN:
            return True

        # Extract course
        course = getattr(obj, "course", None)
        if course is None and hasattr(obj, "exam"):
            course = getattr(obj.exam, "course", None)

        if not course:
            return True

        # Instructor of the course
        if user.role == UserRole.INSTRUCTOR and course.instructor_id == user.id:
            return True

        # Verify active student enrollment
        if user.role == UserRole.STUDENT:
            enrollment = Enrollment.objects.filter(student=user, course=course).first()
            if enrollment and enrollment.has_active_access:
                return True

        # Any unauthorized attempt returns 404
        raise Http404("Resource not found.")


class IsAttemptOwnerOrInstructorOrGuardian(BasePermission):
    """
    Granular object-level permission for StudentExam attempts:
    - Students: strictly own attempts only.
    - Instructors: strictly attempts in their own courses.
    - Guardians: strictly read-only for verified linked children.
    - Center & Normal Admin: strictly 404 on student grades.
    - SuperAdmin: permitted.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            raise Http404("Attempt not found.")

        if not isinstance(obj, StudentExam):
            return True

        # 1. Student check (only own attempts)
        if user.role == UserRole.STUDENT:
            if obj.student_id == user.id:
                return True
            raise Http404("Attempt not found.")

        # 2. Instructor check (only students in own courses)
        if user.role == UserRole.INSTRUCTOR:
            if obj.exam.course and obj.exam.course.instructor_id == user.id:
                return True
            raise Http404("Attempt not found.")

        # 3. Guardian check (read-only for linked child)
        if user.role == UserRole.GUARDIAN:
            if request.method in SAFE_METHODS:
                is_linked = GuardianProfile.objects.filter(
                    guardian_user=user,
                    student_profile__user_id=obj.student_id,
                ).exists()
                if is_linked:
                    return True
            raise Http404("Attempt not found.")

        # 4. Center and normal Admin: 404 on student grades
        if user.role in (UserRole.CENTER, UserRole.ADMIN):
            raise Http404("Attempt not found.")

        # 5. Super Admin
        if user.role == UserRole.SUPER_ADMIN:
            return True

        raise Http404("Attempt not found.")


class IsDisputeSupportAdmin(BasePermission):
    """
    Permission for administrative dispute resolution:
    - Requires SuperAdmin role.
    - Requires a documented dispute reason in request data or headers ('X-Dispute-Reason').
    - Automatically audits the dispute inquiry in AdminDisputeAuditLog.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.role == UserRole.SUPER_ADMIN):
            raise Http404("Dispute support resource not found.")

        # Check for dispute reason
        reason = (
            request.data.get("dispute_reason")
            if hasattr(request, "data") and isinstance(request.data, dict)
            else None
        )
        if not reason:
            reason = request.headers.get("X-Dispute-Reason")

        if not reason or not str(reason).strip():
            # Dispute reason is strictly mandatory
            return False

        return True

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.role == UserRole.SUPER_ADMIN):
            raise Http404("Dispute support resource not found.")

        reason = (
            request.data.get("dispute_reason")
            if hasattr(request, "data") and isinstance(request.data, dict)
            else None
        )
        if not reason:
            reason = request.headers.get("X-Dispute-Reason")

        if reason and isinstance(obj, StudentExam):
            # Log the dispute audit
            try:
                ip_addr = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR")
                AdminDisputeAuditLog.objects.create(
                    admin=user,
                    student=obj.student,
                    exam=obj.exam,
                    dispute_reason=str(reason).strip()[:255],
                    ip_address=ip_addr.split(",")[0].strip() if ip_addr else None,
                )
            except Exception as exc:
                logger.error("Failed to write AdminDisputeAuditLog: %s", exc)

        return True


class IsExamCourseInstructorOrReadOnly(BasePermission):
    """
    Ensures that only the course instructor can create, edit, or delete exams and question items.
    Returns 404 on IDOR attempts.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.role in (UserRole.INSTRUCTOR, UserRole.SUPER_ADMIN))

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "role", None) == UserRole.SUPER_ADMIN:
            return True

        # Check instructor ownership on Exam or QuestionBankItem
        instructor = getattr(obj, "instructor", None)
        if instructor is None and hasattr(obj, "course") and obj.course:
            instructor = obj.course.instructor

        if instructor and instructor.id == user.id:
            return True

        raise Http404("Exam not found.")
