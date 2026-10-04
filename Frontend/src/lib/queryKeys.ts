/**
 * Centralized query keys factory for React Query.
 * Ensure consistency and ease of invalidation.
 */

export const qk = {
  auth: {
    me: ["auth", "me"] as const,
  },
  courses: {
    all: ["courses", "all"] as const,
    list: (filters: Record<string, unknown>, page: number, pageSize: number) =>
      ["courses", "list", filters, page, pageSize] as const,
    detail: (id: number) => ["courses", "detail", id] as const,
    featured: ["courses", "featured"] as const,
    lesson: (userId: number | string | undefined, courseId: number, lessonId: number) =>
      ["courses", "lesson", userId ?? "guest", courseId, lessonId] as const,
    signedStreamUrl: (userId: number | string | undefined, lessonId: number) =>
      ["courses", "streamUrl", userId ?? "guest", lessonId] as const,
  },
  categories: {
    all: ["categories", "all"] as const,
    detail: (slug: string) => ["categories", "detail", slug] as const,
  },
  dashboard: {
    student: (userId?: number | string) => ["dashboard", "student", userId ?? "guest"] as const,
    instructor: ["dashboard", "instructor"] as const,
    admin: ["dashboard", "admin"] as const,
  },
  notifications: {
    all: (userId?: number | string) => ["notifications", "all", userId ?? "guest"] as const,
    unreadCount: (userId?: number | string) => ["notifications", "unreadCount", userId ?? "guest"] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
    mine: (userId?: number | string) => ["enrollments", "mine", userId ?? "guest"] as const,
    course: (userId: number | string | undefined, courseId: number) =>
      ["enrollments", "course", userId ?? "guest", courseId] as const,
  },
  users: {
    list: (params: Record<string, unknown>) => ["users", "list", params] as const,
    detail: (id: number) => ["users", "detail", id] as const,
  },
};
