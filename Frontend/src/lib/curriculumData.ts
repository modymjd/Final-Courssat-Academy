import type {
  EducationalStage,
  EducationalGrade,
  EducationalTrack,
  CourseSubject,
  SubjectBranch,
  CurriculumStageOption,
  CurriculumGradeOption,
  CurriculumTrackOption,
} from "@/types/curriculum";

export const STAGE_LABELS: Record<string, string> = {
  primary: "المرحلة الابتدائية",
  prep: "المرحلة الإعدادية",
  secondary: "المرحلة الثانوية العامة",
  baccalaureate: "نظام البكالوريا المصرية",
  university: "المرحلة الجامعية والمعاهد",
};

export const GRADE_LABELS: Record<string, string> = {
  primary_1: "الصف الأول الابتدائي",
  primary_2: "الصف الثاني الابتدائي",
  primary_3: "الصف الثالث الابتدائي",
  primary_4: "الصف الرابع الابتدائي",
  primary_5: "الصف الخامس الابتدائي",
  primary_6: "الصف السادس الابتدائي",
  prep_1: "الصف الأول الإعدادي",
  prep_2: "الصف الثاني الإعدادي",
  prep_3: "الصف الثالث الإعدادي (الشهادة الإعدادية)",
  secondary_1: "الصف الأول الثانوي",
  secondary_2: "الصف الثاني الثانوي",
  secondary_3: "الصف الثالث الثانوي (الشهادة العامة)",
  baccalaureate_1: "الصف الأول بكالوريا (تمهيدي)",
  baccalaureate_2: "الصف الثاني بكالوريا",
  baccalaureate_3: "الصف الثالث بكالوريا",
  university: "المرحلة الجامعية",
};

export const TRACK_LABELS: Record<string, string> = {
  scientific_science: "شعبة علمي علوم",
  scientific_math: "شعبة علمي رياضة",
  literary: "شعبة أدبي",
  bac_medical: "مسار الطب والعلوم الصحية",
  bac_engineering: "مسار الهندسة والتكنولوجيا",
  bac_business: "مسار إدارة الأعمال والاقتصاد",
  bac_humanities: "مسار العلوم الإنسانية والأدبي",
  general: "عام",
};

export const SUBJECT_LABELS: Record<string, string> = {
  arabic: "اللغة العربية",
  english: "اللغة الإنجليزية",
  english_connect: "اللغة الإنجليزية (Connect)",
  second_foreign_lang: "اللغة الأجنبية الثانية",
  french: "اللغة الفرنسية",
  german: "اللغة الألمانية",
  italian: "اللغة الإيطالية",
  spanish: "اللغة الإسبانية",
  math: "الرياضيات",
  pure_math: "الرياضيات البحتة",
  applied_math: "الرياضيات التطبيقية",
  advanced_math: "الرياضيات المتقدمة",
  science: "العلوم",
  integrated_sciences: "العلوم المتكاملة",
  physics: "الفيزياء",
  chemistry: "الكيمياء",
  biology: "الأحياء",
  geology: "الجيولوجيا والعلوم البيئية",
  social_studies: "الدراسات الاجتماعية",
  history: "التاريخ",
  egyptian_history: "التاريخ المصري",
  geography: "الجغرافيا",
  philosophy_logic: "الفلسفة والمنطق",
  psychology_sociology: "علم النفس والاجتماع",
  economics: "الاقتصاد",
  statistics: "الإحصاء",
  ict: "تكنولوجيا المعلومات والاتصالات (ICT)",
  vocational_skills: "المهارات المهنية",
  religious_education: "التربية الدينية",
  islamic_religion: "التربية الدينية الإسلامية",
  christian_religion: "التربية الدينية المسيحية",
  computer: "الحاسب الآلي",
  other: "مقررات أخرى",
};

export const BRANCH_LABELS: Record<string, string> = {
  algebra_stats: "جبر وإحصاء",
  geometry: "هندسة",
  algebra_trig: "جبر وحساب مثلثات",
  analytic_geom: "هندسة تحليلية",
  history: "تاريخ",
  geography: "جغرافيا",
  elective_math: "مادة اختيارية: رياضيات",
  elective_physics: "مادة اختيارية: فيزياء",
  general: "عام",
};

