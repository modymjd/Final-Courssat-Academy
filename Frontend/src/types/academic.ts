export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type TaskType = "MANUAL" | "GRADING" | "BOOKING_REQUEST" | "UNANSWERED_QA" | "AT_RISK_ALERT";

export interface AcademicTask {
  id: number;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  task_type: TaskType;
  due_date: string | null;
  course: number | null;
  course_title?: string | null;
  student: number | null;
  student_name?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanTasksResponse {
  pending: AcademicTask[];
  in_progress: AcademicTask[];
  completed: AcademicTask[];
}

export interface MorningBriefSession {
  id: number;
  title: string;
  course_title: string;
  scheduled_at: string;
  duration: number;
  status: string;
  meeting_url: string;
}

export interface AtRiskAlert {
  id: number;
  student_id: number | null;
  student_name: string;
  course_title: string;
  reason: string;
  created_at: string;
}

export interface InstructorDailyBrief {
  instructor: {
    id: number;
    full_name: string;
    email: string;
  };
  kpis: {
    total_students: number;
    active_courses: number;
    total_courses: number;
    avg_rating: number;
    total_revenue: number;
    avg_completion_rate: number;
  };
  morning_brief: {
    today_sessions: MorningBriefSession[];
    pending_grading_count: number;
    unread_qa_count: number;
    at_risk_alerts: AtRiskAlert[];
    urgent_tasks: AcademicTask[];
  };
}
