from rest_framework import permissions

from .constants import AUTH_EXEMPT_PATHS, AUTH_EXEMPT_PREFIXES


class IsProfileCompleted(permissions.BasePermission):
    """
    Custom permission that blocks authenticated users with profile_completed == False
    from accessing endpoints unless the view explicitly allows incomplete profiles or
    the path is an allowed authentication endpoint.
    """

    message = "يرجى إكمال بيانات حسابك أولاً قبل الوصول لهذه الخدمة."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return True

        # Check if view explicitly permits incomplete profiles
        if getattr(view, "allow_incomplete_profile", False):
            return True

        # The current-user read endpoint is required to establish authenticated
        # frontend state, including for users who still need to complete their profile.
        # Keep write access protected by the normal profile-completion gate.
        path = request.path
        if request.method == "GET" and path in {"/api/v1/accounts/me", "/api/v1/accounts/me/"}:
            return True

        # Check exact whitelisted authentication paths
        if path in AUTH_EXEMPT_PATHS or any(path.startswith(prefix) for prefix in AUTH_EXEMPT_PREFIXES):
            return True

        # Superusers and staff are exempt
        if request.user.is_superuser or request.user.is_staff:
            return True

        return getattr(request.user, "profile_completed", True)
