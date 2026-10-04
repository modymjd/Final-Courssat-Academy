import { apiGet, apiPost, apiPatch, apiPut, apiDelete, getApiUrl } from "@/lib/http";
import { tokenStore } from "@/lib/tokenStore";
import type {
  Course,
  Category,
  PaginatedResponse,
  VideoAsset,
  LessonSummary,
  Module,
  Lesson,
  InstructorSummary,
  Review,
} from "@/types/course";
import type { Enrollment } from "@/types/enrollment";

type ApiPage<T> = {
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  next?: string | null;
  previous?: string | null;
};

type RawCategory = Category & { course_count?: number };
type RawInstructor = InstructorSummary & {
  student_count?: number;
  course_count?: number;
  review_count?: number;
};
type RawReview = Review & {
  course_id?: number;
  student_id?: number;
  student_name?: string;
  student_avatar?: string | null;
  created_at?: string;
};
type RawLessonSummary = LessonSummary & {
  lesson_id?: number;
  attachment_name?: string;
  attachment_url?: string | null;
  created_at?: string;
  updated_at?: string;
};
type RawVideo = VideoAsset & {
  uploader_id?: number;
  uploader_name?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
};
type RawLesson = Lesson & {
  module_id?: number;
  is_free?: boolean;
  video_id?: number | null;
  video_url?: string;
  video?: RawVideo | null;
  summary?: RawLessonSummary | null;
  last_position_seconds?: number;
  watched_percent?: number;
};
type RawModule = Module & { course_id?: number; lessons?: RawLesson[] };
type RawCourse = Course & {
  short_description?: string;
  is_free?: boolean;
  enforce_quiz_gate?: boolean;
  review_count?: number;
  student_count?: number;
  lesson_count?: number;
  created_at?: string;
  updated_at?: string;
  modules?: RawModule[];
};
type RawCoursePage = ApiPage<RawCourse> | RawCourse[];

function getPageItems<T>(response: ApiPage<T>): T[] {
  return Array.isArray(response.data) ? response.data : [];
}

type CourseApiResponse = RawCourse;

function normalizeCategory(value: RawCategory): Category {
  if (!value || typeof value !== "object") {
    return {
      id: 0,
      name: typeof value === "string" ? value : "عام",
      slug: "",
      icon: "",
      color: "",
      courseCount: 0,
    };
  }
  return {
    id: Number(value.id || 0),
    name: String(value.name || "عام"),
    slug: String(value.slug || ""),
    icon: value.icon ?? "",
    color: value.color ?? "",
    courseCount: Number(value.courseCount ?? value.course_count ?? 0),
  };
}

function normalizeInstructor(value: RawInstructor): InstructorSummary {
  if (!value || typeof value !== "object") {
    return {
      id: 0,
      name: typeof value === "string" ? value : "مدرب معتمد",
      avatar: undefined,
      title: undefined,
      bio: undefined,
      rating: 0,
      studentCount: 0,
      courseCount: 0,
      reviewCount: 0,
    };
  }
  return {
    id: Number(value.id || 0),
    name: String(value.name || (value as any).fullName || (value as any).full_name || "مدرب معتمد"),
    avatar: value.avatar ?? undefined,
    title: value.title ?? undefined,
    bio: typeof value.bio === "string" ? value.bio : undefined,
    rating: Number(value.rating || 0),
    studentCount: Number(value.studentCount ?? value.student_count ?? 0),
    courseCount: Number(value.courseCount ?? value.course_count ?? 0),
    reviewCount: Number(value.reviewCount ?? value.review_count ?? 0),
  };
}

function normalizeVideo(value: RawVideo): VideoAsset {
  return {
    id: value.id,
    title: value.title,
    uploaderId: value.uploaderId ?? value.uploader_id ?? 0,
    uploaderName: value.uploaderName ?? value.uploader_name ?? "",
    status: value.status,
    durationSeconds: value.durationSeconds ?? value.duration_seconds ?? 0,
    fileSizeBytes: value.fileSizeBytes ?? value.file_size_bytes ?? 0,
    resolutions: value.resolutions ?? [],
    errorMessage: value.errorMessage ?? value.error_message,
    createdAt: value.createdAt ?? value.created_at ?? "",
    updatedAt: value.updatedAt ?? value.updated_at ?? "",
  };
}

function normalizeSummary(value: RawLessonSummary): LessonSummary {
  return {
    id: value.id,
    lessonId: value.lessonId ?? value.lesson_id ?? 0,
    content: value.content ?? "",
    attachment: value.attachment,
    attachmentName: value.attachmentName ?? value.attachment_name,
    attachmentUrl: value.attachmentUrl ?? value.attachment_url,
    createdAt: value.createdAt ?? value.created_at ?? "",
    updatedAt: value.updatedAt ?? value.updated_at ?? "",
  };
}

