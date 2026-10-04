import threading

from .models import AuditLog

_thread_locals = threading.local()


def get_current_request():
    """Retrieve the current request from thread-local storage."""
    return getattr(_thread_locals, "request", None)


class AuditLogMiddleware:
    """Middleware to attach client IP and user agent to request, and store in thread local."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "")

        request.client_ip = ip
        request.user_agent = request.META.get("HTTP_USER_AGENT", "")

        _thread_locals.request = request
        try:
            response = self.get_response(request)
        finally:
            _thread_locals.request = None

        return response


SENSITIVE_AUDIT_KEYS = frozenset(
    {
        "password",
        "password_confirm",
        "password1",
        "password2",
        "old_password",
        "new_password",
        "token",
        "refresh",
        "access",
        "secret",
        "api_key",
        "secret_token",
        "totp_secret",
        "code_provided",
    }
)


def _sanitize_audit_dict(data):
    if not isinstance(data, dict):
        return data
    sanitized = {}
    for k, v in data.items():
        if any(sens in k.lower() for sens in ("password", "secret", "token", "key", "credential", "auth")):
            sanitized[k] = "******"
        elif isinstance(v, dict):
            sanitized[k] = _sanitize_audit_dict(v)
        elif isinstance(v, list):
            sanitized[k] = [_sanitize_audit_dict(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized


def log_audit_event(
    action_type: str,
    target_model: str,
    target_id: str = "",
    old_value: dict | None = None,
    new_value: dict | None = None,
    user=None,
    request=None,
):
    """Helper function to log an action in AuditLog safely with recursive secret masking."""
    req = request or get_current_request()
    actor = user or (req.user if req and getattr(req, "user", None) and req.user.is_authenticated else None)
    ip_address = getattr(req, "client_ip", None) if req else None
    user_agent = getattr(req, "user_agent", "") if req else ""

    clean_old = _sanitize_audit_dict(old_value) if old_value else {}
    clean_new = _sanitize_audit_dict(new_value) if new_value else {}

    return AuditLog.objects.create(
        actor=actor,
        action_type=action_type,
        target_model=target_model,
        target_id=str(target_id),
        old_value=clean_old,
        new_value=clean_new,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def _camel_to_snake(name: str) -> str:
    import re
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


class QueryParamSnakeCaseMiddleware:
    """
    Middleware that transparently converts camelCase query parameters into snake_case
    so that django-filter and standard Django querysets can read them regardless of client casing.
    e.g. ?educationalStage=secondary&isFree=true -> educational_stage, is_free
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.GET:
            new_get = request.GET.copy()
            modified = False
            for key in list(request.GET.keys()):
                snake_key = _camel_to_snake(key)
                if snake_key != key and snake_key not in new_get:
                    new_get.setlist(snake_key, request.GET.getlist(key))
                    modified = True
            if modified:
                new_get._mutable = False
                request.GET = new_get
        return self.get_response(request)


class SecurityNoCacheApiMiddleware:
    """
    Middleware that strictly enforces no-store, no-cache, and private cache-control
    headers on authenticated and user-sensitive API routes, preventing client or intermediate
    proxy cache pollution across different accounts on the same machine.
    """

    NO_CACHE_PREFIXES = (
        "/api/v1/enrollments/",
        "/api/v1/accounts/",
        "/api/v1/auth/",
        "/api/v1/dashboard/",
        "/api/v1/finance/",
        "/api/v1/notifications/",
        "/api/v1/assessments/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path
        if any(path.startswith(prefix) for prefix in self.NO_CACHE_PREFIXES) or (
            path.startswith("/api/v1/") and getattr(request, "user", None) and request.user.is_authenticated
        ):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, private, max-age=0"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        return response

