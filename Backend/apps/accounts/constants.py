"""Centralized constants and path exemptions for authentication & profile completion."""

AUTH_EXEMPT_PATHS = {
    "/api/v1/auth/complete-profile",
    "/api/v1/auth/complete-profile/",
    "/api/v1/auth/google",
    "/api/v1/auth/google/",
    "/api/v1/auth/logout",
    "/api/v1/auth/logout/",
    "/api/v1/auth/login",
    "/api/v1/auth/login/",
    "/api/v1/auth/register",
    "/api/v1/auth/register/",
    "/api/v1/auth/refresh",
    "/api/v1/auth/refresh/",
}

AUTH_EXEMPT_PREFIXES = (
    "/admin",
    "/static",
    "/media",
    "/schema",
    "/docs",
)