function normalizeLesson(value: RawLesson): Lesson {
  return {
    id: value.id,
    moduleId: value.moduleId ?? value.module_id ?? 0,
    title: value.title,
    type: value.type,
    duration: value.duration ?? "",
    order: value.order,
    isFree: value.isFree ?? value.is_free ?? false,
    videoId: value.videoId ?? value.video_id ?? null,
    video: value.video ? normalizeVideo(value.video) : null,
    videoUrl: value.videoUrl ?? value.video_url,
    content: value.content,
    summary: value.summary ? normalizeSummary(value.summary) : null,
    lastPositionSeconds: value.lastPositionSeconds ?? value.last_position_seconds ?? 0,
    watchedPercent: value.watchedPercent ?? value.watched_percent ?? 0,
    isLocked: value.isLocked ?? (value as any).is_locked ?? false,
    is_locked: (value as any).is_locked ?? value.isLocked ?? false,
    lockReason: value.lockReason ?? (value as any).lock_reason ?? null,
    lock_reason: (value as any).lock_reason ?? value.lockReason ?? null,
    quiz: (value as any).quiz ?? null,
    in_video_checkpoints: (value as any).in_video_checkpoints ?? [],
  };
}

function normalizeModule(value: RawModule): Module {
  return {
    id: value.id,
    courseId: value.courseId ?? value.course_id ?? 0,
    title: value.title,
    order: value.order,
    lessons: Array.isArray(value.lessons) ? value.lessons.map(normalizeLesson) : [],
    unitExam: (value as any).unitExam ?? (value as any).unit_exam ?? null,
    unit_exam: (value as any).unit_exam ?? (value as any).unitExam ?? null,
  };
}

function normalizeReview(value: RawReview): Review {
  return {
    id: value.id,
    courseId: value.courseId ?? value.course_id ?? 0,
    studentId: value.studentId ?? value.student_id ?? 0,
    studentName: value.studentName ?? value.student_name ?? "",
    studentAvatar: value.studentAvatar ?? value.student_avatar ?? undefined,
    rating: value.rating,
    comment: value.comment ?? "",
    createdAt: value.createdAt ?? value.created_at ?? "",
  };
}

function normalizeCourse(value: RawCourse): Course {
  return {
    id: value.id,
    title: value.title,
    description: value.description ?? "",
    shortDescription: value.shortDescription ?? value.short_description ?? "",
    instructor: normalizeInstructor(value.instructor),
    image: value.image ?? "",
    educationalStage: (value.educationalStage ?? (value as any).educational_stage ?? null),
    educationalGrade: (value.educationalGrade ?? (value as any).educational_grade ?? null),
    educationalTrack: (value.educationalTrack ?? (value as any).educational_track ?? null),
    subject: (value.subject ?? (value as any).subject ?? null),
    subjectBranch: (value.subjectBranch ?? (value as any).subject_branch ?? null),
    duration: value.duration ?? "",
    level: value.level,
    category: normalizeCategory(value.category),
    price: Number(value.price ?? 0),
    originalPrice: value.originalPrice,
    discountPercentage: value.discountPercentage,
    isFree: value.isFree ?? value.is_free ?? false,
    enforceQuizGate: value.enforceQuizGate ?? value.enforce_quiz_gate ?? false,
    enforce_quiz_gate: value.enforce_quiz_gate ?? value.enforceQuizGate ?? false,
    rating: Number(value.rating ?? 0),
    reviewCount: value.reviewCount ?? value.review_count ?? 0,
    studentCount: value.studentCount ?? value.student_count ?? 0,
    lessonCount: value.lessonCount ?? value.lesson_count ?? 0,
    status: value.status,
    language: value.language ?? "",
    requirements: Array.isArray(value.requirements) ? value.requirements : [],
    objectives: Array.isArray(value.objectives) ? value.objectives : [],
    videoPreviewUrl: value.videoPreviewUrl,
    targetAudience: value.targetAudience,
    modules: Array.isArray(value.modules) ? value.modules.map(normalizeModule) : undefined,
    reviews: Array.isArray(value.reviews) ? value.reviews.map(normalizeReview) : undefined,
    relatedCourses: value.relatedCourses,
    createdAt: value.createdAt ?? value.created_at ?? "",
    updatedAt: value.updatedAt ?? value.updated_at ?? "",
  };
}

