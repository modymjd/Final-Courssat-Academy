import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Layout from "@/components/layout/Layout";
import { useCreateExam, useUpdateExam, useExamDetails } from "@/features/exams";
import { useCourse } from "@/features/courses/hooks";
import { useInstructorCourses } from "@/features/instructor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Plus,
  Settings,
  FileQuestion,
  CheckCircle,
  ShieldAlert,
  Sparkles,
  FileCode,
  BookOpenCheck,
  Edit,
  ArrowRight,
  GraduationCap,
  Layers,
  BookOpen,
  Check,
  ImageIcon,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { QuestionBankImportModal } from "@/components/instructor/QuestionBankImportModal";
import type { ImportedExamJson } from "@/features/exams/jsonImport";
import {
  STAGE_LABELS,
  GRADE_LABELS,
  TRACK_LABELS,
  SUBJECT_LABELS,
  BRANCH_LABELS,
  getGradesForStage,
  getTracksForGrade,
  getSubjectsForTarget,
  getBranchesForSubject,
} from "@/lib/curriculumData";
import type {
  EducationalStage,
  EducationalGrade,
  EducationalTrack,
  CourseSubject,
  SubjectBranch,
} from "@/types/curriculum";
import http from "@/lib/http";

const optionSchema = z.object({
  text: z.string().optional().default(""),
  isCorrect: z.boolean().optional().default(false),
});

const questionSchema = z
  .object({
    text: z.string().min(1, "يرجى كتابة نص السؤال"),
    imageUrl: z.string().optional().default(""),
    type: z.enum(["multiple_choice", "true_false", "essay"]).default("multiple_choice"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    points: z.number().min(1, "الدرجة يجب أن تكون 1 على الأقل").default(5),
    explanation: z.string().optional().default(""),
    options: z.array(optionSchema).optional().default([]),
  })
  .superRefine((question, ctx) => {
    if (question.type === "multiple_choice") {
      const nonEmpty = question.options.filter((option) => option.text.trim());
      if (nonEmpty.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "يجب إدخال خيارين على الأقل." });
      }
      if (nonEmpty.filter((option) => option.isCorrect).length !== 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "يجب تحديد إجابة صحيحة واحدة فقط." });
      }
    }
    if (question.type === "true_false" && question.options.filter((option) => option.text.trim()).length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "سؤال الصواب والخطأ يحتاج إلى خيارين." });
    }
    if (question.type === "true_false" && question.options.filter((option) => option.isCorrect).length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "يجب تحديد صواب أو خطأ كإجابة صحيحة واحدة.",
      });
    }
  });

const examSchema = z.object({
  title: z.string().min(2, "عنوان الاختبار مطلوب (حرفان على الأقل)"),
  description: z.string().optional().default(""),
  examType: z.enum(["EXAM", "PRACTICE", "ASSIGNMENT"]).default("EXAM"),
  startTime: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  durationMinutes: z.number().min(1, "أقل مدة هي دقيقة واحدة").default(45),
  passThreshold: z.number().min(0).max(100).default(50),
  attemptsAllowed: z.number().min(1).default(1),
  strictProctoring: z.boolean().default(true),
  randomizeQuestions: z.boolean().default(false),
  targetingMode: z.enum(["course", "standalone"]).default("course"),
  selectedCourseId: z.number().nullable().optional(),
  selectedLessonId: z.number().nullable().optional(),
  selectedUnitId: z.number().nullable().optional(),
  educationalStage: z.string().optional().default(""),
  educationalGrade: z.string().optional().default(""),
  educationalTrack: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  subjectBranch: z.string().optional().default(""),
  isPublished: z.boolean().default(true),
  questions: z.array(questionSchema).min(1, "يجب إضافة سؤال واحد على الأقل"),
}).superRefine((exam, ctx) => {
  if (exam.startTime && exam.endTime && new Date(exam.endTime) <= new Date(exam.startTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "آخر موعد للتسليم يجب أن يكون بعد موعد بدء الإتاحة.",
    });
  }
});

type ExamFormValues = z.infer<typeof examSchema>;

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180];
const PASS_THRESHOLD_PRESETS = [50, 60, 70, 75, 85];
const ATTEMPTS_PRESETS = [
  { label: "محاولة واحدة", value: 1 },
  { label: "محاولتان", value: 2 },
  { label: "3 محاولات", value: 3 },
  { label: "غير محدود", value: 999 },
];
const POINT_PRESETS = [1, 2, 3, 5, 10];

const AI_PROMPT_TEMPLATE = `أنت مصمم امتحانات تعليمية خبير في منصة EduSmart.
يرجى توليد امتحان بالشرح والبرهان العلمي بصيغة JSON النظيفة والدقيقة بدون أي مقدمات أو كلام خارج الـ JSON.

استخدم الهيكل الإملائي والدقيق التالي بالضبط:

{
  "title": "اسم الاختبار أو المراجعة الشاملة",
  "description": "وصف الاختبار والتعليمات العامة للطلاب",
  "examType": "PRACTICE",
  "durationMinutes": 45,
  "questions": [
    {
      "text": "نص السؤال الأول هنا؟",
      "type": "multiple_choice",
      "difficulty": "MEDIUM",
      "points": 5,
      "explanation": "البرهان والتفسير العلمي المفصل للحل والإجابة الصحيحة",
      "options": [
        { "text": "الخيار الأول (الإجابة الصحيحة)", "isCorrect": true },
        { "text": "الخيار الثاني", "isCorrect": false },
        { "text": "الخيار الثالث", "isCorrect": false },
        { "text": "الخيار الرابع", "isCorrect": false }
      ]
    },
    {
      "text": "الماء يغلي عند 100 درجة مئوية تحت الضغط الجوي العادي",
      "type": "true_false",
      "difficulty": "EASY",
      "points": 5,
      "explanation": "درجة غليان الماء النقي هي 100 مئوية عند 1 ضغط جوي",
      "options": [
        { "text": "صواب", "isCorrect": true },
        { "text": "خطأ", "isCorrect": false }
      ]
    }
  ]
}`;

