from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication


class SingleActiveDeviceMiddleware:
    """
    Enforces a strict Single Active Device Policy for student & instructor accounts.
    If a user logs in from a new device/browser, their active_device_id updates on the server.
    Any request using an outdated JWT containing a mismatched device_id claim is instantly terminated.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_authenticator = JWTAuthentication()

    def __call__(self, request):
        # Exclude public and auth endpoints
        path = request.path
        if path.startswith("/api/v1/auth/") or path.startswith("/api/docs/") or path.startswith("/api/schema/"):
            return self.get_response(request)

        # Attempt to inspect JWT token if present in headers
        auth_header = request.META.get("HTTP_AUTHORIZATION")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                auth_result = self.jwt_authenticator.authenticate(request)
                if auth_result is not None:
                    user, token = auth_result
                    # If user has an active_device_id configured and token has device_id claim
                    token_device_id = token.get("device_id")
                    if token_device_id and user.active_device_id:
                        if token_device_id != user.active_device_id:
                            return JsonResponse(
                                {
                                    "error": {
                                        "status": 401,
                                        "detail": "تم تسجيل الدخول بحسابك من جهاز آخر. تم إنهاء الجلسة الحالية تلقائياً لحماية خصوصيتك.",
                                        "error_code": "SESSION_TERMINATED_CONCURRENT_LOGIN",
                                    }
                                },
                                status=401,
                            )
            except Exception:
                # Let DRF default authentication handlers handle expired/malformed tokens
                pass

        return self.get_response(request)


class ProfileCompletionMiddleware:
    """
    Middleware ensuring that users with incomplete profiles are guided to complete them.
    Exempts authentication, API documentation, schema, and profile completion endpoints.
    """

    EXEMPT_PATHS = (
        "/api/v1/auth/login/",
        "/api/v1/auth/register/",
        "/api/v1/auth/google/",
        "/api/v1/auth/refresh/",
        "/api/v1/auth/logout/",
        "/api/v1/auth/complete-profile/",
        "/api/v1/auth/profile/complete/",
        "/api/docs/",
        "/api/schema/",
        "/admin/",
        "/static/",
        "/media/",
    )

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_authenticator = JWTAuthentication()

    def __call__(self, request):
        path = request.path

        # The frontend must be able to read the authenticated user's state before
        # profile completion so it can route the user to /complete-profile.
        # Do not exempt PATCH/PUT/DELETE: incomplete users must remain blocked
        # from normal profile-protected API access.
        if request.method == "GET" and path in {"/api/v1/accounts/me", "/api/v1/accounts/me/"}:
            return self.get_response(request)

        if any(path.startswith(prefix) for prefix in self.EXEMPT_PATHS):
            return self.get_response(request)

        auth_header = request.META.get("HTTP_AUTHORIZATION")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                auth_result = self.jwt_authenticator.authenticate(request)
                if auth_result is not None:
                    user, _ = auth_result
                    if not getattr(user, "profile_completed", True):
                        return JsonResponse(
                            {
                                "error": {
                                    "status": 403,
                                    "detail": "Profile is incomplete. Please complete your profile.",
                                    "error_code": "PROFILE_INCOMPLETE",
                                    "redirect_url": "/api/v1/auth/complete-profile/",
                                }
                            },
                            status=403,
                        )
            except Exception:
                pass

        return self.get_response(request)
