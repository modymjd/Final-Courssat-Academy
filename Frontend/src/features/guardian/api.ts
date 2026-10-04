import { apiGet } from "@/lib/http";

export interface GuardianChildCourse {
  id: number;
  title: string;
  instructor: string;
}

export interface GuardianChildGrade {
  id: number;
  course: string;
  score: number;
  max_score: number;
  percentage: number;
  feedback: string;
  graded_at: string;
}

export interface GuardianChildExam {
  id: number;
  title: string;
  course: string;
  status: string;
  score: number | null;
  is_passed: boolean;
  completed_at: string | null;
}

export interface GuardianUpcomingExam {
  id: number;
  title: string;
  course: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
}

export interface GuardianDashboardChild {
  student: {
    id: number;
    full_name: string;
    email: string;
    education_level: string;
    grade_level: string;
    school_name: string;
    university_name: string;
    faculty_name: string;
  };
  courses: GuardianChildCourse[];
  grades: GuardianChildGrade[];
  exams: GuardianChildExam[];
  upcoming_exams: GuardianUpcomingExam[];
  stats: {
    courses_count: number;
    exam_attempts: number;
    average_grade: number;
  };
}

export interface GuardianNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url: string;
  created_at: string;
}

export interface GuardianDashboardData {
  children: GuardianDashboardChild[];
  notifications: GuardianNotification[];
  unread_notifications: number;
}

export async function getGuardianDashboard(): Promise<GuardianDashboardData> {
  return apiGet<GuardianDashboardData>("/accounts/guardian/dashboard/");
}
