import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/http";
import { useAuth } from "@/features/auth";

export interface FeatureEntitlement {
  is_enabled: boolean;
  limits: Record<string, any>;
}

export interface UserEntitlementsResponse {
  user_id: number;
  role: string;
  subscription_plan: string;
  organization: string | null;
  entitlements: Record<string, FeatureEntitlement>;
}

export function useEntitlements() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery<UserEntitlementsResponse>({
    queryKey: ["user-entitlements"],
    queryFn: () => apiGet<UserEntitlementsResponse>("/accounts/entitlements/"),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    enabled: isAuthenticated,
  });

  const isFeatureEnabled = (featureSlug: string): boolean => {
    if (!data?.entitlements) return true; // Default fallback while loading or unauthenticated
    return data.entitlements[featureSlug]?.is_enabled ?? true;
  };

  const getFeatureLimits = (featureSlug: string): Record<string, any> => {
    if (!data?.entitlements) return {};
    return data.entitlements[featureSlug]?.limits ?? {};
  };

  return {
    entitlements: data?.entitlements ?? {},
    userPlan: data?.subscription_plan ?? "FREE",
    userRole: data?.role ?? "student",
    isLoading: isAuthenticated ? isLoading : false,
    error: isAuthenticated ? error : null,
    isFeatureEnabled,
    getFeatureLimits,
  };
}
