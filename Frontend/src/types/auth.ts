export type EducationLevel = "primary" | "prep" | "secondary" | "baccalaureate" | "university";

export interface Guardian {
  fullName: string;
  relationship: "father" | "mother" | "guardian";
  phone: string;
  nationalId?: string;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  first_name?: string;
  lastName: string;
  last_name?: string;
  fullName: string;
  full_name?: string;
  avatar?: string;
  role: UserRole;
  phone?: string;
  nationalId?: string;
  national_id?: string;
  dateOfBirth?: string;
  date_of_birth?: string;
  gender?: "male" | "female";
  governorate?: string;
  city?: string;
  bio?: string;
  authProvider?: "email" | "google";
  auth_provider?: "email" | "google";
  profileCompleted?: boolean;
  profile_completed?: boolean;
  must_change_password?: boolean;
  mustChangePassword?: boolean;
  is_first_login?: boolean;
  isFirstLogin?: boolean;
  teacher_uid?: string;
  teacherUid?: string;
  createdAt: string;
  created_at?: string;
  lastLoginAt?: string;
  last_login_at?: string;
  tutorialCompletedAt: string | null;
  tutorial_completed_at?: string | null;
  tutorialVersion: number;
  tutorial_version?: number;
}

export type UserRole = "student" | "instructor" | "guardian" | "center" | "admin" | "super_admin";

export interface Student extends User {
  role: "student";
  enrolledCourseIds: number[];
  completedCourseIds: number[];
  certificates: Certificate[];
  studyStreak: number;
  educationLevel?: EducationLevel;
  schoolName?: string;
  gradeLevel?: string;
  universityName?: string;
  facultyName?: string;
  educationalTrack?: string;
  secondLanguage?: string;
  religion?: string;
  guardian?: Guardian;
}

export interface Instructor extends User {
  role: "instructor";
  title?: string;
  specialization: string;
  teachingSubject?: string;
  teachingStages?: string[];
  teachingGrades?: string[];
  yearsOfExperience?: number;
  qualification?: string;
  isVerified?: boolean;
  isFeatured?: boolean;
  coursesCount?: number;
  studentsCount?: number;
  ratingAvg?: number;
  reviewCount?: number;
  joinedAt?: string;
  profileUrl?: string;

  // Legacy fallback fields
  courseIds?: number[];
  totalStudents?: number;
  rating?: number;
  revenue?: number;
}

export interface GuardianUser extends User {
  role: "guardian";
  studentNationalId: string;
  relationship: "father" | "mother" | "guardian";
}

export interface CenterUser extends User {
  role: "center";
  institutionName: string;
  institutionType: "center" | "college" | "university" | "institute" | "academy";
  address?: string;
  licenseNumber?: string;
  website?: string;
  isVerified?: boolean;
  instructorsCount?: number;
  studentsCount?: number;
}

export interface Admin extends User {
  role: "admin";
  permissions: string[];
}

export interface Certificate {
  id: number;
  courseId: number;
  courseName: string;
  issuedAt: string;
  grade: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RegisterData {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  password?: string;
  phone?: string;
  nationalId?: string;
  dateOfBirth?: string;
  gender?: "male" | "female";
  governorate?: string;
  city?: string;
  bio?: string;

  // Student specific
  educationLevel?: EducationLevel;
  schoolName?: string;
  gradeLevel?: string;
  universityName?: string;
  facultyName?: string;
  educationalTrack?: string;
  secondLanguage?: string;
  religion?: string;
  student?: {
    educationLevel?: EducationLevel;
    schoolName?: string;
    gradeLevel?: string;
    universityName?: string;
    facultyName?: string;
    educationalTrack?: string;
    secondLanguage?: string;
    religion?: string;
  };
  guardian?: Guardian;

  // Instructor specific
  qualification?: string;
  specialization?: string;
  teachingSubject?: string;
  teachingStages?: string[];
  teachingGrades?: string[];
  yearsOfExperience?: number;
  title?: string;
  instructor?: {
    qualification?: string;
    specialization?: string;
    teachingSubject?: string;
    teachingStages?: string[];
    teachingGrades?: string[];
    yearsOfExperience?: number;
    bio?: string;
    title?: string;
  };

  // Center specific
  institutionName?: string;
  institutionType?: "center" | "college" | "university" | "institute" | "academy";
  address?: string;
  licenseNumber?: string;
  website?: string;
  center?: {
    institutionName?: string;
    institutionType?: "center" | "college" | "university" | "institute" | "academy";
    address?: string;
    licenseNumber?: string;
    website?: string;
  };

  // Guardian specific
  studentNationalId?: string;
  guardianRelationship?: "father" | "mother" | "guardian";
}
