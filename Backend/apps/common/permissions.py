from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "student")


class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "instructor")


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ("admin", "super_admin"))


class IsSuperAdmin(BasePermission):
    """Requires user to be authenticated, have super_admin role, and 2FA verified claim in JWT."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role != "super_admin":
            return False
        auth = request.auth
        if isinstance(auth, dict):
            return bool(auth.get("is_2fa_verified") is True)
        if hasattr(auth, "get"):
            return bool(auth.get("is_2fa_verified") is True)
        return False


class IsInstructorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("instructor", "admin", "super_admin")
        )


class ReadOnlyOrAuthenticated(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


class IsOwnerOrReadOnly(BasePermission):
    """Object-level: safe methods for anyone authenticated; writes only for the owner or admin."""

    owner_field = "user"

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in ("admin", "super_admin"):
            return True
        owner = getattr(obj, self.owner_field, None)
        return owner == request.user


class IsCourseOwnerOrAdmin(BasePermission):
    """Role gate + object-level ownership check.

    Subclasses override `_owner` to resolve the responsible instructor from
    a Course, Module, or Lesson instance.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("instructor", "admin", "super_admin")
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role in ("admin", "super_admin"):
            return True
        return self._owner(obj) == request.user

    def _owner(self, obj):
        return obj.instructor


class IsModuleCourseOwnerOrAdmin(IsCourseOwnerOrAdmin):
    def _owner(self, obj):
        return obj.course.instructor


class IsLessonCourseOwnerOrAdmin(IsCourseOwnerOrAdmin):
    def _owner(self, obj):
        return obj.module.course.instructor


class IsGuardian(BasePermission):
    """Requires user to have guardian role."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "guardian")


class IsCenterOwner(BasePermission):
    """Requires user to be a center admin or super admin, and enforces object ownership."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role in ("center", "admin", "super_admin")
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role in ("admin", "super_admin"):
            return True
        if hasattr(obj, "user"):
            return obj.user == request.user
        if hasattr(obj, "center") and hasattr(obj.center, "user"):
            return obj.center.user == request.user
        return False


class IsAssociatedGuardian(BasePermission):
    """
    Object-level permission: Grants access to student performance data ONLY if the guardian
    is officially linked to the student via a verified GuardianProfile / National ID.
    """

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role in ("guardian", "admin", "super_admin")
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role in ("admin", "super_admin"):
            return True

        from apps.accounts.models import GuardianProfile

        # Resolve student user from various models
        student_user = None
        if hasattr(obj, "student"):
            student_user = obj.student
        elif hasattr(obj, "user"):
            student_user = obj.user
        elif hasattr(obj, "student_profile"):
            student_user = obj.student_profile.user
        elif hasattr(obj, "student_exam"):
            student_user = obj.student_exam.student

        if not student_user:
            return False

        return GuardianProfile.objects.filter(
            guardian_user=request.user,
            student_profile__user=student_user,
        ).exists()