function normalizeCoursePage(response: RawCoursePage): PaginatedResponse<Course> {
  if (Array.isArray(response)) {
    const data = response.map(normalizeCourse);
    return { data, total: data.length, page: 1, pageSize: data.length, totalPages: data.length ? 1 : 0 };
  }

  const rawItems = getPageItems(response);
  const data = rawItems.map(normalizeCourse);
  const pageSize = response.pageSize ?? data.length;
  const total = response.total ?? data.length;
  return {
    data,
    total,
    page: response.page ?? 1,
    pageSize,
    totalPages: response.totalPages ?? (pageSize ? Math.ceil(total / pageSize) : 0),
  };
}

export async function listCourses(params: Record<string, unknown>) {
  return normalizeCoursePage(await apiGet<RawCoursePage>("/courses/", params));
}

export async function getCourse(id: number) {
  return normalizeCourse(await apiGet<CourseApiResponse>(`/courses/${id}/`));
}

export async function createCourse(data: Record<string, unknown>, idempotencyKey?: string) {
  return normalizeCourse(
    await apiPost<RawCourse>(
      "/courses/",
      data,
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
    ),
  );
}

export async function updateCourse(id: number, data: Record<string, unknown>) {
  return normalizeCourse(await apiPatch<RawCourse>(`/courses/${id}/`, data));
}

export async function deleteCourse(id: number) {
  return apiDelete(`/courses/${id}/`);
}

export async function listCategories(params?: Record<string, unknown>) {
  const response = await apiGet<ApiPage<RawCategory> | RawCategory[]>("/categories/", params);
  const items = Array.isArray(response) ? response : getPageItems(response);
  return items.map(normalizeCategory);
}

export async function getCategoryBySlug(slug: string) {
  const category = normalizeCategory(await apiGet<RawCategory>(`/categories/${encodeURIComponent(slug)}/`));
  const courses = await listCourses({ category: category.slug, page: 1, pageSize: 12 });
  return { category, courses };
}

export async function featuredCourses(params?: Record<string, unknown>) {
  const response = await apiGet<RawCoursePage>("/courses/featured/", params);
  return normalizeCoursePage(response).data;
}

export async function getLesson(courseId: number, lessonId: number) {
  return normalizeLesson(await apiGet<RawLesson>(`/courses/${courseId}/lessons/${lessonId}/`));
}

export function normalizeEnrollment(value: any): Enrollment {
  return {
    id: value.id,
    courseId: value.courseId ?? value.course_id ?? value.course?.id ?? 0,
    studentId: value.studentId ?? value.student_id ?? 0,
    course: value.course ? normalizeCourse(value.course) : (value.course as any),
    progress: Number(value.progress ?? 0),
    completedLessonIds: Array.isArray(value.completedLessonIds)
      ? value.completedLessonIds
      : Array.isArray(value.completed_lesson_ids)
      ? value.completed_lesson_ids
      : [],
    completed_lesson_ids: Array.isArray(value.completed_lesson_ids)
      ? value.completed_lesson_ids
      : Array.isArray(value.completedLessonIds)
      ? value.completedLessonIds
      : [],
    lastAccessedAt: value.lastAccessedAt ?? value.last_accessed_at ?? "",
    enrolledAt: value.enrolledAt ?? value.enrolled_at ?? "",
    completedAt: value.completedAt ?? value.completed_at ?? null,
    nextLessonId: value.nextLessonId ?? value.next_lesson_id ?? null,
    nextLessonTitle: value.nextLessonTitle ?? value.next_lesson_title ?? null,
    next_lesson_id: value.next_lesson_id ?? value.nextLessonId ?? null,
    next_lesson_title: value.next_lesson_title ?? value.nextLessonTitle ?? null,
  };
}

export async function enrollCourse(courseId: number) {
  const res = await apiPost<any>("/enrollments/", { course_id: courseId });
  return normalizeEnrollment(res);
}

export async function getEnrollments(params?: Record<string, unknown>) {
  const response = await apiGet<Enrollment[] | ApiPage<Enrollment>>("/enrollments/", params);
  const items = Array.isArray(response) ? response : getPageItems(response);
  return items.map(normalizeEnrollment);
}

export async function completeLesson(enrollmentId: number, lessonId: number) {
  return apiPost<Enrollment>(`/enrollments/${enrollmentId}/complete-lesson/`, { lesson_id: lessonId });
}

export async function createModule(data: { course: number; title: string; order: number }) {
  return apiPost<Module>("/modules/", data);
}

export async function updateModule(id: number, data: { title?: string; order?: number; course?: number }) {
  if (data.order !== undefined && Object.keys(data).length === 1) {
    return apiPost<Module>(`/modules/${id}/reorder/`, { order: data.order });
  }
  return apiPatch<Module>(`/modules/${id}/`, data);
}

