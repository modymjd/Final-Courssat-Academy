export type CourseLevel = "beginner" | "intermediate" | "advanced";

export type CourseStatus = "draft" | "published" | "archived";

export type {
  EducationalStage,
  EducationalGrade,
  EducationalTrack,
  CourseSubject,
  SubjectBranch,
} from "./curriculum";

import type {
  EducationalStage,
  EducationalGrade,
  EducationalTrack,
  CourseSubject,
  SubjectBranch,
} from "./curriculum";

export interface Course {
  id: number;
  title: string;
  description: string;
  shortDescription: string;
  instructor: InstructorSummary;
  image: string;
  educationalStage?: EducationalStage | null;
  educationalGrade?: EducationalGrade | null;
  educationalTrack?: EducationalTrack | null;
  subject?: CourseSubject | null;
  subjectBranch?: SubjectBranch | null;
  duration: string;
  level: CourseLevel;
  category: Category;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  isFree: boolean;
  enforceQuizGate?: boolean;
  enforce_quiz_gate?: boolean;
  rating: number;
  reviewCount: number;
  studentCount: number;
  lessonCount: number;
  status: CourseStatus;
  language: string;
  requirements: string[];
  objectives: string[];
  videoPreviewUrl?: string;
  targetAudience?: string[];
  modules?: Module[];
  reviews?: Review[];
  relatedCourses?: Course[];
  createdAt: string;
  updatedAt: string;
}

export type CourseSummary = Course;


export interface InstructorSummary {
  id: number;
  name: string;
  avatar?: string;
  title?: string;
  bio?: string;
  rating?: number;
  studentCount?: number;
  courseCount?: number;
  reviewCount?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  courseCount: number;
  color: string;
}

export interface LessonQuizInfo {
  id: number;
  title?: string;
  kind?: string;
  is_passed?: boolean;
  isPassed?: boolean;
  pass_threshold?: number;
  passThreshold?: number;
  cooldown_remaining_seconds?: number;
}

export interface InVideoCheckpoint {
  exam_id: number;
  second: number;
  is_mandatory: boolean;
  is_passed: boolean;
}

export interface UnitExamInfo {
  id: number;
  title: string;
  kind?: string;
  attempts_allowed?: number;
  attemptsAllowed?: number;
  attempts_count?: number;
  attemptsCount?: number;
  is_passed?: boolean;
  isPassed?: boolean;
  pass_threshold?: number;
  passThreshold?: number;
  cooldown_remaining_seconds?: number;
}

export interface Module {
  id: number;
  courseId: number;
  title: string;
  order: number;
  isPublished?: boolean;
  is_published?: boolean;
  availableFrom?: string | null;
  available_from?: string | null;
  lessons: Lesson[];
  unitExam?: UnitExamInfo | null;
  unit_exam?: UnitExamInfo | null;
}

export interface VideoAsset {
  id: number;
  title: string;
  uploaderId: number;
  uploaderName: string;
  status: "pending" | "processing" | "ready" | "failed";
  durationSeconds: number;
  fileSizeBytes: number;
  resolutions: string[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonSummary {
  id: number;
  lessonId: number;
  content: string;
  attachment?: string | null;
  attachmentName?: string;
  attachmentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: number;
  moduleId: number;
  title: string;
  type: LessonType;
  duration: string;
  order: number;
  isFree: boolean;
  isPublished?: boolean;
  is_published?: boolean;
  availableFrom?: string | null;
  available_from?: string | null;
  videoId?: number | null;
  video?: VideoAsset | null;
  videoUrl?: string;
  content?: string;
  summary?: LessonSummary | null;
  lastPositionSeconds?: number;
  watchedPercent?: number;
  isLocked?: boolean;
  is_locked?: boolean;
  lockReason?: string | null;
  lock_reason?: string | null;
  quiz?: LessonQuizInfo | null;
  in_video_checkpoints?: InVideoCheckpoint[];
}

export type LessonType = "video" | "article" | "quiz" | "assignment";

export interface Review {
  id: number;
  courseId: number;
  studentId: number;
  studentName: string;
  studentAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CourseFiltersState {
  search?: string;
  category?: string;
  level?: CourseLevel;
  educationalStage?: EducationalStage;
  educationalGrade?: EducationalGrade;
  subject?: CourseSubject;
  minRating?: number;
  maxPrice?: number;
  isFree?: boolean;
  sortBy?: "popular" | "newest" | "rating" | "price-asc" | "price-desc";
}

/** Canonical API pagination contract. Backend emits this shape for every paginated list. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
