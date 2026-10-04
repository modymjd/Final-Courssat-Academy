import { useQuery } from "@tanstack/react-query";
import { getStudentDashboard, getInstructorDashboard, getAdminDashboard } from "./api";
import type { StudentDashboardData } from "./api";

import { apiGet } from "@/lib/http";
import { getStudentExams } from "@/features/exams/api";

import { useAuth } from "@/features/auth";

export function useStudentDashboard() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard', 'student', user?.id],
    queryFn: async () => {
      const [dashboardData, summaryData, studentAttempts, publishedExams] = await Promise.all([
        getStudentDashboard().catch(() => ({})),
        apiGet<any>("/analytics/student/summary/").catch(() => ({})),
        getStudentExams().catch(() => ({ results: [] })),
        apiGet<any>("/exams/").catch(() => ({ results: [] })),
      ]);
      return {
        ...dashboardData,
        summary: summaryData,
        exams: studentAttempts,
        publishedExams: publishedExams,
      } as StudentDashboardData & {
        summary: any;
        exams: Record<string, unknown>[];
        publishedExams: any;
      };
    },
    enabled: isAuthenticated && !!user?.id,
  });
}

export function useInstructorDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'instructor'],
    queryFn: getInstructorDashboard,
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: getAdminDashboard,
  });
}
