import type { CourseSummary } from "./course";

export interface Enrollment {
  id: number;
  courseId: number;
  studentId: number;
  course: CourseSummary;
  progress: number;
  completedLessonIds: number[];
  completed_lesson_ids?: number[];
  nextLessonId?: number | null;
  nextLessonTitle?: string | null;
  next_lesson_id?: number | null;
  next_lesson_title?: string | null;
  lastAccessedAt: string;
  enrolledAt: string;
  completedAt: string | null;
}
