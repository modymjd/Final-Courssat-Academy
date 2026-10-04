import React, { useState, useMemo } from "react";
import {
  Award,
  BookOpen,
  Search,
  Check,
  CheckCircle2,
  GraduationCap,
  Layers,
  Sparkles,
  Clock,
  HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type UseFormRegister,
  type Control,
  type UseFormSetValue,
  type UseFormWatch,
  type FieldErrors,
  Controller,
} from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import type { RegisterFormValues } from "./types";
import { getGradesForStage } from "@/lib/curriculumData";
import type { EducationalStage } from "@/types/curriculum";

export interface TeachingSubjectOption {
  id: string;
  name: string;
  category: "languages" | "sciences_math" | "humanities" | "general";
  icon: string;
}

export const TEACHING_SUBJECT_CATEGORIES = [
  { id: "all", label: "كافة المواد" },
  { id: "languages", label: "اللغات" },
  { id: "sciences_math", label: "العلوم والرياضيات" },
  { id: "humanities", label: "العلوم الإنسانية والاجتماعية" },
  { id: "general", label: "التكنولوجيا والمواد العامة" },
] as const;

export const TEACHING_SUBJECTS: TeachingSubjectOption[] = [
  // اللغات
  { id: "arabic", name: "اللغة العربية", category: "languages", icon: "📖" },
  { id: "english", name: "اللغة الإنجليزية", category: "languages", icon: "🇬🇧" },
  { id: "french", name: "اللغة الفرنسية", category: "languages", icon: "🇫🇷" },
  { id: "german", name: "اللغة الألمانية", category: "languages", icon: "🇩🇪" },
  { id: "italian", name: "اللغة الإيطالية", category: "languages", icon: "🇮🇹" },
  { id: "spanish", name: "اللغة الإسبانية", category: "languages", icon: "🇪🇸" },
  // العلوم والرياضيات
  { id: "math", name: "الرياضيات (بحتة وتطبيقية)", category: "sciences_math", icon: "📐" },
  { id: "physics", name: "الفيزياء", category: "sciences_math", icon: "⚡" },
  { id: "chemistry", name: "الكيمياء", category: "sciences_math", icon: "🧪" },
  { id: "biology", name: "الأحياء", category: "sciences_math", icon: "🧬" },
  { id: "geology", name: "الجيولوجيا وعلوم البيئة", category: "sciences_math", icon: "🌋" },
  { id: "science", name: "العلوم العامة / المتكاملة", category: "sciences_math", icon: "🔬" },
  // العلوم الإنسانية
  { id: "history", name: "التاريخ والتاريخ المصري", category: "humanities", icon: "🏛️" },
  { id: "geography", name: "الجغرافيا", category: "humanities", icon: "🌍" },
  { id: "philosophy_logic", name: "الفلسفة والمنطق", category: "humanities", icon: "💡" },
  { id: "psychology_sociology", name: "علم النفس والاجتماع", category: "humanities", icon: "🧠" },
  { id: "social_studies", name: "الدراسات الاجتماعية", category: "humanities", icon: "🗺️" },
  // التكنولوجيا والعام
  { id: "computer", name: "الحاسب الآلي وتكنولوجيا المعلومات (ICT)", category: "general", icon: "💻" },
  { id: "religious_education", name: "التربية الدينية", category: "general", icon: "🕌" },
  { id: "economics", name: "الاقتصاد والإحصاء", category: "general", icon: "📊" },
];

export const TEACHING_STAGES_OPTIONS = [
  {
    id: "primary",
    name: "المرحلة الابتدائية",
    description: "الصفوف 1 إلى 6",
    icon: "🎒",
    badge: "6 صفوف",
  },
  {
    id: "prep",
    name: "المرحلة الإعدادية",
    description: "الصفوف 1 إلى 3 (الشهادة الإعدادية)",
    icon: "🏫",
    badge: "3 صفوف",
  },
  {
    id: "secondary",
    name: "المرحلة الثانوية العامة",
    description: "الصفوف 1 إلى 3 (علمي وأدبي)",
    icon: "🎓",
    badge: "3 صفوف",
  },
  {
    id: "baccalaureate",
    name: "نظام البكالوريا المصرية",
    description: "المسار الحديث للتعليم الثانوي",
    icon: "🏛️",
    badge: "3 صفوف",
  },
];

const EXPERIENCE_OPTIONS = [
  { value: 1, label: "أقل من سنتين (مبتدئ)" },
  { value: 3, label: "3 - 5 سنوات" },
  { value: 7, label: "5 - 10 سنوات" },
  { value: 12, label: "أكثر من 10 سنوات (خبير)" },
];