export async function deleteModule(id: number) {
  return apiDelete(`/modules/${id}/`);
}

export async function createLesson(data: { module: number; title: string; type: string; duration?: string; order: number; isFree?: boolean; is_published?: boolean; video?: number | null; videoUrl?: string; content?: string }) {
  return apiPost<Lesson>("/lessons/", {
    module: data.module,
    title: data.title,
    type: data.type,
    duration: data.duration,
    order: data.order,
    is_free: data.isFree,
    is_published: data.is_published,
    video: data.video,
    video_url: data.videoUrl,
    content: data.content,
  });
}

export async function updateLesson(id: number, data: Partial<Lesson> & { module?: number; video?: number | null }) {
  const payload: Record<string, unknown> = { ...data };
  if ("moduleId" in payload) {
    payload.module = payload.module ?? payload.moduleId;
    delete payload.moduleId;
  }
  if ("isFree" in payload) {
    payload.is_free = payload.isFree;
    delete payload.isFree;
  }
  if ("videoUrl" in payload) {
    payload.video_url = payload.videoUrl;
    delete payload.videoUrl;
  }
  if ("order" in payload && Object.keys(payload).every((key) => key === "order")) {
    return apiPost<Lesson>(`/lessons/${id}/reorder/`, { order: payload.order });
  }
  return apiPatch<Lesson>(`/lessons/${id}/`, payload);
}

export async function deleteLesson(id: number) {
  return apiDelete(`/lessons/${id}/`);
}

export interface CurriculumSyncLesson {
  id?: number;
  title: string;
  type: "video" | "article" | "quiz" | "assignment";
  duration?: string;
  order: number;
  is_free?: boolean;
}

export interface CurriculumSyncModule {
  id?: number;
  title: string;
  order: number;
  lessons: CurriculumSyncLesson[];
}

export async function syncCourseCurriculum(courseId: number, modules: CurriculumSyncModule[]) {
  return apiPost<{ detail: string }>(`/courses/${courseId}/curriculum/`, { modules });
}

export async function uploadVideoChunk(uploadId: string, chunkIndex: number, totalChunks: number, chunk: Blob) {
  const formData = new FormData();
  formData.append("upload_id", uploadId);
  formData.append("chunk_index", String(chunkIndex));
  formData.append("total_chunks", String(totalChunks));
  formData.append("chunk", chunk, `chunk_${chunkIndex}.part`);

  // Video chunks can legitimately take longer than normal API requests on
  // slower connections. Keep this timeout scoped to the upload endpoint so
  // regular API calls remain protected by the global 25s timeout.
  return apiPost("/videos/upload-chunk/", formData, {
    timeout: 900_000,
    _skipGlobalToast: true,
  });
}

export async function completeVideoUpload(payload: { upload_id: string; title: string; total_chunks: number; file_name: string }) {
  // Final assembly happens on the backend and may need more than the normal
  // API timeout for large uploads.
  return apiPost<VideoAsset>("/videos/upload-complete/", payload, {
    timeout: 900_000,
    _skipGlobalToast: true,
  });
}

export async function getVideo(id: number) {
  return apiGet<VideoAsset>(`/videos/${id}/`);
}

export async function listVideos(params?: Record<string, unknown>) {
  const response = await apiGet<ApiPage<RawVideo> | RawVideo[]>("/videos/", params);
  const items = Array.isArray(response) ? response : getPageItems(response);
  return items.map(normalizeVideo);
}

export async function getSignedStreamUrl(lessonId: number) {
  const response = await apiPost<{
    lessonId?: number;
    lesson_id?: number;
    lessonTitle?: string;
    lesson_title?: string;
    videoId?: number | null;
    video_id?: number | null;
    signedUrl?: string;
    signed_url?: string;
    expiresInSeconds?: number;
    expires_in_seconds?: number;
    expiresAt?: number;
    expires_at?: number;
    streamType?: string;
    stream_type?: string;
  }>(`/lessons/${lessonId}/signed-stream-url/`);

  return {
    lessonId: response.lessonId ?? response.lesson_id ?? lessonId,
    lessonTitle: response.lessonTitle ?? response.lesson_title ?? "",
    videoId: response.videoId ?? response.video_id ?? null,
    signedUrl: response.signedUrl ?? response.signed_url ?? "",
    expiresInSeconds: response.expiresInSeconds ?? response.expires_in_seconds ?? 0,
    expiresAt: response.expiresAt ?? response.expires_at ?? 0,
    streamType: response.streamType ?? response.stream_type ?? "",
  };
}

