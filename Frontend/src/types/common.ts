export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export type NotificationType =
  | "course_update"
  | "assignment_due"
  | "grade_posted"
  | "new_message"
  | "enrollment"
  | "certificate"
  | "system"
  | "live_session";

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: number;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  avatar?: string;
  role: string;
}

export interface LiveSession {
  id: number;
  title: string;
  description: string;
  instructorId: number;
  instructorName: string;
  courseId?: number;
  courseName?: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "live" | "ended";
  participantCount: number;
  maxParticipants: number;
  meetingUrl?: string;
}

export interface Grade {
  id: number;
  studentId: number;
  courseId: number;
  courseName: string;
  assignmentId?: number;
  assignmentTitle?: string;
  score: number;
  maxScore: number;
  percentage: number;
  gradedAt: string;
  feedback?: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  type: "lesson" | "assignment" | "quiz" | "live_session" | "deadline";
  date: string;
  time?: string;
  courseId?: number;
  courseName?: string;
  description?: string;
}

export interface DashboardStats {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

export interface PricingPlan {
  id: number;
  name: string;
  price: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  limitations: string[];
  isPopular: boolean;
  maxCourses: number | "unlimited";
}
