import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  listCategories,
  getCategoryBySlug,
  featuredCourses,
  enrollCourse,
  getEnrollments,
  completeLesson,
  getLesson,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadVideoChunk,
  completeVideoUpload,
  getVideo,
  listVideos,
  getSignedStreamUrl,
  getLessonSummary,
  createLessonSummary,
  updateLessonSummary,
  deleteLessonSummary,
  submitCourseReview,
  getCourseReviews,
  getInstructorReviews,
  submitInstructorReview,
  updateLessonProgress,
  sendLessonProgressBeacon,
} from "./api";
import type { Lesson } from "@/types/course";


export function useCourses(filters: Record<string, unknown>, page = 1, pageSize = 12) {
  return useQuery({
    queryKey: qk.courses.list(filters, page, pageSize),
    queryFn: () => listCourses({ ...filters, page, pageSize }),
  });
}

export function useCourse(id: number) {
  return useQuery({
    queryKey: qk.courses.detail(id),
    queryFn: () => getCourse(id),
    enabled: id > 0,
  });
}

export function useCategories(params?: { sort?: string; limit?: number }) {
  const categoryParams = { ...(params ?? {}), _v: "2" };

  return useQuery({
    queryKey: [...qk.categories.all, categoryParams],
    queryFn: () => listCategories(categoryParams),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCategoryDetail(slug: string) {
  return useQuery({
    queryKey: qk.categories.detail(slug),
    queryFn: () => getCategoryBySlug(slug),
    enabled: !!slug,
  });
}

export function useFeaturedCourses(params?: { sort?: string; limit?: number }) {
  return useQuery({
    queryKey: [...qk.courses.featured, params],
    queryFn: () => featuredCourses(params),
  });
}

import { useAuth } from "@/features/auth";

export function useLesson(courseId: number, lessonId: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.courses.lesson(user?.id, courseId, lessonId),
    queryFn: () => getLesson(courseId, lessonId),
    enabled: courseId > 0 && lessonId > 0,
  });
}

export function useEnrollments() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: qk.enrollments.mine(user?.id),
    queryFn: getEnrollments,
    enabled: isAuthenticated && !!user?.id,
  });
}

export function useCourseEnrollment(courseId: number) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: qk.enrollments.course(user?.id, courseId),
    queryFn: async () => {
      if (!isAuthenticated || !user?.id) return null;
      const enrollments = await getEnrollments({ course_id: courseId, course: courseId });
      const list = Array.isArray(enrollments) ? enrollments : (enrollments as any)?.results || (enrollments as any)?.data || [];
      return list.find((e: any) => e.courseId === courseId || e.course?.id === courseId || e.course === courseId) || null;
    },
    enabled: !!courseId && isAuthenticated && !!user?.id,
  });
}

// ==================== Video Hooks ====================
export function useVideos(params?: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ["videos", params],
    queryFn: () => listVideos(params),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useVideo(id: number, enabled = true) {
  return useQuery({
    queryKey: ["video", id],
    queryFn: () => getVideo(id),
    enabled: enabled && id > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

export function useSignedStreamUrl(lessonId: number, enabled = true) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: qk.courses.signedStreamUrl(user?.id, lessonId),
    queryFn: () => getSignedStreamUrl(lessonId),
    enabled: enabled && lessonId > 0 && isAuthenticated && !!user?.id,
    staleTime: 1000 * 60 * 30, // 30 minutes, strictly scoped to user
  });
}

export function useUploadVideoChunk() {
  return useMutation({
    mutationFn: ({ uploadId, chunkIndex, totalChunks, chunk }: { uploadId: string; chunkIndex: number; totalChunks: number; chunk: Blob }) =>
      uploadVideoChunk(uploadId, chunkIndex, totalChunks, chunk),
  });
}

export function useCompleteVideoUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeVideoUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

// ==================== Course, Module, Lesson Mutations ====================
export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: Record<string, unknown>;
      idempotencyKey?: string;
    }) => createCourse(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.courses.all });
    },
  });
}

