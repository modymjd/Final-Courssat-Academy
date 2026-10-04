import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getExamDetails,
  startExam,
  submitExam,
  getInstructorExams,
  createExam,
  updateExam,
  deleteExam,
  getExamAnalytics,
  getStudentExams,
  togglePublishExam,
} from "./api";

export function useExamDetails(examId: number) {
  return useQuery({
    queryKey: ["exam", examId],
    queryFn: () => getExamDetails(examId),
    enabled: examId > 0,
  });
}

export function useStartExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["studentExams"] });
    },
  });
}

export function useSubmitExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitExam,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["studentExams"] });
      queryClient.invalidateQueries({ queryKey: ["studentExamAttempts"] });
      queryClient.invalidateQueries({ queryKey: ["exam", variables.examId] });
      queryClient.invalidateQueries({ queryKey: ["examResult", variables.examId] });
    },
  });
}

export function useInstructorExams() {
  return useQuery({
    queryKey: ["instructorExams"],
    queryFn: () => getInstructorExams(),
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructorExams"] });
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, data }: { examId: number; data: Record<string, unknown> }) =>
      updateExam(examId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instructorExams"] });
      queryClient.invalidateQueries({ queryKey: ["exam", variables.examId] });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructorExams"] });
    },
  });
}

export function useExamAnalytics(examId: number) {
  return useQuery({
    queryKey: ["examAnalytics", examId],
    queryFn: () => getExamAnalytics(examId),
    enabled: !!examId && examId > 0,
  });
}

export function useStudentExams() {
  return useQuery({
    queryKey: ["studentExams"],
    queryFn: getStudentExams,
  });
}

export function useTogglePublishExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, isPublished }: { examId: number; isPublished?: boolean }) =>
      togglePublishExam(examId, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructorExams"] });
    },
  });
}

export function useCourseExams(courseId: number) {
  return useQuery({
    queryKey: ["courseExams", courseId],
    queryFn: () => getInstructorExams({ course: courseId, is_published: true }),
    enabled: courseId > 0,
  });
}

export function useCourseInstructorExams(courseId: number) {
  return useQuery({
    queryKey: ["courseInstructorExams", courseId],
    queryFn: () => getInstructorExams({ course: courseId }),
    enabled: courseId > 0,
  });
}

export function useLessonExams(lessonId: number) {
  return useQuery({
    queryKey: ["lessonExams", lessonId],
    queryFn: () => getInstructorExams({ lesson: lessonId, is_published: true }),
    enabled: lessonId > 0,
  });
}
