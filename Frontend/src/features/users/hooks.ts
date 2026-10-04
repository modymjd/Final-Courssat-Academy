import { useQuery } from "@tanstack/react-query";
import { getInstructors, getInstructorProfile } from "./api";

export function useInstructors(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["instructors", params],
    queryFn: () => getInstructors(params),
    staleTime: 1000 * 60 * 2, // 2 minutes staleTime
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60 * 5, // 5 minutes background refetch
  });
}

export function useInstructorProfile(id: number) {
  return useQuery({
    queryKey: ['instructorProfile', id],
    queryFn: () => getInstructorProfile(id),
    enabled: id > 0,
  });
}
