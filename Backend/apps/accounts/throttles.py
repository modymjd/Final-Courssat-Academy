from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Restricts brute-force authentication attacks on login endpoints."""

    scope = "auth_login"
    rate = "5/min"


class RegistrationRateThrottle(AnonRateThrottle):
    """Restricts automated bot registration spam."""

    scope = "auth_register"
    rate = "3/min"


class VideoStreamRateThrottle(UserRateThrottle):
    """Restricts high-frequency video stream token generation to prevent abuse."""

    scope = "video_stream"
    rate = "20/min"


class PasswordResetRateThrottle(SimpleRateThrottle):
    """Restricts password reset spam by target email or IP."""

    scope = "password_reset"
    rate = "3/hour"

    def get_cache_key(self, request, view):
        email = request.data.get("email") if hasattr(request, "data") else None
        if email:
            ident = str(email).strip().lower()
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class FinalProgressRateThrottle(UserRateThrottle):
    """Restricts high-frequency final:true progress updates (20/min per user)."""

    scope = "final_progress"
    rate = "20/min"

    def allow_request(self, request, view):
        if request.method == "PUT" and isinstance(request.data, dict) and bool(request.data.get("final")):
            return super().allow_request(request, view)
        return True


class NotesWriteRateThrottle(UserRateThrottle):
    """Restricts high-frequency student note write operations (60/min per user)."""

    scope = "notes_write"
    rate = "60/min"

    def allow_request(self, request, view):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            return super().allow_request(request, view)
        return True


class NotesBulkImportRateThrottle(UserRateThrottle):
    """Restricts bulk note imports (5/hour per user)."""

    scope = "notes_import"
    rate = "5/hour"
