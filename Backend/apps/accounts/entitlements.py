from functools import wraps
from typing import Any

from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response

from .models import (
    Feature,
    OrganizationFeatureOverride,
    PlanFeaturePermission,
    RoleFeaturePermission,
    User,
    UserFeatureOverride,
)

CACHE_TTL = 900  # 15 minutes


def resolve_user_entitlements(user: User) -> dict[str, Any]:
    """Resolves all effective feature entitlements and limits for a given user across all 6 layers."""
    if not user.is_authenticated:
        return {}

    cache_key = f"user_entitlements_{user.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch all registered features
    features = Feature.objects.all()
    if not features.exists():
        # Fallback defaults if DB seed not run yet
        default_features = [
            "study_planner",
            "pomodoro_timer",
            "focus_mode",
            "study_journal",
            "notes",
            "bookmarks",
            "certificates",
            "downloads",
            "discussion_boards",
            "calendar",
            "analytics",
            "reports",
            "gamification",
            "xp_system",
            "badges",
            "streaks",
            "shared_notes",
            "study_groups",
            "notifications",
            "motion_enhancements",
        ]
        entitlements = {f: {"is_enabled": True, "limits": {}} for f in default_features}
        cache.set(cache_key, entitlements, 60)
        return entitlements

    # Bulk query overrides and permissions
    user_overrides = {o.feature_id: o for o in UserFeatureOverride.objects.filter(user=user)}
    org_overrides = {}
    if user.organization:
        org_overrides = {
            o.feature_id: o for o in OrganizationFeatureOverride.objects.filter(organization_name=user.organization)
        }

    plan_permissions = {
        p.feature_id: p for p in PlanFeaturePermission.objects.filter(plan_name=user.subscription_plan or "FREE")
    }
    role_permissions = {r.feature_id: r for r in RoleFeaturePermission.objects.filter(role=user.role)}

    resolved: dict[str, Any] = {}

    for feat in features:
        slug = feat.slug
        is_enabled = feat.is_enabled_by_default
        limits: dict[str, Any] = {}

        # Layer 6: Global Default (is_enabled_by_default)

        # Layer 4: Role Permission
        role_perm = role_permissions.get(slug)
        if role_perm:
            is_enabled = role_perm.is_enabled

        # Layer 3: Plan Permission
        plan_perm = plan_permissions.get(slug)
        if plan_perm:
            is_enabled = is_enabled and plan_perm.is_enabled
            if plan_perm.quota_limits:
                limits.update(plan_perm.quota_limits)

        # Layer 2: Organization Override
        org_override = org_overrides.get(slug)
        if org_override:
            is_enabled = org_override.is_enabled
            if org_override.custom_limits:
                limits.update(org_override.custom_limits)

        # Layer 1: User Override (Highest Precedence)
        user_override = user_overrides.get(slug)
        if user_override:
            is_enabled = user_override.is_enabled
            if user_override.custom_limits:
                limits.update(user_override.custom_limits)

        resolved[slug] = {
            "is_enabled": is_enabled,
            "limits": limits,
        }

    cache.set(cache_key, resolved, CACHE_TTL)
    return resolved


def invalidate_user_entitlements(user_id: int):
    """Invalidates the Redis / Django cache for a given user."""
    cache.delete(f"user_entitlements_{user_id}")


def check_feature_access(user: User, feature_slug: str) -> tuple[bool, dict[str, Any]]:
    """Checks whether a specific feature is enabled for the given user."""
    entitlements = resolve_user_entitlements(user)
    feat_data = entitlements.get(feature_slug, {"is_enabled": True, "limits": {}})
    return feat_data["is_enabled"], feat_data["limits"]


def require_feature(feature_slug: str):
    """DRF View decorator to enforce feature entitlement."""

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

            is_enabled, _ = check_feature_access(request.user, feature_slug)
            if not is_enabled:
                return Response(
                    {"detail": f"Feature '{feature_slug}' is not entitled under your current plan or role."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
