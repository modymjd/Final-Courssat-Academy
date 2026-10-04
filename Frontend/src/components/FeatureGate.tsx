import React from "react";
import { useEntitlements } from "@/hooks/useEntitlements";

interface FeatureGateProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * FeatureGate Component
 * Wraps UI blocks, widgets, buttons, or routes and hides/fallbacks gracefully
 * if the user is not entitled to the feature.
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  fallback = null,
  children,
}) => {
  const { isFeatureEnabled, isLoading } = useEntitlements();

  if (isLoading) {
    return <>{children}</>; // Non-blocking hydration fallback
  }

  if (!isFeatureEnabled(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