export const CURRICULUM_DATA: Record<EducationalStage, CurriculumStageOption> = {
  primary: {
    id: "primary",
    name: "المرحلة الابتدائية",
    nameEn: "Primary Stage",
    description: "تنقسم إلى صفوف أولى (1-3) تعتمد على الفهم والتأسيس، وصفوف عليا (4-6) بمواد منفصلة ومتخصصة.",
    grades: [
      {
        id: "primary_1",
        name: "الصف الأول الابتدائي",
        group: "early_primary",
        subjects: ["arabic", "english_connect", "math", "religious_education", "islamic_religion", "christian_religion"],
      },
      {
        id: "primary_2",
        name: "الصف الثاني الابتدائي",
        group: "early_primary",
        subjects: ["arabic", "english_connect", "math", "religious_education", "islamic_religion", "christian_religion"],
      },
      {
        id: "primary_3",
        name: "الصف الثالث الابتدائي",
        group: "early_primary",
        subjects: ["arabic", "english_connect", "math", "religious_education", "islamic_religion", "christian_religion"],
      },
      {
        id: "primary_4",
        name: "الصف الرابع الابتدائي",
        group: "upper_primary",
        subjects: ["arabic", "english", "math", "science", "social_studies", "ict", "vocational_skills", "religious_education"],
      },
      {
        id: "primary_5",
        name: "الصف الخامس الابتدائي",
        group: "upper_primary",
        subjects: ["arabic", "english", "math", "science", "social_studies", "ict", "vocational_skills", "religious_education"],
      },
      {
        id: "primary_6",
        name: "الصف السادس الابتدائي",
        group: "upper_primary",
        subjects: ["arabic", "english", "math", "science", "social_studies", "ict", "vocational_skills", "religious_education"],
      },
    ],
  },
  prep: {
    id: "prep",
    name: "المرحلة الإعدادية",
    nameEn: "Preparatory Stage",
    description: "دراسة المواد المدمجة بعمق أكبر، مع إتاحة اللغات الأجنبية الثانية وتفرع الرياضيات والدراسات.",
    grades: [
      {
        id: "prep_1",
        name: "الصف الأول الإعدادي",
        subjects: ["arabic", "english", "french", "german", "italian", "spanish", "math", "science", "social_studies", "religious_education", "computer"],
      },
      {
        id: "prep_2",
        name: "الصف الثاني الإعدادي",
        subjects: ["arabic", "english", "french", "german", "italian", "spanish", "math", "science", "social_studies", "religious_education", "computer"],
      },
      {
        id: "prep_3",
        name: "الصف الثالث الإعدادي (الشهادة الإعدادية)",
        subjects: ["arabic", "english", "french", "german", "italian", "spanish", "math", "science", "social_studies", "religious_education", "computer"],
      },
    ],
  },
  secondary: {
    id: "secondary",
    name: "المرحلة الثانوية العامة",
    nameEn: "General Secondary Stage",
    description: "الصف الأول عام للكل بالمواد المدمجة والعلوم المتكاملة، والصفان الثاني والثالث ينقسمان لشعب (علمي علوم / علمي رياضة / أدبي).",
    grades: [
      {
        id: "secondary_1",
        name: "الصف الأول الثانوي (عام للكل)",
        requiresTrack: false,
        subjects: ["arabic", "english", "french", "german", "italian", "spanish", "math", "history", "integrated_sciences", "philosophy_logic", "religious_education"],
      },
      {
        id: "secondary_2",
        name: "الصف الثاني الثانوي",
        requiresTrack: true,
        allowedTracks: ["scientific_science", "scientific_math", "literary"],
      },
      {
        id: "secondary_3",
        name: "الصف الثالث الثانوي (الشهادة العامة)",
        requiresTrack: true,
        allowedTracks: ["scientific_science", "scientific_math", "literary"],
      },
    ],
    tracks: [
      {
        id: "scientific_science",
        name: "شعبة علمي علوم",
        description: "التركيز على العلوم الطبية والبيولوجية مع الأحياء والكيمياء والفيزياء (والجيولوجيا لـ 3 ثانوي).",
        subjects: ["arabic", "english", "french", "german", "physics", "chemistry", "biology", "geology"],
      },
      {
        id: "scientific_math",
        name: "شعبة علمي رياضة",
        description: "التركيز على الرياضيات البحتة والتطبيقية والفيزياء والكيمياء المؤهلة لكليات الهندسة.",
        subjects: ["arabic", "english", "french", "german", "physics", "chemistry", "pure_math", "applied_math"],
      },
      {
        id: "literary",
        name: "شعبة أدبي",
        description: "التركيز على التاريخ والجغرافيا وعلم النفس والاجتماع والفلسفة والمنطق واللغات.",
        subjects: ["arabic", "english", "french", "german", "history", "geography", "psychology_sociology", "philosophy_logic"],
      },
    ],
  },
  baccalaureate: {
    id: "baccalaureate",
    name: "نظام البكالوريا المصرية",
    nameEn: "Egyptian Baccalaureate",
    description: "مسار تعليمي متقدم ينفصل بعد الإعدادية؛ صف أول تمهيدي ثم 4 مسارات تخصصية بالصفين الثاني والثالث.",
    grades: [
      {
        id: "baccalaureate_1",
        name: "الصف الأول بكالوريا (تمهيدي)",
        requiresTrack: false,
        subjects: ["arabic", "english", "egyptian_history", "math", "physics"],
      },
      {
        id: "baccalaureate_2",
        name: "الصف الثاني بكالوريا",
        requiresTrack: true,
        allowedTracks: ["bac_medical", "bac_engineering", "bac_business", "bac_humanities"],
      },
      {
        id: "baccalaureate_3",
        name: "الصف الثالث بكالوريا",
        requiresTrack: true,
        allowedTracks: ["bac_medical", "bac_engineering", "bac_business", "bac_humanities"],
      },
    ],
    tracks: [
      {
        id: "bac_medical",
        name: "مسار الطب والعلوم الصحية",
        description: "أحياء + كيمياء + المواد المشتركة (عربي، إنجليزي، تاريخ).",
        subjects: ["arabic", "english", "egyptian_history", "biology", "chemistry"],
      },
      {
        id: "bac_engineering",
        name: "مسار الهندسة والتكنولوجيا",
        description: "رياضيات متقدمة + فيزياء + المواد المشتركة (عربي، إنجليزي، تاريخ).",
        subjects: ["arabic", "english", "egyptian_history", "advanced_math", "physics"],
      },
      {
        id: "bac_business",
        name: "مسار إدارة الأعمال والاقتصاد",
        description: "اقتصاد + رياضيات + المواد المشتركة (عربي، إنجليزي، تاريخ).",
        subjects: ["arabic", "english", "egyptian_history", "economics", "math"],
      },
      {
        id: "bac_humanities",
        name: "مسار العلوم الإنسانية والأدبي",
        description: "جغرافيا + إحصاء + المواد المشتركة (عربي، إنجليزي، تاريخ).",
        subjects: ["arabic", "english", "egyptian_history", "geography", "statistics"],
      },
    ],
  },
  university: {
    id: "university",
    name: "المرحلة الجامعية والمعاهد",
    nameEn: "University Stage",
    description: "الكليات والمعاهد التخصصية والتعليم العالي.",
    grades: [
      {
        id: "university",
        name: "المرحلة الجامعية",
        subjects: ["math", "physics", "chemistry", "computer", "other"],
      },
    ],
  },
};

