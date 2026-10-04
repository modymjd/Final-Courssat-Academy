import { useQuery } from "@tanstack/react-query";
import { getGuardianDashboard } from "./api";

export const GUARDIAN_DASHBOARD_QUERY_KEY = ["guardian-dashboard"] as const;

export function useGuardianDashboard() {
  return useQuery({
    queryKey: GUARDIAN_DASHBOARD_QUERY_KEY,
    queryFn: getGuardianDashboard,
    staleTime: 30_000,
  });
}
