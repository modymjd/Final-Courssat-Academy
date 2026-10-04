import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInstructorDailyBrief,
  getAcademicTasks,
  getKanbanTasks,
  createAcademicTask,
  updateAcademicTask,
  deleteAcademicTask,
  getInstructorStudents,
  removeStudentEnrollment,
  getInstructorEarnings,
  getInstructorCoupons,
  createInstructorCoupon,
  getInstructorPayouts,
  createInstructorPayout,
  getCourseAnalytics,
  getInstructorPrivateStudents,
} from "./academicToolsApi";

import type { InstructorDailyBrief, AcademicTask, KanbanTasksResponse } from "@/types";

export const DAILY_BRIEF_QUERY_KEY = ["instructor-daily-brief"];
export const TASKS_QUERY_KEY = ["academic-tasks"];
export const KANBAN_TASKS_QUERY_KEY = ["academic-tasks-kanban"];

export function useInstructorDailyBrief() {
  return useQuery<InstructorDailyBrief | null>({
    queryKey: DAILY_BRIEF_QUERY_KEY,
    queryFn: getInstructorDailyBrief,
  });
}

export function useAcademicTasks() {
  return useQuery<AcademicTask[]>({
    queryKey: TASKS_QUERY_KEY,
    queryFn: getAcademicTasks,
  });
}

export function useKanbanTasks() {
  return useQuery<KanbanTasksResponse>({
    queryKey: KANBAN_TASKS_QUERY_KEY,
    queryFn: getKanbanTasks,
  });
}

export function useCreateAcademicTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAcademicTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KANBAN_TASKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DAILY_BRIEF_QUERY_KEY });
    },
  });
}

export function useUpdateAcademicTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateAcademicTask>[1] }) =>
      updateAcademicTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KANBAN_TASKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DAILY_BRIEF_QUERY_KEY });
    },
  });
}

export function useDeleteAcademicTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAcademicTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KANBAN_TASKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DAILY_BRIEF_QUERY_KEY });
    },
  });
}

// Phase 2 Hooks

export const INSTRUCTOR_STUDENTS_QUERY_KEY = ["instructor-students"];
export const INSTRUCTOR_EARNINGS_QUERY_KEY = ["instructor-earnings"];
export const INSTRUCTOR_COUPONS_QUERY_KEY = ["instructor-coupons"];
export const INSTRUCTOR_PAYOUTS_QUERY_KEY = ["instructor-payouts"];
export const COURSE_ANALYTICS_QUERY_KEY = ["course-analytics"];

export function useInstructorStudents(params?: { course_id?: number; search?: string }) {
  return useQuery({
    queryKey: [...INSTRUCTOR_STUDENTS_QUERY_KEY, params?.course_id, params?.search],
    queryFn: () => getInstructorStudents(params),
  });
}

export function useInstructorPrivateStudents() {
  return useQuery({
    queryKey: ["instructor-private-students"],
    queryFn: () => getInstructorPrivateStudents(),
  });
}

export function useRemoveStudentEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeStudentEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTRUCTOR_STUDENTS_QUERY_KEY });
    },
  });
}

export function useInstructorEarnings() {
  return useQuery({
    queryKey: INSTRUCTOR_EARNINGS_QUERY_KEY,
    queryFn: getInstructorEarnings,
  });
}

export function useInstructorCoupons() {
  return useQuery({
    queryKey: INSTRUCTOR_COUPONS_QUERY_KEY,
    queryFn: getInstructorCoupons,
  });
}

export function useCreateInstructorCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInstructorCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTRUCTOR_COUPONS_QUERY_KEY });
    },
  });
}

export function usePayouts() {
  const queryClient = useQueryClient();
  const payoutsQuery = useQuery({
    queryKey: INSTRUCTOR_PAYOUTS_QUERY_KEY,
    queryFn: getInstructorPayouts,
  });

  const requestPayoutMutation = useMutation({
    mutationFn: createInstructorPayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTRUCTOR_PAYOUTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INSTRUCTOR_EARNINGS_QUERY_KEY });
    },
  });

  return {
    payouts: payoutsQuery.data ?? [],
    isLoadingPayouts: payoutsQuery.isLoading,
    refetchPayouts: payoutsQuery.refetch,
    requestPayout: requestPayoutMutation.mutateAsync,
    isRequestingPayout: requestPayoutMutation.isPending,
  };
}

export function useCourseAnalytics(courseId: number) {
  return useQuery({
    queryKey: [...COURSE_ANALYTICS_QUERY_KEY, courseId],
    queryFn: () => getCourseAnalytics(courseId),
    enabled: !!courseId,
  });
}
