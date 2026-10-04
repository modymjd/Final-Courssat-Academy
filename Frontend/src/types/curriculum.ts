export type EducationalStage =
  | "primary"
  | "prep"
  | "secondary"
  | "baccalaureate"
  | "university";

export type EducationalGrade =
  | "primary_1"
  | "primary_2"
  | "primary_3"
  | "primary_4"
  | "primary_5"
  | "primary_6"
  | "prep_1"
  | "prep_2"
  | "prep_3"
  | "secondary_1"
  | "secondary_2"
  | "secondary_3"
  | "baccalaureate_1"
  | "baccalaureate_2"
  | "baccalaureate_3"
  | "university";

export type EducationalTrack =
  | "scientific_science"
  | "scientific_math"
  | "literary"
  | "bac_medical"
  | "bac_engineering"
  | "bac_business"
  | "bac_humanities"
  | "general"
  | "";

export type CourseSubject =
  | "arabic"
  | "english"
  | "english_connect"
  | "second_foreign_lang"
  | "french"
  | "german"
  | "italian"
  | "spanish"
  | "math"
  | "pure_math"
  | "applied_math"
  | "advanced_math"
  | "science"
  | "integrated_sciences"
  | "physics"
  | "chemistry"
  | "biology"
  | "geology"
  | "social_studies"
  | "history"
  | "egyptian_history"
  | "geography"
  | "philosophy_logic"
  | "psychology_sociology"
  | "economics"
  | "statistics"
  | "ict"
  | "vocational_skills"
  | "religious_education"
  | "islamic_religion"
  | "christian_religion"
  | "computer"
  | "other";

export type SubjectBranch =
  | "algebra_stats"
  | "geometry"
  | "algebra_trig"
  | "analytic_geom"
  | "history"
  | "geography"
  | "elective_math"
  | "elective_physics"
  | "general"
  | "";

export interface CurriculumSubjectOption {
  id: CourseSubject;
  name: string;
  nameEn?: string;
  description?: string;
  branches?: Array<{ id: SubjectBranch; name: string }>;
}

export interface CurriculumTrackOption {
  id: EducationalTrack;
  name: string;
  description?: string;
  subjects: CourseSubject[];
}

export interface CurriculumGradeOption {
  id: EducationalGrade;
  name: string;
  group?: "early_primary" | "upper_primary";
  requiresTrack?: boolean;
  allowedTracks?: EducationalTrack[];
  subjects?: CourseSubject[];
}

export interface CurriculumStageOption {
  id: EducationalStage;
  name: string;
  nameEn: string;
  description: string;
  grades: CurriculumGradeOption[];
  tracks?: CurriculumTrackOption[];
}