export async function getLessonSummary(id: number) {
  return normalizeSummary(await apiGet<RawLessonSummary>(`/summaries/${id}/`));
}

export async function createLessonSummary(formData: FormData) {
  return normalizeSummary(await apiPost<RawLessonSummary>("/summaries/", formData));
}

export async function updateLessonSummary(id: number, formData: FormData) {
  return normalizeSummary(await apiPatch<RawLessonSummary>(`/summaries/${id}/`, formData));
}

export async function deleteLessonSummary(id: number) {
  return apiDelete(`/summaries/${id}/`);
}

export interface SubmitReviewPayload {
  rating: number;
  comment?: string;
}

export async function submitCourseReview(courseId: number, payload: SubmitReviewPayload) {
  const res = await apiPost<any>(`/courses/${courseId}/reviews/`, payload);
  return normalizeReview(res);
}

export async function getCourseReviews(courseId: number) {
  const res = await apiGet<any>(`/courses/${courseId}/reviews/`);
  const items = Array.isArray(res) ? res : res?.results || [];
  return items.map(normalizeReview);
}

export async function getInstructorReviews(instructorId: number) {
  const res = await apiGet<any>(`/accounts/instructors/${instructorId}/reviews/`);
  const items = Array.isArray(res) ? res : res?.results || [];
  return items.map(normalizeReview);
}

export async function submitInstructorReview(
  instructorId: number,
  payload: { rating: number; comment?: string; course_id?: number }
) {
  const res = await apiPost<any>(`/accounts/instructors/${instructorId}/reviews/`, payload);
  return normalizeReview(res);
}

export interface LessonProgressResponse {
  status: "ok" | "throttled";
  last_position_seconds: number;
  max_position_seconds: number;
  watched_percent: number;
}

export async function updateLessonProgress(
  lessonId: number,
  payload: { position_seconds: number; final?: boolean }
): Promise<LessonProgressResponse> {
  return apiPut<LessonProgressResponse>(`/lessons/${lessonId}/progress/`, payload, {
    _skipGlobalToast: true,
  });
}

export function sendLessonProgressBeacon(
  lessonId: number,
  positionSeconds: number
): void {
  const token = tokenStore.getAccess();
  if (!token || !lessonId || positionSeconds < 0) return;
  const url = `${getApiUrl()}/lessons/${lessonId}/progress/`;
  try {
    fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        position_seconds: Math.floor(positionSeconds),
        final: true,
      }),
      keepalive: true,
    }).catch(() => {
      // non-blocking degrade
    });
  } catch {
    // ignore
  }
}

export async function recordStudentFileConsent(lessonId?: number): Promise<{ success: boolean; message?: string }> {
  return apiPost("/courses/student-file-consent/", {
    agreed: true,
    lesson_id: lessonId,
  });
}

export async function downloadWatermarkedLessonPdf(
  lessonId: number,
  courseId?: number
): Promise<{ blob: Blob; filename: string }> {
  const token = tokenStore.getAccess();
  const headers: Record<string, string> = {
    Accept: "application/pdf, application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Primary endpoint: /courses/lessons/{id}/watermarked-pdf/
  // Fallback endpoint: /courses/{courseId}/lessons/{id}/download-pdf/
  const primaryUrl = `${getApiUrl()}/courses/lessons/${lessonId}/watermarked-pdf/`;
  const fallbackUrl = courseId
    ? `${getApiUrl()}/courses/${courseId}/lessons/${lessonId}/download-pdf/`
    : `${getApiUrl()}/courses/lessons/${lessonId}/download-pdf/`;

  let response: Response;
  try {
    response = await fetch(primaryUrl, {
      method: "POST",
      headers,
    });
    if (response.status === 404 && primaryUrl !== fallbackUrl) {
      response = await fetch(fallbackUrl, {
        method: "POST",
        headers,
      });
    }
  } catch (err: any) {
    throw new Error(err?.message || "فشل الاتصال بالخادم لتنزيل الملف.");
  }

  if (response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.detail ||
      errorData.message ||
      "لقد تجاوزت الحد المسموح لتنزيل الملفات (5 ملفات خلال 10 دقائق). يرجى الانتظار.";
    const err = new Error(message) as Error & { status: number };
    err.status = 429;
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.detail ||
      errorData.message ||
      "تعذر تنزيل الملف الموسوم بالعلامة المائية.";
    const err = new Error(message) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  let filename = `Lesson_${lessonId}.pdf`;
  const disposition = response.headers.get("Content-Disposition");
  if (disposition && disposition.includes("filename=")) {
    const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, "");
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}