export const SUBJECT_BRANCHES: Record<string, Record<string, Array<{ id: SubjectBranch; name: string }>>> = {
  prep: {
    math: [
      { id: "algebra_stats", name: "جبر وإحصاء" },
      { id: "geometry", name: "هندسة" },
    ],
    social_studies: [
      { id: "history", name: "تاريخ" },
      { id: "geography", name: "جغرافيا" },
    ],
  },
  secondary_1: {
    math: [
      { id: "algebra_trig", name: "جبر وحساب مثلثات" },
      { id: "analytic_geom", name: "هندسة تحليلية" },
    ],
  },
  baccalaureate_1: {
    elective: [
      { id: "elective_math", name: "مادة اختيارية: رياضيات" },
      { id: "elective_physics", name: "مادة اختيارية: فيزياء" },
    ],
  },
};

export function getGradesForStage(stage?: EducationalStage | string): CurriculumGradeOption[] {
  if (!stage || !(stage in CURRICULUM_DATA)) return [];
  return CURRICULUM_DATA[stage as EducationalStage].grades;
}

export function getTracksForGrade(
  stage?: EducationalStage | string,
  grade?: EducationalGrade | string
): CurriculumTrackOption[] {
  if (!stage || !(stage in CURRICULUM_DATA)) return [];
  const stageData = CURRICULUM_DATA[stage as EducationalStage];
  const gradeData = stageData.grades.find((g) => g.id === grade);

  if (!gradeData?.requiresTrack) return [];
  const allowed = gradeData.allowedTracks || [];
  return (stageData.tracks || []).filter((t) => allowed.includes(t.id));
}

export function getSubjectsForTarget(
  stage?: EducationalStage | string,
  grade?: EducationalGrade | string,
  track?: EducationalTrack | string
): CourseSubject[] {
  if (!stage || !(stage in CURRICULUM_DATA)) {
    return Object.keys(SUBJECT_LABELS) as CourseSubject[];
  }
  const stageData = CURRICULUM_DATA[stage as EducationalStage];

  if (!grade) {
    const set = new Set<CourseSubject>();
    stageData.grades.forEach((g) => g.subjects?.forEach((s) => set.add(s)));
    stageData.tracks?.forEach((t) => t.subjects.forEach((s) => set.add(s)));
    return Array.from(set);
  }

  const gradeData = stageData.grades.find((g) => g.id === grade);
  if (!gradeData) return [];

  if (gradeData.requiresTrack) {
    if (!track || track === "general") return [];
    const trackData = stageData.tracks?.find((t) => t.id === track);
    if (!trackData) return [];
    let list = [...trackData.subjects];
    if (grade === "secondary_2") {
      // Geology is only in 3rd secondary
      list = list.filter((s) => s !== "geology");
    }
    return list;
  }

  return gradeData.subjects || [];
}

export function getBranchesForSubject(
  stage?: EducationalStage | string,
  grade?: EducationalGrade | string,
  subject?: CourseSubject | string
): Array<{ id: SubjectBranch; name: string }> {
  if (!stage || !subject) return [];

  if (stage === "prep" && SUBJECT_BRANCHES.prep[subject]) {
    return SUBJECT_BRANCHES.prep[subject];
  }

  if (stage === "secondary" && grade === "secondary_1" && subject === "math") {
    return SUBJECT_BRANCHES.secondary_1.math;
  }

  return [];
}