export function useUpdateCourse(courseId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCourse(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
      queryClient.invalidateQueries({ queryKey: qk.courses.all });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.courses.all });
    },
  });
}

export function useCreateModule(courseId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createModule,
    onSuccess: (_data, variables) => {
      const targetCourseId = courseId ?? variables.course;
      if (targetCourseId) {
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(targetCourseId) });
      }
    },
  });
}

export function useUpdateModule(courseId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; order?: number } }) => updateModule(id, data),
    onSuccess: () => {
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
      }
    },
  });
}

export function useDeleteModule(courseId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteModule,
    onSuccess: () => {
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
      }
    },
  });
}

export function useCreateLesson(courseId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLesson,
    onSuccess: () => {
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
      }
    },
  });
}

export function useUpdateLesson(courseId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Lesson> & { module?: number; video?: number | null } }) => updateLesson(id, data),
    onSuccess: () => {
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
      }
    },
  });
}

export function useDeleteLesson(courseId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => {
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: qk.courses.detail(courseId) });
      }
    },
  });
}

export function useGetLessonSummary(lessonId: number, enabled = true) {
  return useQuery({
    queryKey: ["lesson-summary", lessonId],
    queryFn: () => getLessonSummary(lessonId),
    enabled: enabled && lessonId > 0,
  });
}

export function useCreateLessonSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLessonSummary,
    onSuccess: (_data, formData) => {
      const lessonId = Number(formData.get("lesson"));
      if (Number.isFinite(lessonId) && lessonId > 0) {
        queryClient.invalidateQueries({ queryKey: ["lesson-summary", lessonId] });
      }
      queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}

export function useUpdateLessonSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
      updateLessonSummary(id, formData),
    onSuccess: (_data, variables) => {
      const lessonId = Number(variables.formData.get("lesson"));
      if (Number.isFinite(lessonId) && lessonId > 0) {
        queryClient.invalidateQueries({ queryKey: ["lesson-summary", lessonId] });
      }
      queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}

export function useDeleteLessonSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLessonSummary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-summary"] });
      queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}

export function useEnrollCourse() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (courseId: number) => enrollCourse(courseId),
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: qk.enrollments.all });
      queryClient.invalidateQueries({ queryKey: qk.enrollments.mine(user?.id) });
      queryClient.invalidateQueries({ queryKey: qk.enrollments.course(user?.id, courseId) });
      queryClient.invalidateQueries({ queryKey: ["course-enrollment", courseId] });
    },
  });
}

export function useSubmitCourseReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, data }: { courseId: number; data: { rating: number; comment?: string } }) =>
      submitCourseReview(courseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.courses.detail(variables.courseId) });
      queryClient.invalidateQueries({ queryKey: ["courseReviews", variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ["course", variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ["public-instructors"] });
    },
  });
}

export function useCourseReviews(courseId: number) {
  return useQuery({
    queryKey: ["courseReviews", courseId],
    queryFn: () => getCourseReviews(courseId),
    enabled: courseId > 0,
  });
}

export function useInstructorReviews(instructorId: number) {
  return useQuery({
    queryKey: ["instructorReviews", instructorId],
    queryFn: () => getInstructorReviews(instructorId),
    enabled: instructorId > 0,
  });
}

export function useSubmitInstructorReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      data,
    }: {
      instructorId: number;
      data: { rating: number; comment?: string; course_id?: number };
    }) => submitInstructorReview(instructorId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instructorReviews", variables.instructorId] });
      queryClient.invalidateQueries({ queryKey: ["instructorProfile", variables.instructorId] });
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
    },
  });
}

export function useUpdateLessonProgress() {
  return useMutation({
    mutationFn: ({
      lessonId,
      positionSeconds,
      final,
    }: {
      lessonId: number;
      positionSeconds: number;
      final?: boolean;
    }) => updateLessonProgress(lessonId, { position_seconds: positionSeconds, final }),
  });
}

export { enrollCourse, updateLessonProgress, sendLessonProgressBeacon };


