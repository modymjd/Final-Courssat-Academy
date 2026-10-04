import { apiGet } from "@/lib/http";
import type { DashboardStats, Course, Enrollment } from "@/types";

export interface AdminDashboardData {
  stats: DashboardStats[];
  pending_approvals?: Array<{ id: number | string; type: string; title: string; date: string }>;
  pendingApprovals?: Array<{ id: number | string; type: string; title: string; date: string }>;
  recent_activity?: Array<{ id: string; action: string; user: string; timestamp: string }>;
  recentActivity?: Array<{ id: string; action: string; user: string; timestamp: string }>;
  enrollment_trend?: Array<{ month: string; count: number }>;
  enrollmentTrend?: Array<{ month: string; count: number }>;
  revenue_trend?: Array<{ month: string; revenue: number }>;
  revenueTrend?: Array<{ month: string; revenue: number }>;
}

export interface StudentDashboardEvent {
  id: number | string;
  type: "quiz" | "deadline" | "lesson" | string;
  title: string;
  courseName?: string;
  course_name?: string;
  time?: string;
}

export interface StudentDashboardData {
  stats?: DashboardStats[];
  recentEnrollments?: Enrollment[];
  enrollments?: Enrollment[];
  upcomingEvents?: StudentDashboardEvent[];
  upcoming_events?: StudentDashboardEvent[];
  recentGrades?: Record<string, unknown>[];
  recent_grades?: Record<string, unknown>[];
  notifications?: Record<string, unknown>[];
  streak_days?: number;
}

export async function getStudentDashboard() {
  return apiGet<StudentDashboardData>(`/dashboard/student/`);
}

export async function getInstructorDashboard() {
  return apiGet<{ stats: DashboardStats[]; activeCourses?: Course[]; courses?: Course[]; }>(`/dashboard/instructor/`);
}

export async function getAdminDashboard() {
  return apiGet<AdminDashboardData>(`/dashboard/admin/`);
}