export default function InstructorExamBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editExamId = searchParams.get("id") ? parseInt(searchParams.get("id")!, 10) : null;
  const isEditMode = Boolean(editExamId && !isNaN(editExamId) && editExamId > 0);
  const initialCourseId = searchParams.get("course_id") ? parseInt(searchParams.get("course_id")!, 10) : null;
  const initialLessonId = searchParams.get("lesson_id") ? parseInt(searchParams.get("lesson_id")!, 10) : null;
  const initialUnitId = searchParams.get("unit_id") ? parseInt(searchParams.get("unit_id")!, 10) : null;

  const { toast } = useToast();
  const { mutate: createExam, isPending: isCreating } = useCreateExam();
  const { mutate: updateExamMutation, isPending: isUpdating } = useUpdateExam();
  const { data: existingExam, isLoading: isLoadingExisting } = useExamDetails(editExamId || 0);
  const { data: rawInstructorCourses } = useInstructorCourses();

  const isSaving = isCreating || isUpdating;

  const instructorCourses: any[] = Array.isArray(rawInstructorCourses)
    ? rawInstructorCourses
    : (rawInstructorCourses as any)?.results || [];

  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);
  const [uploadingQuestionIndex, setUploadingQuestionIndex] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      examType: "EXAM",
      startTime: "",
      endTime: "",
      durationMinutes: 45,
      passThreshold: 50,
      attemptsAllowed: 1,
      strictProctoring: true,
      randomizeQuestions: false,
      targetingMode: initialCourseId ? "course" : "course",
      selectedCourseId: initialCourseId || null,
      selectedLessonId: initialLessonId || null,
      selectedUnitId: initialUnitId || null,
      educationalStage: "",
      educationalGrade: "",
      educationalTrack: "",
      subject: "",
      subjectBranch: "",
      isPublished: true,
      questions: [
        {
          text: "",
          type: "multiple_choice",
          difficulty: "MEDIUM",
          points: 5,
          explanation: "",
          imageUrl: "",
          options: [
            { text: "", isCorrect: true },
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
          ],
        },
      ],
    },
  });

  const { fields: questions, append: addQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: "questions",
  });

  const watchedTargetingMode = watch("targetingMode");
  const watchedCourseId = watch("selectedCourseId");
  const watchedUnitId = watch("selectedUnitId");
  const watchedStage = watch("educationalStage") as EducationalStage;
  const watchedGrade = watch("educationalGrade") as EducationalGrade;
  const watchedTrack = watch("educationalTrack") as EducationalTrack;
  const watchedSubject = watch("subject") as CourseSubject;
  const watchedDuration = watch("durationMinutes");
  const watchedPassThreshold = watch("passThreshold");
  const watchedAttempts = watch("attemptsAllowed");
  const watchedExamType = watch("examType");

  // The instructor course list is a summary endpoint and intentionally does not
  // hydrate curriculum. Fetch the full detail only for the selected course so
  // unit/lesson targeting works without creating an N+1 query pattern.
  const {
    data: selectedCourseDetail,
    isLoading: isLoadingSelectedCourse,
  } = useCourse(watchedCourseId ?? 0);
  const selectedCourse = selectedCourseDetail ?? instructorCourses.find((c) => c.id === watchedCourseId);
  const selectedUnit = selectedCourse?.modules?.find((module: any) => module.id === watchedUnitId);
  const availableLessons = selectedUnit?.lessons || [];

  // Cascading options for standalone mode
  const availableGrades = getGradesForStage(watchedStage);
  const availableTracks = getTracksForGrade(watchedStage, watchedGrade);
  const availableSubjects = getSubjectsForTarget(watchedStage, watchedGrade, watchedTrack);
  const availableBranches = getBranchesForSubject(watchedStage, watchedGrade, watchedSubject);

  // Auto-set targeting if editing existing exam
  useEffect(() => {
    if (isEditMode && existingExam) {
      const rawQuestions = existingExam.questions || [];
      const mappedQuestions =
        rawQuestions.length > 0
          ? rawQuestions.map((q) => {
              const rawOpts = Array.isArray(q.options) ? q.options : [];
              let normalizedOpts: { text: string; isCorrect: boolean }[] = [];

              if (q.type === "multiple_choice") {
                normalizedOpts = rawOpts.map((o) =>
                  typeof o === "string"
                    ? { text: o, isCorrect: false }
                    : { text: o.text || "", isCorrect: Boolean(o.isCorrect) }
                );
                while (normalizedOpts.length < 4) {
                  normalizedOpts.push({ text: "", isCorrect: false });
                }
                if (!normalizedOpts.some((o) => o.isCorrect)) {
                  normalizedOpts[0].isCorrect = true;
                }
              } else if (q.type === "true_false") {
                const trueOpt = rawOpts.find(
                  (o) => typeof o === "object" && (o.text === "صواب" || o.text === "true" || o.text === "صح")
                );
                const falseOpt = rawOpts.find(
                  (o) => typeof o === "object" && (o.text === "خطأ" || o.text === "false")
                );
                const isFalseCorrect = Boolean(falseOpt && typeof falseOpt === "object" && falseOpt.isCorrect);
                normalizedOpts = [
                  { text: "صواب", isCorrect: !isFalseCorrect },
                  { text: "خطأ", isCorrect: isFalseCorrect },
                ];
              } else {
                normalizedOpts = [];
              }

              const rawType = String(q.type || "multiple_choice").toLowerCase();
              const qType: "multiple_choice" | "true_false" | "essay" =
                rawType === "true_false" ? "true_false" : rawType === "essay" ? "essay" : "multiple_choice";

              return {
                text: q.text || "",
                type: qType,
                difficulty: (q.difficulty || "MEDIUM") as "EASY" | "MEDIUM" | "HARD",
                points: Number(q.points) || 5,
                explanation: q.explanation || "",
                imageUrl: q.imageUrl || q.image_url || "",
                options: normalizedOpts,
              };
            })
          : [
              {
                text: "",
                type: "multiple_choice" as const,
                difficulty: "MEDIUM" as const,
                points: 5,
                explanation: "",
                imageUrl: "",
                options: [
                  { text: "", isCorrect: true },
                  { text: "", isCorrect: false },
                  { text: "", isCorrect: false },
                  { text: "", isCorrect: false },
                ],
              },
            ];

      const rawExamType = existingExam.examType || existingExam.exam_type;
      const examTypeVal =
        rawExamType === "PRACTICE" || rawExamType === "ASSIGNMENT" ? rawExamType : "EXAM";

      const toLocalDateTimeInput = (value?: string | null) => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const offsetMs = date.getTimezoneOffset() * 60_000;
        return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
      };

      const hasCourse = Boolean(existingExam.course);

      reset({
        title: existingExam.title || "",
        description: existingExam.description || "",
        examType: examTypeVal,
        startTime: toLocalDateTimeInput(existingExam.startTime || existingExam.start_time),
        endTime: toLocalDateTimeInput(existingExam.endTime || existingExam.end_time),
        durationMinutes: Number(existingExam.durationMinutes ?? existingExam.duration_minutes ?? 45),
        passThreshold: Number(existingExam.passThreshold ?? existingExam.pass_threshold ?? 50),
        attemptsAllowed: Number(
          existingExam.attemptsAllowed ??
          existingExam.attempts_allowed ??
          existingExam.maxAttempts ??
          existingExam.max_attempts ??
          1
        ),
        strictProctoring: Number(existingExam.tabSwitchLimit ?? existingExam.tab_switch_limit ?? 3) > 0,
        randomizeQuestions: Boolean(existingExam.shuffleQuestions || existingExam.shuffle_questions),
        targetingMode: hasCourse ? "course" : "standalone",
        selectedCourseId: existingExam.course || null,
        selectedLessonId: existingExam.lesson || null,
        selectedUnitId: existingExam.unit || null,
        educationalStage: existingExam.educationalStage || existingExam.educational_stage || "",
        educationalGrade: existingExam.educationalGrade || existingExam.educational_grade || "",
        educationalTrack: existingExam.educationalTrack || existingExam.educational_track || "",
        subject: existingExam.subject || "",
        subjectBranch: existingExam.subjectBranch || existingExam.subject_branch || "",
        isPublished: Boolean(existingExam.isPublished ?? existingExam.is_published ?? true),
        questions: mappedQuestions,
      });
    }
  }, [isEditMode, existingExam, reset]);

  const setCorrectOption = (qIndex: number, optIndex: number) => {
    const currentOptions = watch(`questions.${qIndex}.options`) || [];
    const updated = currentOptions.map((opt, idx) => ({
      ...opt,
      isCorrect: idx === optIndex,
    }));
    setValue(`questions.${qIndex}.options`, updated, { shouldDirty: true });
  };

  const setTrueFalseAnswer = (qIndex: number, choice: "صواب" | "خطأ") => {
    setValue(
      `questions.${qIndex}.options`,
      [
        { text: "صواب", isCorrect: choice === "صواب" },
        { text: "خطأ", isCorrect: choice === "خطأ" },
      ],
      { shouldDirty: true, shouldTouch: true, shouldValidate: true }
    );
  };

  const handleQuestionImageUpload = async (questionIndex: number, file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "صيغة الصورة غير مدعومة",
        description: "استخدم صورة JPG أو PNG أو WebP فقط.",
        variant: "destructive",
      });
      return;
    }

    setUploadingQuestionIndex(questionIndex);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await http.post<{
        url: string;
        format: string;
        width: number;
        height: number;
        size_bytes: number;
      }>("/assessments/questions/upload-image/", formData);

      if (!response.data?.url) {
        throw new Error("لم يرجع الخادم رابط الصورة.");
      }

      setValue(`questions.${questionIndex}.imageUrl`, response.data.url, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast({
        title: "تم تجهيز صورة السؤال",
        description: "حُوّلت الصورة إلى WebP وضُغطت بنجاح.",
      });
    } catch (error: any) {
      toast({
        title: "تعذر رفع صورة السؤال",
        description:
          error?.response?.data?.detail ||
          error?.message ||
          "تأكد أن الصورة سليمة وحجمها أقل من 10 ميجابايت.",
        variant: "destructive",
      });
    } finally {
      setUploadingQuestionIndex(null);
    }
  };

  const handleGenerateTitle = () => {
    if (watchedTargetingMode === "course" && selectedCourse) {
      setValue("title", `اختبار تقييمي: ${selectedCourse.title}`, { shouldValidate: true });
      toast({ title: "تم توليد العنوان المقترح بنجاح! ✨" });
    } else if (watchedTargetingMode === "standalone" && watchedSubject) {
      const subName = SUBJECT_LABELS[watchedSubject] || watchedSubject;
      const grName = GRADE_LABELS[watchedGrade] || "";
      const trName = watchedTrack ? ` (${TRACK_LABELS[watchedTrack] || watchedTrack})` : "";
      setValue("title", `اختبار مادة ${subName} - ${grName}${trName}`, { shouldValidate: true });
      toast({ title: "تم توليد العنوان المقترح بنجاح! ✨" });
    } else {
      setValue("title", "اختبار شامل في المنهج الأكاديمي", { shouldValidate: true });
    }
  };

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    toast({
      title: "تم نسخ البرومبت بنجاح! 📋",
      description: "قم بلصق البرومبت في الذكاء الاصطناعي لتوليد الامتحان بصيغة JSON مباشرة.",
    });
  };

  const handleQuestionBankImportSuccess = (count: number, importedQuestions?: any[], importedExam?: ImportedExamJson) => {
    if (Array.isArray(importedQuestions) && importedQuestions.length > 0) {
      const formatted = importedQuestions.map((q: any) => {
        const rawType = String(q.question_type || q.type || "multiple_choice").toLowerCase();
        const correctAnswer = String(q.correct_answer ?? q.correctAnswer ?? "").trim().toLowerCase();
        let opts = [];

        if (rawType === "true_false") {
          const options = Array.isArray(q.options) ? q.options : [];
          const falseOpt = options.find((o: any) => {
            const text = typeof o === "string" ? o : o?.text || "";
            const explicitCorrect = typeof o === "object"
              ? (o.is_correct === true || o.isCorrect === true)
              : false;
            return text.trim().toLowerCase() === "خطأ" && (explicitCorrect || correctAnswer === "خطأ" || correctAnswer === "false" || correctAnswer === "0");
          });
          const isFalseCorrect = Boolean(falseOpt);
          opts = [
            { text: "صواب", isCorrect: !isFalseCorrect },
            { text: "خطأ", isCorrect: isFalseCorrect },
          ];
        } else if (rawType === "multiple_choice") {
          opts = Array.isArray(q.options)
            ? q.options.map((opt: any) => {
                const text = typeof opt === "string" ? opt : opt?.text || "";
                const explicitCorrect =
                  typeof opt === "object" && (opt.is_correct === true || opt.isCorrect === true);
                return {
                  text,
                  isCorrect: explicitCorrect || text.trim().toLowerCase() === correctAnswer,
                };
              })
            : [];

          if (!opts.some((o: any) => o.isCorrect) && opts.length > 0 && !correctAnswer) {
            opts[0].isCorrect = true;
          }
        }

        return {
          text: q.question_text || q.text || "سؤال جديد",
          type: (rawType === "true_false" ? "true_false" : rawType === "essay" ? "essay" : "multiple_choice") as any,
          difficulty: (q.difficulty || "MEDIUM") as any,
          points: Number(q.points || 5),
          explanation: q.explanation || "",
          imageUrl: q.image_url || q.imageUrl || "",
          options: opts,
        };
      });

      const currentQuestions = watch("questions") || [];
      const isSingleEmptyQuestion = currentQuestions.length === 1 && !currentQuestions[0].text;
      if (isSingleEmptyQuestion) {
        setValue("questions", formatted, { shouldDirty: true, shouldValidate: true });
      } else {
        setValue("questions", [...currentQuestions, ...formatted], { shouldDirty: true, shouldValidate: true });
      }

      if (importedExam) {
        setValue("title", importedExam.title, { shouldDirty: true, shouldValidate: true });
        setValue("description", importedExam.description, { shouldDirty: true });
        setValue("examType", importedExam.examType, { shouldDirty: true });
        setValue("durationMinutes", importedExam.durationMinutes, { shouldDirty: true });
      }

      toast({
        title: "تم إضافة الأسئلة للنموذج بنجاح 📋",
        description: `تم إدراج ${formatted.length} سؤالاً في نموذج الامتحان الحالي.`,
      });
    }
  };

  const onSubmit = (data: ExamFormValues) => {
    const formattedQuestions = data.questions.map((q) => {
      let opts = q.options || [];
      if (q.type === "multiple_choice") {
        const nonEmpty = opts.filter((o) => o.text && o.text.trim().length > 0);
        opts =
          nonEmpty.length > 0
            ? nonEmpty
            : [
                { text: "خيار 1", isCorrect: true },
                { text: "خيار 2", isCorrect: false },
              ];
        if (!opts.some((o) => o.isCorrect)) {
          opts[0].isCorrect = true;
        }
      } else if (q.type === "true_false") {
        const isFalseCorrect = opts.length >= 2 && opts[1]?.text === "خطأ" && Boolean(opts[1]?.isCorrect);
        opts = [
          { text: "صواب", isCorrect: !isFalseCorrect },
          { text: "خطأ", isCorrect: isFalseCorrect },
        ];
      } else {
        opts = [];
      }

      return {
        text: q.text.trim(),
        type: q.type.toUpperCase(),
        difficulty: q.difficulty,
        points: Number(q.points) || 5,
        explanation: q.explanation?.trim() || "",
        image_url: q.imageUrl?.trim() || "",
        options: opts,
      };
    });

    const payload: any = {
      title: data.title.trim(),
      description: data.description?.trim() || "",
      exam_type: data.examType,
      start_time: data.startTime ? new Date(data.startTime).toISOString() : null,
      end_time: data.endTime ? new Date(data.endTime).toISOString() : null,
      duration_minutes: Number(data.durationMinutes) || 45,
      pass_threshold: Number(data.passThreshold),
      attempts_allowed: Number(data.attemptsAllowed) || 1,
      is_published: Boolean(data.isPublished),
      shuffle_questions: Boolean(data.randomizeQuestions),
      tab_switch_limit: data.strictProctoring ? 3 : 0,
      require_camera: false,
      quiz_question_count: formattedQuestions.length,
      questions: formattedQuestions,
    };

    // The selected context is the source of truth. The backend also enforces this mapping.
    if (data.targetingMode === "course" && data.selectedCourseId) {
      payload.kind = data.selectedLessonId ? "LESSON_QUIZ" : data.selectedUnitId ? "UNIT_EXAM" : "GENERAL_EXAM";
      payload.course = data.selectedCourseId;
      payload.unit = data.selectedUnitId || null;
      payload.lesson = data.selectedLessonId || null;
    } else {
      payload.course = null;
      payload.lesson = null;
      payload.unit = null;
      payload.kind = "GENERAL_EXAM";
      payload.educational_stage = data.educationalStage || "";
      payload.educational_grade = data.educationalGrade || "";
      payload.educational_track = data.educationalTrack || "";
      payload.subject = data.subject || "";
      payload.subject_branch = data.subjectBranch || "";
    }

    if (isEditMode && editExamId) {
      updateExamMutation(
        { examId: editExamId, data: payload },
        {
          onSuccess: () => {
            toast({
              title: "تم تحديث الاختبار بنجاح! 🚀",
              description: `تم حفظ تعديلات امتحان "${payload.title}" بنجاح.`,
            });
            navigate("/instructor/exams");
          },
          onError: (err: any) => {
            toast({
              title: "تعذر تحديث الاختبار",
              description: err?.response?.data?.detail || err?.message || "حدث خطأ غير متوقع أثناء تحديث الاختبار.",
              variant: "destructive",
            });
          },
        }
      );
    } else {
      createExam(payload, {
        onSuccess: () => {
          toast({
            title: "تم حفظ الاختبار بنجاح! 🚀",
            description: payload.is_published
              ? `تم نشر امتحان "${payload.title}" وإتاحته للطلاب.`
              : `تم حفظ امتحان "${payload.title}" كمسودة بنجاح.`,
          });
          navigate("/instructor/exams");
        },
        onError: (err: any) => {
          toast({
            title: "تعذر حفظ الاختبار",
            description: err?.response?.data?.detail || err?.message || "حدث خطأ غير متوقع أثناء حفظ ونشر الاختبار.",
            variant: "destructive",
          });
        },
      });
    }
  };

  const onInvalid = (formErrors: any) => {
    let errorMsg = "يرجى مراجعة البيانات المدخلة؛ توجد حقول غير مكتملة.";
    if (formErrors.title?.message) {
      errorMsg = formErrors.title.message;
    } else if (formErrors.durationMinutes?.message) {
      errorMsg = formErrors.durationMinutes.message;
    } else if (formErrors.questions?.message) {
      errorMsg = formErrors.questions.message;
    }
    toast({
      title: "تنبيه: تعذر حفظ الاختبار",
      description: errorMsg,
      variant: "destructive",
    });
  };

  if (isEditMode && isLoadingExisting) {
    return (
      <Layout>
        <div className="container mx-auto py-8 px-4 max-w-5xl animate-pulse space-y-6 dir-rtl" dir="rtl">
          <div className="h-28 bg-muted rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-44 bg-muted rounded-xl" />
              <div className="h-64 bg-muted rounded-xl" />
            </div>
            <div className="h-80 bg-muted rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-5xl dir-rtl" dir="rtl">
        {/* Header & AI Import Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/instructor/exams")}
                className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1 -mr-2"
              >
                <ArrowRight size={16} /> العودة للامتحانات
              </Button>
              {isEditMode && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  وضع التعديل
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              {isEditMode ? (
                <Edit className="w-8 h-8 text-primary" />
              ) : (
                <BookOpenCheck className="w-8 h-8 text-primary" />
              )}
              {isEditMode ? "تعديل الاختبار والأسئلة" : "بناء امتحانات وتقييمات تفاعلية"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              صمم امتحانات رسمية أو مراجعات تفاعلية بالبرهان والشرح، مرتبطة بالدورات والمناهج المصرية بدقة.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyAiPrompt}
              className="gap-2 font-semibold shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              نسخ برومبت الذكاء الاصطناعي
            </Button>

            <Button
              type="button"
              onClick={() => setIsQuestionBankModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-sm"
            >
              <FileCode className="w-4 h-4" />
              استيراد أسئلة من JSON
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Section 1: Targeting Architecture (Course Bound vs Standalone) */}
              <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <GraduationCap className="text-primary w-5 h-5" />
                    استهداف الاختبار والارتباط الأكاديمي
                  </CardTitle>
                  <CardDescription className="text-xs">
                    اختر ما إذا كان هذا الاختبار ملحقاً بدورة تعليمية محددة أو اختباراً عاماً مستقلاً.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mode Selector Segmented Tabs */}
                  <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setValue("targetingMode", "course")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                        watchedTargetingMode === "course"
                          ? "bg-card text-primary shadow-xs border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <BookOpen size={16} />
                      مرتبط بدورة تعليمية (وراثة تلقائية)
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue("targetingMode", "standalone")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                        watchedTargetingMode === "standalone"
                          ? "bg-card text-primary shadow-xs border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Layers size={16} />
                      امتحان عام / مستقل (اختيار يدوي)
                    </button>
                  </div>

                  {/* Mode A: Course-Bound */}
                  {watchedTargetingMode === "course" && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">اختر الدورة التعليمية</Label>
                        <Controller
                          name="selectedCourseId"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ? String(field.value) : ""}
                              onValueChange={(val) => {
                                const id = val ? Number(val) : null;
                                field.onChange(id);
                                setValue("selectedLessonId", null);
                                setValue("selectedUnitId", null);
                              }}
                            >
                              <SelectTrigger className="h-11 rounded-xl text-sm">
                                <SelectValue placeholder="اختر من دوراتك المسجلة..." />
                              </SelectTrigger>
                              <SelectContent>
                                {instructorCourses.map((c) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">الوحدة (اختياري)</Label>
                          <Controller
                            name="selectedUnitId"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value ? String(field.value) : ""}
                                onValueChange={(val) => { field.onChange(val ? Number(val) : null); setValue("selectedLessonId", null); }}
                                disabled={!selectedCourse || isLoadingSelectedCourse}
                              >
                                <SelectTrigger className="h-10 rounded-xl text-xs">
                                  <SelectValue placeholder={isLoadingSelectedCourse ? "جاري تحميل وحدات الدورة..." : "امتحان الدورة بالكامل"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {(selectedCourse?.modules || []).map((module: any) => (
                                    <SelectItem key={module.id} value={String(module.id)}>{module.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">الدرس (اختياري)</Label>
                          <Controller
                            name="selectedLessonId"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value ? String(field.value) : ""}
                                onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                                disabled={!selectedUnit || isLoadingSelectedCourse}
                              >
                                <SelectTrigger className="h-10 rounded-xl text-xs">
                                  <SelectValue placeholder={isLoadingSelectedCourse ? "جاري تحميل الدروس..." : "اختر درساً لربط كويز الدرس"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableLessons.map((lesson: any) => (
                                    <SelectItem key={lesson.id} value={String(lesson.id)}>{lesson.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>

                      {/* Course Inherited Curriculum Badge Card */}
                      {selectedCourse && (
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-primary">
                            <Sparkles size={14} />
                            تصنيف المنهج الموروث تلقائياً من الدورة:
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            {selectedCourse.educational_stage && (
                              <Badge variant="secondary" className="bg-primary/10 text-primary">
                                {STAGE_LABELS[selectedCourse.educational_stage as EducationalStage] || selectedCourse.educational_stage}
                              </Badge>
                            )}
                            {selectedCourse.educational_grade && (
                              <Badge variant="outline" className="border-primary/30">
                                {GRADE_LABELS[selectedCourse.educational_grade as EducationalGrade] || selectedCourse.educational_grade}
                              </Badge>
                            )}
                            {selectedCourse.educational_track && (
                              <Badge variant="outline">
                                {TRACK_LABELS[selectedCourse.educational_track] || selectedCourse.educational_track}
                              </Badge>
                            )}
                            {selectedCourse.subject && (
                              <Badge variant="secondary">
                                {SUBJECT_LABELS[selectedCourse.subject as CourseSubject] || selectedCourse.subject}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode B: Standalone Curriculum Cascading Selectors */}
                  {watchedTargetingMode === "standalone" && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">المرحلة التعليمية</Label>
                          <Controller
                            name="educationalStage"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  setValue("educationalGrade", "");
                                  setValue("educationalTrack", "");
                                  setValue("subject", "");
                                  setValue("subjectBranch", "");
                                }}
                              >
                                <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                  <SelectValue placeholder="اختر المرحلة" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(STAGE_LABELS) as [EducationalStage, string][]).map(([k, label]) => (
                                    <SelectItem key={k} value={k}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        {watchedStage && availableGrades.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">الصف الدراسي</Label>
                            <Controller
                              name="educationalGrade"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value || ""}
                                  onValueChange={(val) => {
                                    field.onChange(val);
                                    setValue("educationalTrack", "");
                                    setValue("subject", "");
                                    setValue("subjectBranch", "");
                                  }}
                                >
                                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                    <SelectValue placeholder="اختر الصف" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableGrades.map((g) => (
                                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      {/* Track and Subject Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {availableTracks.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">الشعبة / المسار التخصصي</Label>
                            <Controller
                              name="educationalTrack"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value || ""}
                                  onValueChange={(val) => {
                                    field.onChange(val);
                                    setValue("subject", "");
                                  }}
                                >
                                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                    <SelectValue placeholder="اختر الشعبة" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTracks.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}

                        {watchedGrade && availableSubjects.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">المادة الدراسية</Label>
                            <Controller
                              name="subject"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value || ""}
                                  onValueChange={(val) => {
                                    field.onChange(val);
                                    setValue("subjectBranch", "");
                                  }}
                                >
                                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                    <SelectValue placeholder="اختر المادة" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableSubjects.map((s) => (
                                      <SelectItem key={s} value={s}>{SUBJECT_LABELS[s] || s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      {/* Branch selector if applicable */}
                      {availableBranches.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">الفرع الدراسي</Label>
                          <Controller
                            name="subjectBranch"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || ""} onValueChange={field.onChange}>
                                <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                  <SelectValue placeholder="اختر الفرع (اختياري)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableBranches.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Basic Info Card */}
              <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Settings size={20} className="text-primary" />
                      بيانات وعنوان الاختبار
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateTitle}
                      className="text-primary hover:bg-primary/10 gap-1.5 text-xs font-bold h-8"
                    >
                      <Sparkles size={14} /> توليد عنوان تلقائي
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-semibold text-xs">عنوان الامتحان / المراجعة</Label>
                    <Input {...register("title")} placeholder="مثال: مراجعة وشرح قوانين الفيزياء الحديثة" className="mt-1 h-11 rounded-xl" />
                    {errors.title && <p className="text-destructive text-xs mt-1">{errors.title.message}</p>}
                  </div>

                  <div>
                    <Label className="font-semibold text-xs">الوصف والتعليمات العامة للطلاب</Label>
                    <Textarea {...register("description")} placeholder="تعليمات الاختبار وتوجيهات الحل للطلاب..." className="mt-1 rounded-xl" rows={3} />
                    {errors.description && <p className="text-destructive text-xs mt-1">{errors.description.message}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Question Builder List */}
              <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row justify-between items-center pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FileQuestion size={20} className="text-primary" />
                    الأسئلة والخيارات والبرهان العلمي ({questions.length})
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      addQuestion({
                        text: "",
                        type: "multiple_choice",
                        difficulty: "MEDIUM",
                        points: 5,
                        explanation: "",
                        imageUrl: "",
                        options: [
                          { text: "", isCorrect: true },
                          { text: "", isCorrect: false },
                          { text: "", isCorrect: false },
                          { text: "", isCorrect: false },
                        ],
                      })
                    }
                    className="gap-1.5 text-primary hover:bg-primary/10 border-primary/30 rounded-xl h-9 font-bold"
                  >
                    <Plus size={16} /> إضافة سؤال
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {questions.map((field, index) => {
                    const type = watch(`questions.${index}.type`);
                    const currentPoints = watch(`questions.${index}.points`);
                    const currentDifficulty = watch(`questions.${index}.difficulty`);
                    const currentImageUrl = watch(`questions.${index}.imageUrl`);

                    return (
                      <div key={field.id} className="p-5 border rounded-2xl bg-muted/20 relative space-y-4 shadow-xs border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                          className="absolute top-4 left-4 text-destructive hover:bg-destructive/10 h-8 px-2.5 rounded-lg text-xs"
                          disabled={questions.length <= 1}
                        >
                          <Trash2 size={14} className="ml-1" /> حذف
                        </Button>

                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="font-bold text-sm text-foreground">سؤال رقم {index + 1}</span>
                        </div>

                        {/* Controls: Type + Points Pills + Difficulty Badges */}
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          {/* Question Type Segmented Control */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-muted-foreground block">نوع السؤال</span>
                            <div className="flex items-center gap-1 p-1 bg-background rounded-xl border border-border">
                              <button
                                type="button"
                                onClick={() => setValue(`questions.${index}.type`, "multiple_choice")}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                  type === "multiple_choice" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                متعدد الخيارات
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`questions.${index}.type`, "true_false");
                                  setTrueFalseAnswer(index, "صواب");
                                }}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                  type === "true_false" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                صواب / خطأ
                              </button>
                              <button
                                type="button"
                                onClick={() => setValue(`questions.${index}.type`, "essay")}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                  type === "essay" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                مقالي
                              </button>
                            </div>
                          </div>

                          {/* Points Quick Pills */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-muted-foreground block">درجة السؤال</span>
                            <div className="flex items-center gap-1">
                              {POINT_PRESETS.map((pts) => (
                                <button
                                  key={pts}
                                  type="button"
                                  onClick={() => setValue(`questions.${index}.points`, pts)}
                                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                    currentPoints === pts
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary/20 shadow-xs"
                                      : "bg-background border border-border text-muted-foreground hover:border-primary/40"
                                  }`}
                                >
                                  {pts}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Difficulty Choice Badges */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-muted-foreground block">مستوى الصعوبة</span>
                            <div className="flex items-center gap-1">
                              {[
                                { val: "EASY", label: "سهل 🟢" },
                                { val: "MEDIUM", label: "متوسط 🟡" },
                                { val: "HARD", label: "صعب 🔴" },
                              ].map((d) => (
                                <button
                                  key={d.val}
                                  type="button"
                                  onClick={() => setValue(`questions.${index}.difficulty`, d.val as any)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    currentDifficulty === d.val
                                      ? "bg-muted text-foreground border-2 border-primary shadow-xs"
                                      : "bg-background border border-border text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Question Text */}
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">نص السؤال</Label>
                          <Textarea
                            {...register(`questions.${index}.text`)}
                            placeholder="اكتب نص السؤال هنا بدقة..."
                            className="bg-background rounded-xl text-sm"
                            rows={2}
                          />
                        </div>

                        {/* Optional question illustration */}
                        <div className="space-y-2 rounded-xl border border-dashed border-border bg-background/60 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ImageIcon size={17} className="text-primary" />
                              <div>
                                <Label className="text-xs font-bold">صورة توضيحية للسؤال (اختياري)</Label>
                                <p className="text-[11px] text-muted-foreground">
                                  JPG أو PNG أو WebP — تتحول تلقائيًا إلى WebP مضغوط.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                id={`question-image-${index}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={uploadingQuestionIndex !== null}
                                onChange={(event) => {
                                  void handleQuestionImageUpload(index, event.target.files?.[0]);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <Label
                                htmlFor={`question-image-${index}`}
                                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10 ${
                                  uploadingQuestionIndex !== null ? "pointer-events-none opacity-60" : ""
                                }`}
                              >
                                {uploadingQuestionIndex === index ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Upload size={15} />
                                )}
                                {uploadingQuestionIndex === index ? "جارٍ التحويل..." : currentImageUrl ? "تغيير الصورة" : "رفع صورة"}
                              </Label>
                              {currentImageUrl && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 gap-1 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() =>
                                    setValue(`questions.${index}.imageUrl`, "", {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    })
                                  }
                                >
                                  <X size={14} /> إزالة
                                </Button>
                              )}
                            </div>
                          </div>

                          {currentImageUrl && (
                            <img
                              src={currentImageUrl}
                              alt={`معاينة صورة السؤال ${index + 1}`}
                              className="max-h-72 w-auto max-w-full rounded-xl border border-border object-contain"
                            />
                          )}
                        </div>

                        {/* Options: Multiple Choice */}
                        {type === "multiple_choice" && (
                          <div className="space-y-2 pt-2">
                            <Label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                              <span>الخيارات (اضغط على الدائرة لتحديد الإجابة الصحيحة):</span>
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {[0, 1, 2, 3].map((optIdx) => {
                                const isCorrect = watch(`questions.${index}.options.${optIdx}.isCorrect`);
                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                                      isCorrect
                                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20"
                                        : "border-border bg-background"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setCorrectOption(index, optIdx)}
                                      className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                        isCorrect
                                          ? "border-emerald-600 bg-emerald-600 text-white"
                                          : "border-muted-foreground/40 hover:border-emerald-500"
                                      }`}
                                    >
                                      {isCorrect && <Check size={14} className="stroke-[3]" />}
                                    </button>
                                    <Input
                                      {...register(`questions.${index}.options.${optIdx}.text`)}
                                      placeholder={`الخيار ${optIdx + 1}`}
                                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 p-0"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Options: True / False */}
                        {type === "true_false" && (
                          <div className="space-y-2 pt-2">
                            <Label className="text-xs font-bold text-muted-foreground">الإجابة الصحيحة المعتمدة:</Label>
                            <div className="grid grid-cols-2 gap-3 max-w-sm">
                              {(() => {
                                const isFalseCorrect = Boolean(
                                  watch(`questions.${index}.options.1.isCorrect`)
                                );
                                const isTrueCorrect = !isFalseCorrect;
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setTrueFalseAnswer(index, "صواب")}
                                      className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 font-black text-sm transition-all ${
                                        isTrueCorrect
                                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/20"
                                          : "border-border bg-card text-muted-foreground hover:border-border/80"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className={`w-5 h-5 ${isTrueCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                                        <span>صواب (صح)</span>
                                      </div>
                                      {isTrueCorrect && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                          الإجابة الصحيحة ✓
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTrueFalseAnswer(index, "خطأ")}
                                      className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 font-black text-sm transition-all ${
                                        !isTrueCorrect
                                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-xs ring-2 ring-indigo-600/20"
                                          : "border-border bg-card text-muted-foreground hover:border-border/80"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className={`w-5 h-5 ${!isTrueCorrect ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`} />
                                        <span>خطأ</span>
                                      </div>
                                      {!isTrueCorrect && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                                          الإجابة الصحيحة ✓
                                        </span>
                                      )}
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Scientific Explanation / Proof */}
                        <div className="pt-2">
                          <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            البرهان والشرح العلمي التوضيحي (يظهر للطالب عند المراجعة)
                          </Label>
                          <Textarea
                            {...register(`questions.${index}.explanation`)}
                            placeholder="اكتب التفسير العلمي والخطوات التي توضح صحة الإجابة..."
                            className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-xs rounded-xl"
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Settings (Visual Choice Driven) */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <CheckCircle size={18} className="text-primary" /> إعدادات الاختبار
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Exam System Mode Pills */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-xs">نظام الامتحان</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setValue("examType", "EXAM")}
                        className={`p-3 rounded-xl border-2 text-start transition-all ${
                          watchedExamType === "EXAM"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="font-bold text-xs">امتحان تقييمي رسمي</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">تصحيح بعد التسليم ومراقبة صارمة</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue("examType", "PRACTICE")}
                        className={`p-3 rounded-xl border-2 text-start transition-all ${
                          watchedExamType === "PRACTICE"
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="font-bold text-xs">مراجعة وتدريب تفاعلي</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">إظهار الشرح والبرهان بعد كل إجابة مباشرة</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue("examType", "ASSIGNMENT")}
                        className={`p-3 rounded-xl border-2 text-start transition-all ${
                          watchedExamType === "ASSIGNMENT"
                            ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="font-bold text-xs">واجب بنظام الأسئلة</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">يحلّه الطالب مثل الاختبار ويمكن ربط نجاحه بفتح الحصة التالية</div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-semibold text-xs">فترة الإتاحة والتسليم</Label>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="startTime" className="text-[11px] text-muted-foreground">متاح من (اختياري)</Label>
                        <Input id="startTime" type="datetime-local" {...register("startTime")} className="mt-1 h-10 rounded-xl text-xs" />
                      </div>
                      <div>
                        <Label htmlFor="endTime" className="text-[11px] text-muted-foreground">آخر موعد للتسليم (اختياري)</Label>
                        <Input id="endTime" type="datetime-local" {...register("endTime")} className="mt-1 h-10 rounded-xl text-xs" />
                        {errors.endTime && <p className="text-[11px] text-destructive mt-1">{errors.endTime.message}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Duration Quick Choice Pills */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-xs">المدة الزمنية (بالدقائق)</Label>
                      <span className="text-xs font-mono font-bold text-primary">{watchedDuration} دقيقة</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_PRESETS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setValue("durationMinutes", m)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            watchedDuration === m
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          }`}
                        >
                          {m} د
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pass Threshold Choice Pills */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-xs">نسبة النجاح المطلوبة (%)</Label>
                      <span className="text-xs font-mono font-bold text-primary">{watchedPassThreshold}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PASS_THRESHOLD_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setValue("passThreshold", p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            watchedPassThreshold === p
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Allowed Attempts Pills */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-xs">عدد المحاولات المسموح بها</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ATTEMPTS_PRESETS.map((att) => (
                        <button
                          key={att.value}
                          type="button"
                          onClick={() => setValue("attemptsAllowed", att.value)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                            watchedAttempts === att.value
                              ? "border-primary bg-primary/10 text-primary shadow-xs"
                              : "border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {att.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options: Publishing & Proctoring */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                      <div>
                        <span className="text-xs font-bold">حالة النشر الفوري</span>
                        <p className="text-[11px] text-muted-foreground">إتاحة الامتحان للطلاب بعد الحفظ</p>
                      </div>
                      <Switch
                        checked={Boolean(watch("isPublished"))}
                        onCheckedChange={(val) => setValue("isPublished", val)}
                      />
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-muted/30">
                      <input type="checkbox" {...register("strictProctoring")} className="mt-1 w-4 h-4 accent-primary" />
                      <div>
                        <span className="text-xs font-bold flex items-center gap-1 text-rose-600">
                          <ShieldAlert size={14} /> وضع المراقبة الصارمة
                        </span>
                        <p className="text-[11px] text-muted-foreground">تتبع تبديل النوافذ ومنع النسخ وتعتيم الشاشة.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-muted/30">
                      <input type="checkbox" {...register("randomizeQuestions")} className="mt-1 w-4 h-4 accent-primary" />
                      <div>
                        <span className="text-xs font-bold">ترتيب عشوائي للأسئلة</span>
                        <p className="text-[11px] text-muted-foreground">عرض الأسئلة بترتيب مختلف لكل طالب.</p>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Button
                type="submit"
                size="lg"
                className="w-full text-base h-13 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-lg transition-all duration-200 gap-2"
                disabled={isSaving}
              >
                {isSaving
                  ? "جاري الحفظ..."
                  : isEditMode
                  ? "تحديث وحفظ التعديلات 💾"
                  : watch("isPublished")
                  ? "نشر الاختبار الآن 🚀"
                  : "حفظ الاختبار كمسودة 💾"}
              </Button>
            </div>
          </div>
        </form>

        {/* Question Bank Import Modal with Dry-Run and Atomic Transaction */}
        <QuestionBankImportModal
          isOpen={isQuestionBankModalOpen}
          onClose={() => setIsQuestionBankModalOpen(false)}
          examId={editExamId || undefined}
          persistToExam={false}
          onImportSuccess={handleQuestionBankImportSuccess}
        />
      </div>
    </Layout>
  );
}
