export const APP_NAME = "Coursat";
export const APP_DESCRIPTION = "منصة التعليم الإلكتروني";

export const ROUTES = {
  HOME: "/",
  COURSES: "/courses",
  COURSE_DETAIL: "/course/:id",
  LESSON_DETAIL: "/course/:courseId/lesson/:lessonId",
  CATEGORY: "/category/:categoryName",
  INSTRUCTORS: "/instructors",
  PRICING: "/pricing",
  ABOUT: "/about",

  DASHBOARD: "/dashboard",
  STUDENT_DASHBOARD: "/student/dashboard",
  INSTRUCTOR_DASHBOARD: "/instructor/dashboard",
  ADMIN_DASHBOARD: "/admin/dashboard",

  PROFILE: "/profile",
  SETTINGS: "/settings",
  NOTIFICATIONS: "/notifications",
  CALENDAR: "/calendar",

  ADMIN_USERS: "/admin/users",
  ADMIN_COURSES: "/admin/courses",
  ADMIN_APPROVALS: "/admin/approvals",
  ADMIN_SETTINGS: "/admin/settings",

  INSTRUCTOR_COURSES: "/instructor/courses",
  INSTRUCTOR_GRADES: "/instructor/grades",

  LIVE_SESSION: "/live-session/:id",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 50,
} as const;

export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
} as const;