interface InstructorFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control?: Control<RegisterFormValues>;
  setValue?: UseFormSetValue<RegisterFormValues>;
  watch?: UseFormWatch<RegisterFormValues>;
  errors?: FieldErrors<RegisterFormValues>;
}

export const InstructorFields: React.FC<InstructorFieldsProps> = ({
  register,
  control,
  setValue,
  watch,
  errors,
}) => {
  const [subjectCategory, setSubjectCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const watchedSubject = watch ? watch("teachingSubject") : "";
  const watchedSpecialization = watch ? watch("specialization") : "";
  const watchedStages = watch ? (watch("teachingStages") || []) : [];
  const watchedGrades = watch ? (watch("teachingGrades") || []) : [];
  const watchedYears = watch ? watch("yearsOfExperience") : undefined;

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    return TEACHING_SUBJECTS.filter((sub) => {
      const matchesCategory = subjectCategory === "all" || sub.category === subjectCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        sub.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        sub.id.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [subjectCategory, searchQuery]);

  // Dynamically compute available grades based on selected stages
  const availableGrades = useMemo(() => {
    if (!watchedStages || watchedStages.length === 0) return [];
    return watchedStages.flatMap((stageId) => {
      const grades = getGradesForStage(stageId as EducationalStage);
      const stageMeta = TEACHING_STAGES_OPTIONS.find((s) => s.id === stageId);
      return grades.map((g) => ({
        ...g,
        stageId,
        stageName: stageMeta?.name || stageId,
      }));
    });
  }, [watchedStages]);

  const handleSelectSubject = (subject: TeachingSubjectOption) => {
    if (setValue) {
      setValue("teachingSubject", subject.id, { shouldValidate: true });
      setValue("specialization", subject.name, { shouldValidate: true });
    }
  };

  const handleToggleStage = (stageId: string) => {
    if (!setValue) return;
    const current = [...(watchedStages || [])];
    const index = current.indexOf(stageId);
    let updatedStages: string[];
    if (index >= 0) {
      updatedStages = current.filter((s) => s !== stageId);
      // Also remove grades belonging to the unselected stage
      const unselectedGrades = getGradesForStage(stageId as EducationalStage).map((g) => g.id);
      const updatedGrades = (watchedGrades || []).filter((g) => !unselectedGrades.includes(g));
      setValue("teachingGrades", updatedGrades);
    } else {
      updatedStages = [...current, stageId];
    }
    setValue("teachingStages", updatedStages, { shouldValidate: true });
  };

  const handleToggleGrade = (gradeId: string) => {
    if (!setValue) return;
    const current = [...(watchedGrades || [])];
    const index = current.indexOf(gradeId);
    if (index >= 0) {
      setValue("teachingGrades", current.filter((g) => g !== gradeId));
    } else {
      setValue("teachingGrades", [...current, gradeId]);
    }
  };

  const handleSelectAllGrades = () => {
    if (!setValue) return;
    const allGradeIds = availableGrades.map((g) => g.id);
    setValue("teachingGrades", allGradeIds);
  };

  const handleClearGrades = () => {
    if (!setValue) return;
    setValue("teachingGrades", []);
  };

  return (
    <Card className="rounded-3xl border border-border/80 shadow-md bg-card overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Award className="text-primary" size={20} /> الملف الأكاديمي والمهني للمحاضر
          </CardTitle>
          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 font-bold">
            هيكل المنهج المعتمد
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          حدد المادة التخصصية والمراحل والصفوف التي تدرّسها لتحصل على ترشيحات دقيقة لطلابك
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Sub-Box 1: Primary Subject Specialization */}
        <div className="space-y-3 p-4 rounded-2xl border border-border/70 bg-card/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <BookOpen className="text-primary" size={16} />
                المادة والتخصص التدريسي الأساسي <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                اختر مادة تدريس واحدة أساسية (مبنية على المنهج المعتمد)
              </p>
            </div>
            {watchedSubject && (
              <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1.5 self-start sm:self-auto">
                <Check size={12} /> {watchedSpecialization || watchedSubject}
              </Badge>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="space-y-2 pt-1">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="ابحث عن مادتك (مثال: فيزياء، رياضيات، لغة عربية)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-10 text-xs rounded-xl bg-background"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TEACHING_SUBJECT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSubjectCategory(cat.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium cursor-pointer ${
                    subjectCategory === cat.id
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted/60 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subjects Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto p-1 rounded-xl border border-border/40 bg-muted/10">
            {filteredSubjects.map((sub) => {
              const isSelected = watchedSubject === sub.id || watchedSpecialization === sub.name;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectSubject(sub)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-start transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30"
                      : "border-border/70 bg-card hover:bg-muted/40 hover:border-border text-foreground"
                  }`}
                >
                  <span className="text-xl shrink-0">{sub.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{sub.name}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          {errors?.teachingSubject && (
            <p className="text-xs text-destructive font-medium">{errors.teachingSubject.message}</p>
          )}
        </div>

        {/* Sub-Box 2: Target Educational Stages (Multi-Select) */}
        <div className="space-y-3 p-4 rounded-2xl border border-border/70 bg-card/60">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="text-primary" size={16} />
                المراحل التعليمية المستهدفة <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                يمكنك اختيار مرحلة واحدة أو عدة مراحل تدريسية في آن واحد
              </p>
            </div>
            {watchedStages.length > 0 && (
              <Badge variant="secondary" className="font-bold text-xs">
                تم اختيار {watchedStages.length} مراحل
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TEACHING_STAGES_OPTIONS.map((stg) => {
              const isSelected = watchedStages.includes(stg.id);
              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => handleToggleStage(stg.id)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30"
                      : "border-border/70 bg-card hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <span className="text-2xl mt-0.5 shrink-0">{stg.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-foreground">{stg.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {stg.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stg.description}</p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-border shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
          {errors?.teachingStages && (
            <p className="text-xs text-destructive font-medium">{errors.teachingStages.message}</p>
          )}
        </div>

        {/* Sub-Box 3: Target Grades Multi-Select (Revealed when stages selected) */}
        <AnimatePresence>
          {availableGrades.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 p-4 rounded-2xl border border-border/70 bg-card/60"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <GraduationCap className="text-primary" size={16} />
                    تحديد الصفوف الدراسية المستهدفة
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختر الصفوف المحددة التي تقدّم لها شروحاتك وامتحاناتك
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllGrades}
                    className="text-xs h-8 px-2.5"
                  >
                    تحديد جميع الصفوف ({availableGrades.length})
                  </Button>
                  {watchedGrades.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearGrades}
                      className="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
                    >
                      إلغاء التحديد
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {availableGrades.map((g) => {
                  const isChecked = watchedGrades.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleToggleGrade(g.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                          : "bg-background hover:bg-muted text-foreground border-border/80"
                      }`}
                    >
                      {isChecked ? <Check size={14} /> : <div className="w-3 h-3 rounded-full border border-border" />}
                      <span>{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-Box 4: Qualifications & Bio */}
        <div className="space-y-4 p-4 rounded-2xl border border-border/70 bg-card/60">
          <Label className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="text-primary" size={16} />
            الخبرة والمؤهل الأكاديمي والنبذة
          </Label>

          {/* Years of experience choice pills */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock size={14} className="text-muted-foreground" /> سنوات الخبرة التدريسية
            </Label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_OPTIONS.map((exp) => {
                const isSelected = watchedYears === exp.value;
                return (
                  <button
                    key={exp.value}
                    type="button"
                    onClick={() => setValue && setValue("yearsOfExperience", exp.value)}
                    className={`px-3 py-2 rounded-xl text-xs border transition-all cursor-pointer font-medium ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-background hover:bg-muted text-foreground border-border/80"
                    }`}
                  >
                    {exp.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="reg-qualification" className="text-xs font-bold text-foreground">
                المؤهل العلمي / الشهادة
              </Label>
              <Input
                id="reg-qualification"
                placeholder="مثال: بكالوريوس تربية / ماجستير العلوم"
                className="h-11 text-sm rounded-xl border-border/80 bg-background"
                {...register("qualification")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-title" className="text-xs font-bold text-foreground">
                المسمى الوظيفي
              </Label>
              <Input
                id="reg-title"
                placeholder="مثال: كبير معلمي الفيزياء للثانوية العامة"
                className="h-11 text-sm rounded-xl border-border/80 bg-background"
                {...register("specialization")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-bio" className="text-xs font-bold text-foreground">
              نبذة تعريفية للطلاب (Bio)
            </Label>
            <Textarea
              id="reg-bio"
              rows={3}
              placeholder="اكتب نبذة مختصرة تعرّف بها الطلاب بخبرتك وسنوات تدريسك وأسلوبك الشيق في توصيل المعلومة..."
              className="text-sm rounded-xl border-border/80 resize-none bg-background"
              {...register("bio")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
