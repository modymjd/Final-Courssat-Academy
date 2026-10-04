import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import {
  useCourse,
  useCategories,
  useCreateCourse,
  useUpdateCourse,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useVideos,
  useCreateLessonSummary,
  useUpdateLessonSummary,
} from "@/features/courses/hooks";
import type {
  Module,
  Lesson,
  VideoAsset,
  EducationalGrade,
  EducationalStage,
  CourseSubject,
  EducationalTrack,
  SubjectBranch,
} from "@/types/course";
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
import { ChunkedVideoUploader } from "@/components/video/ChunkedVideoUploader";

import http from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Video as VideoIcon,
  FileText,
  Save,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  Film,
  Paperclip,
  MoreVertical,
  ImageIcon,
  Sparkles,
  BookOpen,
  FileQuestion,
  GraduationCap,
  Edit,
  Upload,
  X,
  Check,
  Camera,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useCourseInstructorExams, useTogglePublishExam, useDeleteExam } from "@/features/exams";
import { useToast } from "@/components/ui/use-toast";

const EDUCATIONAL_STAGES: Array<{ value: EducationalStage; label: string }> = [
  { value: "primary", label: "المرحلة الابتدائية" },
  { value: "prep", label: "المرحلة الإعدادية" },
  { value: "secondary", label: "المرحلة الثانوية العامة" },
  { value: "baccalaureate", label: "نظام البكالوريا المصرية (IB/EB)" },
  { value: "university", label: "المرحلة الجامعية" },
];

export const InstructorCourseBuilder: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const isNew = !courseId || courseId === "new";
  const numCourseId = isNew ? 0 : parseInt(courseId ?? "", 10);
  const hasInvalidCourseId = !isNew && (!Number.isInteger(numCourseId) || numCourseId <= 0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: course, isLoading: isLoadingCourse, error: courseError } = useCourse(numCourseId);
  const { data: categories = [] } = useCategories();

  const createCourseMutation = useCreateCourse();
  const updateCourseMutation = useUpdateCourse(numCourseId);
  const courseCreationIdempotencyKeyRef = useRef<string | null>(null);
  const createModuleMutation = useCreateModule(numCourseId);
  const updateModuleMutation = useUpdateModule(numCourseId);
  const deleteModuleMutation = useDeleteModule(numCourseId);
  const createLessonMutation = useCreateLesson(numCourseId);
  const updateLessonMutation = useUpdateLesson(numCourseId);
  const deleteLessonMutation = useDeleteLesson(numCourseId);
  const createSummaryMutation = useCreateLessonSummary();
  const updateSummaryMutation = useUpdateLessonSummary();
  const { data: courseExams = [], isLoading: isLoadingExams } = useCourseInstructorExams(numCourseId);
  const togglePublishExamMutation = useTogglePublishExam();
  const deleteExamMutation = useDeleteExam();

  const [activeTab, setActiveTab] = useState<string>("meta");

  // Course Basic Fields
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [educationalStage, setEducationalStage] = useState<EducationalStage | undefined>(undefined);
  const [educationalGrade, setEducationalGrade] = useState<EducationalGrade | undefined>(undefined);
  const [educationalTrack, setEducationalTrack] = useState<EducationalTrack | undefined>(undefined);
  const [subject, setSubject] = useState<CourseSubject | undefined>(undefined);
  const [subjectBranch, setSubjectBranch] = useState<SubjectBranch | undefined>(undefined);
  const [price, setPrice] = useState<number>(0);
  const [isFree, setIsFree] = useState(false);
  const [enforceQuizGate, setEnforceQuizGate] = useState(true);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const getFieldClass = (name: string, baseClass = "") => {
    if (fieldErrors[name]) {
      return `${baseClass} border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10 focus:border-rose-500 focus:ring-rose-500/30 transition-all duration-200`;
    }
    return baseClass;
  };

  // Course Cover Upload State
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Inline Module Management State (Zero Modals)
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");

  // Inline Progressive Lesson Studio State (Zero Modals)
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<"video" | "article" | "quiz" | "assignment">("video");
  const [lessonDuration, setLessonDuration] = useState("10:00");
  const [lessonIsFree, setLessonIsFree] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryPdf, setSummaryPdf] = useState<File | null>(null);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [hasVideoUploadSession, setHasVideoUploadSession] = useState(false);
  const [isLessonStudioMinimized, setIsLessonStudioMinimized] = useState(false);

  // The video library can be large; defer loading it until the lesson studio is actually opened.
  // Keep this hook below activeModuleId declaration to avoid temporal-dead-zone runtime errors.
  const shouldLoadVideoLibrary = activeModuleId !== null;
  const { data: videoAssets = [] } = useVideos(undefined, shouldLoadVideoLibrary);

  // Cascading options derived from curriculum taxonomy
  const availableGrades = educationalStage ? getGradesForStage(educationalStage) : [];
  const availableTracks = educationalStage && educationalGrade ? getTracksForGrade(educationalStage, educationalGrade) : [];
  const availableSubjects = getSubjectsForTarget(educationalStage, educationalGrade, educationalTrack);
  const availableBranches = educationalStage && educationalGrade && subject ? getBranchesForSubject(educationalStage, educationalGrade, subject) : [];

  useEffect(() => {
    if (course) {
      setTitle(course.title || "");
      setShortDescription(course.shortDescription || "");
      setDescription(course.description || "");
      setImageUrl(course.image || "");
      setCategoryId(course.category?.id || undefined);
      setEducationalStage((course.educationalStage as EducationalStage) || undefined);
      setEducationalGrade((course.educationalGrade as EducationalGrade) || undefined);
      setEducationalTrack((course.educationalTrack as EducationalTrack) || undefined);
      setSubject((course.subject as CourseSubject) || undefined);
      setSubjectBranch((course.subjectBranch as SubjectBranch) || undefined);
      setPrice(course.price || 0);
      setIsFree(course.isFree || false);
      setEnforceQuizGate(course.enforceQuizGate ?? course.enforce_quiz_gate ?? false);
      setStatus(course.status as "draft" | "published");
    }
  }, [course]);

  const handleStageChange = (value: EducationalStage) => {
    setEducationalStage(value);
    setEducationalGrade(undefined);
    setEducationalTrack(undefined);
    setSubject(undefined);
    setSubjectBranch(undefined);
  };

  const handleGradeChange = (value: EducationalGrade) => {
    setEducationalGrade(value);
    setEducationalTrack(undefined);
    setSubject(undefined);
    setSubjectBranch(undefined);
  };

  const handleTrackChange = (value: EducationalTrack) => {
    setEducationalTrack(value);
    setSubject(undefined);
    setSubjectBranch(undefined);
  };

  const handleSubjectChange = (value: CourseSubject) => {
    setSubject(value);
    setSubjectBranch(undefined);
  };

  const handleSaveCourse = async (publishDirectly = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const nextStatus = publishDirectly ? "published" : status;
    const clientErrors: Record<string, string> = {};

    if (!title.trim()) {
      clientErrors.title = "يرجى كتابة عنوان الدورة التعليمية.";
    }
    if (!categoryId) {
      clientErrors.category = "يرجى اختيار تصنيف الدورة التعليمية.";
    }

    if (nextStatus === "published") {
      if (!educationalStage) clientErrors.educational_stage = "المرحلة التعليمية مطلوبة لنشر الدورة للطلاب.";
      if (!educationalGrade) clientErrors.educational_grade = "الصف الدراسي مطلوب لنشر الدورة للطلاب.";
      if (availableTracks.length > 0 && !educationalTrack) clientErrors.educational_track = "الشعبة أو المسار التخصصي مطلوب لهذا الصف.";
      if (!subject) clientErrors.subject = "المادة الدراسية مطلوبة لنشر الدورة للطلاب.";
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setActiveTab("meta");
      const firstKey = Object.keys(clientErrors)[0];
      const firstMsg = clientErrors[firstKey];
      setErrorMsg(firstMsg);
      toast({
        title: "بيانات مطلوبة غير مكتملة",
        description: firstMsg,
        variant: "destructive",
      });
      setTimeout(() => {
        const el = document.getElementById(`field-${firstKey}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 100);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        short_description: shortDescription || "",
        description: description || "",
        image_url: imageUrl || "",
        category: categoryId,
        educational_stage: educationalStage || "",
        educational_grade: educationalGrade || "",
        educational_track: educationalTrack || "",
        subject: subject || "",
        subject_branch: subjectBranch || "",
        price: isFree ? 0 : price,
        is_free: isFree,
        enforce_quiz_gate: enforceQuizGate,
        status: nextStatus,
      };

      if (isNew) {
        let idempotencyKey = courseCreationIdempotencyKeyRef.current;
        if (!idempotencyKey) {
          if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
            throw new Error("لا يمكن بدء عملية إنشاء آمنة في هذا المتصفح. يرجى استخدام متصفح حديث.");
          }
          idempotencyKey = crypto.randomUUID();
          courseCreationIdempotencyKeyRef.current = idempotencyKey;
        }

        const created = await createCourseMutation.mutateAsync({
          data: payload,
          idempotencyKey,
        });
        courseCreationIdempotencyKeyRef.current = null;
        toast({ title: "تم إنشاء الدورة بنجاح! 🚀", description: "يمكنك الآن إضافة وتنسيق المنهج والدروس." });
        navigate(`/instructor/courses/${created.id}/builder`, { replace: true });
        setActiveTab("curriculum");
      } else {
        await updateCourseMutation.mutateAsync(payload);
        toast({ title: "تم حفظ التعديلات بنجاح ✓", description: "تم تحديث بيانات الدورة في النظام." });
        setSuccessMsg("تم حفظ بيانات الدورة بنجاح!");
        setFieldErrors({});
      }
    } catch (err: any) {
      const normalizedFields = err?.fields as Record<string, string[]> | undefined;
      const serverData = err?.response?.data;
      const rawEnvelope =
        serverData && typeof serverData === "object" && serverData.error && typeof serverData.error === "object"
          ? serverData.error
          : serverData;
      const fallbackFields =
        rawEnvelope && typeof rawEnvelope === "object" && rawEnvelope.errors && typeof rawEnvelope.errors === "object"
          ? rawEnvelope.errors
          : undefined;
      const fieldSource =
        normalizedFields && Object.keys(normalizedFields).length > 0 ? normalizedFields : fallbackFields;
      const newErrors: Record<string, string> = {};

      if (fieldSource && typeof fieldSource === "object") {
        for (const [key, value] of Object.entries(fieldSource)) {
          const messages = Array.isArray(value) ? value : [String(value)];
          if (messages.length > 0) {
            newErrors[key] = messages.join(" ");
          }
        }
      }

      const errorFieldLabels: Record<string, string> = {
        title: "عنوان الدورة",
        category: "التصنيف التعليمي",
        educational_stage: "المرحلة التعليمية",
        educational_grade: "الصف الدراسي",
        educational_track: "الشعبة / المسار التخصصي",
        subject: "المادة الدراسية",
        subject_branch: "فرع المادة",
        price: "السعر",
        image_url: "رابط الغلاف",
        short_description: "نبذة سريعة",
        description: "الوصف التفصيلي",
      };

      if (Object.keys(newErrors).length === 0 && rawEnvelope && typeof rawEnvelope === "object") {
        for (const [key, val] of Object.entries(rawEnvelope)) {
          if (key === "detail" || key === "message" || key === "status" || key === "code" || key === "correlation_id" || key === "errors") continue;
          const rawMsg = Array.isArray(val) ? val.join(" ") : String(val);
          let friendlyMsg = rawMsg;
          if (rawMsg.toLowerCase().includes("not be null") || rawMsg.toLowerCase().includes("required")) {
            const label = errorFieldLabels[key] || key;
            friendlyMsg = `حقل "${label}" مطلوب ولا يمكن تركه فارغاً.`;
          }
          newErrors[key] = friendlyMsg;
        }
      }

      const publishQualityMessages =
        (fieldSource && Array.isArray((fieldSource as Record<string, unknown>).publish_quality)
          ? (fieldSource as Record<string, unknown>).publish_quality
          : undefined) ?? (serverData?.publish_quality ?? undefined);
      if (Array.isArray(publishQualityMessages) && publishQualityMessages.length > 0) {
        const firstPublishMessage = String(publishQualityMessages[0]);
        setStatus("draft");
        setActiveTab("curriculum");
        setErrorMsg(firstPublishMessage);
        setFieldErrors({});
        toast({
          title: "لا يمكن نشر الدورة بعد",
          description: firstPublishMessage,
          variant: "destructive",
        });
        return;
      }

      if (Object.keys(newErrors).length > 0) {
        setFieldErrors(newErrors);
        setActiveTab("meta");
        const firstKey = Object.keys(newErrors)[0];
        const firstMsg = newErrors[firstKey];
        setErrorMsg(firstMsg);
        toast({ title: "تعذر الحفظ", description: firstMsg, variant: "destructive" });

        setTimeout(() => {
          const el = document.getElementById(`field-${firstKey}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus();
          }
        }, 100);
        return;
      }

      if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
        courseCreationIdempotencyKeyRef.current = null;
      }

      const msg =
        rawEnvelope?.detail ||
        serverData?.detail ||
        serverData?.message ||
        err?.message ||
        "فشل حفظ الدورة.";
      setErrorMsg(msg);
      toast({ title: "تعذر الحفظ", description: msg, variant: "destructive" });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "حجم الصورة كبير",
        description: "يجب ألا يتجاوز حجم الغلاف 15 ميجابايت.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      setIsUploadingCover(true);
      const res = await http.post("/courses/upload-image/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url || res.data?.absolute_url) {
        setImageUrl(res.data.absolute_url || res.data.url);
        toast({
          title: "تم رفع وتحويل الغلاف بنجاح! 🖼️",
          description: "تم تحويل الغلاف تلقائياً إلى صيغة WebP فائقة الجودة لسرعة العرض وتوفير البيانات.",
        });
      }
    } catch (err: any) {
      toast({
        title: "فشل رفع الغلاف",
        description: err.response?.data?.detail || err.message || "حدث خطأ أثناء رفع الصورة.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  // Inline Module Handlers
  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      const maxOrder = Math.max(0, ...(course?.modules || []).map((module) => module.order));
      await createModuleMutation.mutateAsync({
        course: numCourseId,
        title: newModuleTitle.trim(),
        order: maxOrder + 1,
      });
      toast({ title: "تم إنشاء الوحدة بنجاح 🎉" });
      setNewModuleTitle("");
      setIsAddingModule(false);
    } catch (err: any) {
      toast({ title: "خطأ في إنشاء الوحدة", description: err?.message, variant: "destructive" });
    }
  };

  const handleStartEditModule = (mod: Module) => {
    setEditingModuleId(mod.id);
    setEditingModuleTitle(mod.title);
  };

  const handleDeleteModule = async (module: Module) => {
    if (deleteModuleMutation.isPending) return;
    if (!window.confirm("هل أنت متأكد من حذف هذه الوحدة وكل الدروس الموجودة بداخلها؟")) return;

    try {
      await deleteModuleMutation.mutateAsync(module.id);
      if (activeModuleId === module.id) {
        handleCloseLessonStudio();
      }
      toast({ title: "تم حذف الوحدة بنجاح" });
    } catch (err: any) {
      toast({
        title: "تعذر حذف الوحدة",
        description: err?.message || "قد تكون الوحدة مرتبطة باختبار. احذف الاختبار المرتبط أولًا.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEditModule = async (moduleId: number) => {
    if (!editingModuleTitle.trim()) return;
    try {
      await updateModuleMutation.mutateAsync({
        id: moduleId,
        data: { title: editingModuleTitle.trim() },
      });
      toast({ title: "تم تحديث اسم الوحدة بنجاح ✓" });
      setEditingModuleId(null);
      setEditingModuleTitle("");
    } catch (err: any) {
      toast({ title: "خطأ في تحديث الوحدة", description: err?.message, variant: "destructive" });
    }
  };

  const handleMoveModule = async (index: number, direction: "up" | "down") => {
    if (!course?.modules || updateModuleMutation.isPending) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= course.modules.length) return;

    const currentModule = course.modules[index];
    const targetModule = course.modules[targetIndex];
    if (!currentModule || !targetModule || currentModule.order === targetModule.order) return;

    try {
      await updateModuleMutation.mutateAsync({
        id: currentModule.id,
        data: { order: targetModule.order },
      });
    } catch (err: any) {
      toast({
        title: "تعذر إعادة ترتيب الوحدة",
        description: err?.message || "حدث خطأ أثناء تحديث ترتيب الوحدة.",
        variant: "destructive",
      });
    }
  };

  // Inline Lesson Studio Handlers
  const handleOpenLessonStudio = (moduleId: number, lesson?: Lesson) => {
    if (isVideoUploading && activeModuleId !== moduleId) {
      toast({
        title: "رفع الفيديو مستمر في الخلفية",
        description: "تم الحفاظ على الحصة المستهدفة حتى لا يتم ربط الفيديو بحصة أخرى بالخطأ. يمكنك متابعة تعديل الوحدات من حولك.",
      });
      return;
    }

    setActiveModuleId(moduleId);
    setIsLessonStudioMinimized(false);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonTitle(lesson.title);
      setLessonType(lesson.type || "video");
      setLessonDuration(lesson.duration || "10:00");
      setLessonIsFree(lesson.isFree || false);
      setSelectedVideoId(lesson.videoId || (lesson.video as any)?.id || null);
      setSummaryContent(lesson.summary?.content || "");
      setSummaryPdf(null);
    } else {
      setEditingLesson(null);
      setLessonTitle("");
      setLessonType("video");
      setLessonDuration("10:00");
      setLessonIsFree(false);
      setSelectedVideoId(null);
      setSummaryContent("");
      setSummaryPdf(null);
    }
  };

  const handleCloseLessonStudio = () => {
    if (isVideoUploading) {
      setIsLessonStudioMinimized(true);
      return;
    }

    setIsLessonStudioMinimized(false);
    setHasVideoUploadSession(false);
    setActiveModuleId(null);
    setEditingLesson(null);
    setLessonTitle("");
    setLessonType("video");
    setLessonDuration("10:00");
    setLessonIsFree(false);
    setSelectedVideoId(null);
    setSummaryContent("");
    setSummaryPdf(null);
  };

  const handleSaveLessonStudio = async () => {
    if (!lessonTitle.trim() || !activeModuleId) {
      toast({ title: "تنبيه", description: "يرجى كتابة عنوان الدرس أولاً.", variant: "destructive" });
      return;
    }
    try {
      setIsSavingLesson(true);
      let savedLessonId: number;
      if (editingLesson) {
        await updateLessonMutation.mutateAsync({
          id: editingLesson.id,
          data: {
            title: lessonTitle.trim(),
            type: lessonType,
            duration: lessonDuration,
            isFree: lessonIsFree,
            video: selectedVideoId,
            module: activeModuleId,
            // To be wired to UI toggle, currently auto-publish by default
            is_published: editingLesson.is_published ?? true, 
          },
        });
        savedLessonId = editingLesson.id;
      } else {
        const mod = course?.modules?.find((m) => m.id === activeModuleId);
        const maxOrder = Math.max(0, ...(mod?.lessons || []).map((lesson) => lesson.order));
        const created = await createLessonMutation.mutateAsync({
          module: activeModuleId,
          title: lessonTitle.trim(),
          type: lessonType,
          duration: lessonDuration,
          order: maxOrder + 1,
          isFree: lessonIsFree,
          video: selectedVideoId,
          is_published: true, // Default to published when created via UI currently
        });
        savedLessonId = created.id;
      }

      // Handle summary saving if content or PDF provided
      if (summaryContent.trim() || summaryPdf) {
        const formData = new FormData();
        formData.append("lesson", String(savedLessonId));
        formData.append("content", summaryContent.trim());
        if (summaryPdf) {
          formData.append("attachment", summaryPdf);
          formData.append("attachment_name", summaryPdf.name);
        }
        if (editingLesson?.summary?.id) {
          await updateSummaryMutation.mutateAsync({ id: editingLesson.summary.id, formData });
        } else {
          await createSummaryMutation.mutateAsync(formData);
        }
      }

      toast({ title: "تم حفظ الدرس ومحتواه بنجاح! 🚀" });
      handleCloseLessonStudio();
    } catch (err: any) {
      toast({ title: "تعذر حفظ الدرس", description: err?.message, variant: "destructive" });
    } finally {
      setIsSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (deleteLessonMutation.isPending) return;
    if (!window.confirm("هل أنت متأكد من حذف هذا الدرس؟")) return;

    try {
      await deleteLessonMutation.mutateAsync(lesson.id);
      if (editingLesson?.id === lesson.id) {
        handleCloseLessonStudio();
      }
      toast({ title: "تم حذف الدرس بنجاح" });
    } catch (err: any) {
      toast({
        title: "تعذر حذف الدرس",
        description: err?.message || "قد يكون الدرس مرتبطًا باختبار. احذف الاختبار المرتبط أولًا.",
        variant: "destructive",
      });
    }
  };

  const handleMoveLesson = async (module: Module, index: number, direction: "up" | "down") => {
    if (updateLessonMutation.isPending) return;

    const lessons = [...(module.lessons || [])];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= lessons.length) return;

    const currentLesson = lessons[index];
    const targetLesson = lessons[targetIndex];
    if (!currentLesson || !targetLesson || currentLesson.order === targetLesson.order) return;

    try {
      await updateLessonMutation.mutateAsync({
        id: currentLesson.id,
        data: { order: targetLesson.order },
      });
    } catch (err: any) {
      toast({
        title: "تعذر إعادة ترتيب الدرس",
        description: err?.message || "حدث خطأ أثناء تحديث ترتيب الدرس.",
        variant: "destructive",
      });
    }
  };

  if (!isNew && hasInvalidCourseId) {
    return (
      <Layout>
        <div className="container mx-auto py-12 px-4 max-w-2xl" dir="rtl">
          <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <h1 className="text-xl font-black">رابط الدورة غير صالح</h1>
            <p className="text-sm text-muted-foreground">
              معرّف الدورة الموجود في الرابط غير صالح. ارجع إلى إدارة الدورات واختر دورة موجودة.
            </p>
            <Button asChild className="rounded-xl font-bold">
              <Link to="/instructor/courses">العودة إلى إدارة الدورات</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isNew && courseError) {
    const statusCode = (courseError as any)?.response?.status;
    const message =
      statusCode === 403
        ? "ليس لديك صلاحية الوصول إلى هذه الدورة."
        : statusCode === 404
          ? "الدورة المطلوبة غير موجودة أو تم حذفها."
          : "تعذر تحميل بيانات الدورة. حاول مرة أخرى أو ارجع إلى إدارة الدورات.";

    return (
      <Layout>
        <div className="container mx-auto py-12 px-4 max-w-2xl" dir="rtl">
          <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <h1 className="text-xl font-black">تعذر فتح الدورة</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl font-bold">
                إعادة المحاولة
              </Button>
              <Button asChild className="rounded-xl font-bold">
                <Link to="/instructor/courses">العودة إلى إدارة الدورات</Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoadingCourse && !isNew) {
    return (
      <Layout>
        <div className="container mx-auto py-12 px-4 max-w-5xl">
          <div className="h-64 rounded-2xl bg-muted animate-pulse" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-5xl dir-rtl space-y-6" dir="rtl">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
              <Link to="/instructor/courses" className="hover:text-primary transition-colors">
                إدارة الدورات
              </Link>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{isNew ? "دورة جديدة" : title || "تعديل الدورة"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              {isNew ? "إنشاء دورة ومحاضرات جديدة" : title || "منشئ الدورات والمناهج"}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {!isNew && (
              <>
                <Button variant="outline" asChild className="rounded-xl font-bold gap-2 text-xs h-10 border-primary/30 text-primary hover:bg-primary/10">
                  <Link to={`/instructor/exams/builder?course_id=${numCourseId}`}>
                    <FileQuestion className="w-4 h-4" />
                    إنشاء اختبار للدورة
                  </Link>
                </Button>
                <Button variant="outline" asChild className="rounded-xl font-bold gap-2 text-xs h-10">
                  <Link to={`/course/${numCourseId}`} target="_blank">
                    <Eye className="w-4 h-4" />
                    معاينة للطلاب
                  </Link>
                </Button>
              </>
            )}
            <Button
              onClick={() => handleSaveCourse()}
              disabled={createCourseMutation.isPending || updateCourseMutation.isPending}
              className="gap-2 font-bold rounded-xl h-10 px-5 shadow-md shadow-primary/20"
            >
              <Save className="w-4 h-4" />
              {isNew ? "إنشاء الدورة" : "حفظ التعديلات"}
            </Button>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="meta" className="font-bold rounded-lg text-xs sm:text-sm">
              1. تفاصيل الدورة
            </TabsTrigger>
            <TabsTrigger
              value="curriculum"
              onClick={() => {
                if (isNew && !title.trim()) {
                  toast({ title: "تنبيه", description: "يرجى كتابة عنوان للدورة أولاً ثم حفظها للبدء في إضافة المنهج." });
                }
              }}
              disabled={isNew}
              className="font-bold rounded-lg text-xs sm:text-sm"
            >
              2. المنهج والحصص {course?.modules?.length ? `(${course.modules.length})` : ""}
            </TabsTrigger>
            <TabsTrigger
              value="exams"
              disabled={isNew}
              className="font-bold rounded-lg text-xs sm:text-sm"
            >
              3. اختبارات الدورة {courseExams.length ? `(${courseExams.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Course Meta & Pricing */}
          <TabsContent value="meta" className="space-y-6">
            <div className="bg-card border border-border/70 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 space-y-1.5" id="field-container-title">
                  <label className="text-xs font-bold text-foreground">
                    عنوان الدورة / المادة <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="field-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      clearFieldError("title");
                    }}
                    placeholder="مثال: مراجعة الفيزياء للثانوية العامة - الفصل الدراسي الأول"
                    className={getFieldClass("title", "h-11 font-medium rounded-xl text-sm")}
                  />
                  {fieldErrors.title && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.title}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5" id="field-container-category">
                  <label className="text-xs font-bold text-foreground">
                    التصنيف التعليمي <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="field-category"
                    value={categoryId || ""}
                    onChange={(e) => {
                      setCategoryId(e.target.value ? Number(e.target.value) : undefined);
                      clearFieldError("category");
                    }}
                    className={getFieldClass(
                      "category",
                      "w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
                    )}
                  >
                    <option value="">اختر تصنيف الدورة...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.category}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5" id="field-container-educational_stage">
                  <label className="text-xs font-bold text-foreground">
                    المرحلة التعليمية <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="field-educational_stage"
                    value={educationalStage || ""}
                    onChange={(e) => {
                      handleStageChange(e.target.value as EducationalStage);
                      clearFieldError("educational_stage");
                    }}
                    className={getFieldClass(
                      "educational_stage",
                      "w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
                    )}
                  >
                    <option value="">اختر المرحلة التعليمية...</option>
                    {EDUCATIONAL_STAGES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.educational_stage && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.educational_stage}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5" id="field-container-educational_grade">
                  <label className="text-xs font-bold text-foreground">
                    الصف الدراسي <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="field-educational_grade"
                    disabled={!educationalStage}
                    value={educationalGrade || ""}
                    onChange={(e) => {
                      handleGradeChange(e.target.value as EducationalGrade);
                      clearFieldError("educational_grade");
                    }}
                    className={getFieldClass(
                      "educational_grade",
                      "w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary disabled:opacity-50"
                    )}
                  >
                    <option value="">{educationalStage ? "اختر الصف الدراسي..." : "اختر المرحلة أولاً..."}</option>
                    {availableGrades.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.educational_grade && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.educational_grade}
                    </p>
                  )}
                </div>

                {availableTracks.length > 0 && (
                  <div className="space-y-1.5 animate-in fade-in-50" id="field-container-educational_track">
                    <label className="text-xs font-bold text-foreground">
                      الشعبة / المسار التخصصي <span className="text-destructive">*</span>
                    </label>
                    <select
                      id="field-educational_track"
                      value={educationalTrack || ""}
                      onChange={(e) => {
                        handleTrackChange(e.target.value as EducationalTrack);
                        clearFieldError("educational_track");
                      }}
                      className={getFieldClass(
                        "educational_track",
                        "w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
                      )}
                    >
                      <option value="">اختر الشعبة أو المسار التعليمي...</option>
                      {availableTracks.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.educational_track && (
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {fieldErrors.educational_track}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5" id="field-container-subject">
                  <label className="text-xs font-bold text-foreground">
                    المادة الدراسية <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="field-subject"
                    disabled={!educationalStage || !educationalGrade || (availableTracks.length > 0 && !educationalTrack)}
                    value={subject || ""}
                    onChange={(e) => {
                      handleSubjectChange(e.target.value as CourseSubject);
                      clearFieldError("subject");
                    }}
                    className={getFieldClass(
                      "subject",
                      "w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary disabled:opacity-50"
                    )}
                  >
                    <option value="">
                      {!educationalGrade
                        ? "اختر الصف أولاً..."
                        : availableTracks.length > 0 && !educationalTrack
                        ? "اختر الشعبة أولاً..."
                        : "اختر المادة الدراسية..."}
                    </option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {SUBJECT_LABELS[s as CourseSubject] || s}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.subject && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.subject}
                    </p>
                  )}
                </div>

                {availableBranches.length > 0 && (
                  <div className="space-y-1.5 animate-in fade-in-50" id="field-container-subject_branch">
                    <label className="text-xs font-bold text-foreground">
                      فرع المادة التخصصي <span className="text-muted-foreground text-[10px] font-normal">(اختياري - في حالة التخصص)</span>
                    </label>
                    <select
                      id="field-subject_branch"
                      value={subjectBranch || ""}
                      onChange={(e) => {
                        setSubjectBranch(e.target.value ? (e.target.value as SubjectBranch) : undefined);
                        clearFieldError("subject_branch");
                      }}
                      className={getFieldClass(
                        "subject_branch",
                        "w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
                      )}
                    >
                      <option value="">المادة العامة (أو حدد فرعاً معيناً)...</option>
                      {availableBranches.map((br) => (
                        <option key={br.id} value={br.id}>
                          {br.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.subject_branch && (
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {fieldErrors.subject_branch}
                      </p>
                    )}
                  </div>
                )}

                {/* Price & Free Course Switch */}
                <div className="space-y-1.5" id="field-container-price">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground">سعر الاشتراك (بالجنيه المصري)</label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-primary">
                      <input
                        type="checkbox"
                        checked={isFree}
                        onChange={(e) => {
                          setIsFree(e.target.checked);
                          clearFieldError("price");
                        }}
                        className="rounded text-primary focus:ring-primary"
                      />
                      دورة مجانية للجميع
                    </label>
                  </div>
                  <Input
                    id="field-price"
                    type="number"
                    disabled={isFree}
                    value={isFree ? 0 : price}
                    onChange={(e) => {
                      setPrice(Number(e.target.value));
                      clearFieldError("price");
                    }}
                    className={getFieldClass("price", "h-11 text-base font-bold rounded-xl")}
                  />
                  {fieldErrors.price && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in-50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.price}
                    </p>
                  )}
                </div>

                {/* Publish Status Toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">حالة نشر الدورة</label>
                  <div className="flex items-center justify-between h-11 px-4 bg-muted/30 rounded-xl border border-border/70">
                    <span className="text-xs font-semibold text-foreground">
                      {isNew ? "احفظ الدورة أولاً، ثم أكمل المنهج قبل النشر" : status === "published" ? "منشورة وظاهرة للطلاب" : "مسودة خاصة (غير ظاهرة للطلاب)"}
                    </span>
                    <Switch
                      checked={status === "published"}
                      disabled={isNew}
                      onCheckedChange={(checked) => setStatus(checked ? "published" : "draft")}
                    />
                  </div>
                </div>

                {/* Mandatory lesson progression gate */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">التدرج الإجباري للحصص</label>
                  <div className="flex items-center justify-between min-h-11 gap-4 px-4 py-2 bg-muted/30 rounded-xl border border-border/70">
                    <span className="text-xs font-semibold text-foreground">
                      اشترط إكمال الحصة واجتياز اختبارها قبل فتح الحصة التالية
                    </span>
                    <Switch
                      checked={enforceQuizGate}
                      onCheckedChange={setEnforceQuizGate}
                      aria-label="اشتراط اجتياز اختبار الحصة قبل فتح الحصة التالية"
                    />
                  </div>
                </div>

                {/* Image Cover Uploader with Automatic WebP Conversion */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    غلاف الدورة الترويجي (WebP Cover Image)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60">
                    <div className="sm:col-span-1 flex flex-col items-center justify-center">
                      {imageUrl ? (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/80 group shadow-sm bg-muted">
                          <img src={imageUrl} alt="غلاف الدورة" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs rounded-lg gap-1"
                              onClick={() => setImageUrl("")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              إزالة
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 text-xs rounded-lg gap-1"
                              onClick={() => coverInputRef.current?.click()}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              تغيير
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => coverInputRef.current?.click()}
                          className="w-full aspect-video rounded-xl border-2 border-dashed border-border/80 hover:border-primary/60 bg-card/60 flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center group"
                        >
                          {isUploadingCover ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-7 h-7 text-primary animate-spin" />
                              <span className="text-xs font-semibold text-foreground">جاري الرفع والمعالجة إلى WebP...</span>
                            </div>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-foreground">اضغط لرفع غلاف الدورة</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG, WEBP حتى 15 ميجابايت</span>
                            </>
                          )}
                        </div>
                      )}
                      <input
                        type="file"
                        ref={coverInputRef}
                        onChange={handleCoverUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    <div className="sm:col-span-2 flex flex-col justify-center space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 font-bold">
                          معالجة تلقائية إلى WebP ✨
                        </Badge>
                        <span className="text-xs text-muted-foreground">يتم ضغط الصورة بأعلى جودة وتوفير فائق لاستهلاك البيانات</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">أو أدخل رابط صورة خارجي (Direct Image URL):</label>
                        <Input
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://example.com/cover-image.webp"
                          className="h-10 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-foreground">نبذة سريعة عن الدورة</label>
                  <Textarea
                    rows={2}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="اكتب جملتين ملخصتين لتظهر تحت عنوان الدورة في كروت البحث والموبايل..."
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-foreground">الوصف التفصيلي وخطة الدورة</label>
                  <Textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="اشرح ماذا سيتعلم الطالب، موضوعات المنهج، وتجهيزات المادة..."
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-border/50">
                <Button
                  onClick={() => handleSaveCourse(false)}
                  disabled={createCourseMutation.isPending || updateCourseMutation.isPending}
                  className="rounded-xl font-bold h-11 px-8 gap-2"
                >
                  <Save size={16} />
                  {isNew ? "إنشاء وبدء إضافة المنهج" : "حفظ التعديلات"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Curriculum & Lessons Studio (Zero Modals - Inline Accordion Architecture) */}
          <TabsContent value="curriculum" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card border border-border/70 rounded-2xl p-5 shadow-xs">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  وحدات ومحاضرات الدورة
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  نظم الحصص في وحدات بتجربة مضمنة سلسة، واربط كل محاضرة بالفيديو، والمذكرة، والاختبار مباشرة.
                </p>
              </div>
              <Button
                onClick={() => setIsAddingModule((prev) => !prev)}
                className="gap-1.5 rounded-xl font-bold text-xs h-10 shrink-0 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {isAddingModule ? "إغلاق إضافة وحدة" : "إضافة وحدة جديدة"}
              </Button>
            </div>

            {/* Inline Module Creation Card */}
            <AnimatePresence>
              {isAddingModule && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-5 bg-gradient-to-r from-primary/10 via-card to-card border-2 border-primary/30 rounded-2xl shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>إضافة وحدة دراسية جديدة</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Input
                        value={newModuleTitle}
                        onChange={(e) => setNewModuleTitle(e.target.value)}
                        placeholder="مثال: الوحدة الأولى: قوانين الحركة والسرعة النسبية"
                        className="h-11 rounded-xl text-sm flex-1 font-medium bg-background"
                        onKeyDown={(e) => e.key === "Enter" && handleCreateModule()}
                        autoFocus
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          onClick={handleCreateModule}
                          disabled={createModuleMutation.isPending || !newModuleTitle.trim()}
                          className="rounded-xl font-bold h-11 px-5 text-xs gap-1.5 flex-1 sm:flex-initial"
                        >
                          {createModuleMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          حفظ الوحدة
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsAddingModule(false);
                            setNewModuleTitle("");
                          }}
                          className="rounded-xl h-11 px-4 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isLessonStudioMinimized && hasVideoUploadSession && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-4 z-30 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-lg backdrop-blur"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{isVideoUploading ? "رفع الفيديو يعمل في الخلفية" : "تم استلام الفيديو ويمكنك متابعة بناء الدورة"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{isVideoUploading ? "يمكنك تعديل الوحدات والدروس الآن، وسيتم ربط الفيديو بالحصة عند اكتمال الرفع." : "المعالجة قد تستمر على الخادم في الخلفية. افتح الاستوديو لمراجعة الحالة."}</p>
                  </div>
                </div>
                <Button type="button" size="sm" onClick={() => setIsLessonStudioMinimized(false)} className="rounded-xl font-bold shrink-0">
                  عرض الرفع
                </Button>
              </motion.div>
            )}

            {!course?.modules || course.modules.length === 0 ? (
              <div className="text-center py-16 bg-card border border-dashed border-border/80 rounded-2xl p-8">
                <Film className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <h4 className="font-bold text-foreground text-sm sm:text-base">لم تقم بإضافة أي وحدات حتى الآن</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  ابدأ بإنشاء الوحدة الأولى (مثل: الوحدة الأولى - الحركة والسرعة)، ثم أضف إليها الدروس.
                </p>
                <Button
                  onClick={() => setIsAddingModule(true)}
                  className="mt-4 gap-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  إضافة أول وحدة
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <AnimatePresence>
                  {course.modules.map((module, mIdx) => (
                    <motion.div
                      key={module.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-xs transition-shadow hover:shadow-md"
                    >
                      {/* Module Header */}
                      <div className="p-4 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-3">
                        {editingModuleId === module.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={editingModuleTitle}
                              onChange={(e) => setEditingModuleTitle(e.target.value)}
                              className="h-9 rounded-xl text-sm font-bold bg-background flex-1"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && handleSaveEditModule(module.id)}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveEditModule(module.id)}
                              disabled={updateModuleMutation.isPending || !editingModuleTitle.trim()}
                              className="h-9 px-3 rounded-xl font-bold text-xs gap-1"
                            >
                              {updateModuleMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              حفظ
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingModuleId(null)}
                              className="h-9 px-2 rounded-xl text-xs text-muted-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                                {mIdx + 1}
                              </span>
                              <h4 className="font-black text-sm sm:text-base text-foreground truncate">
                                {module.title}
                              </h4>
                              <Badge variant="outline" className="text-[10px] shrink-0 font-medium">
                                {module.lessons?.length || 0} دروس
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={mIdx === 0 || updateModuleMutation.isPending || deleteModuleMutation.isPending}
                                onClick={() => handleMoveModule(mIdx, "up")}
                                className="h-8 w-8 text-muted-foreground rounded-lg"
                                title="تحريك لأعلى"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={mIdx === (course.modules?.length ?? 0) - 1 || updateModuleMutation.isPending || deleteModuleMutation.isPending}
                                onClick={() => handleMoveModule(mIdx, "down")}
                                className="h-8 w-8 text-muted-foreground rounded-lg"
                                title="تحريك لأسفل"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEditModule(module)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                title="تعديل اسم الوحدة"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDeleteModule(module)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                title="حذف الوحدة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg"
                                title="إنشاء امتحان للوحدة"
                              >
                                <Link to={`/instructor/exams/builder?course_id=${numCourseId}&unit_id=${module.id}`}>
                                  <FileQuestion className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (activeModuleId === module.id && !editingLesson) {
                                    handleCloseLessonStudio();
                                  } else {
                                    handleOpenLessonStudio(module.id);
                                  }
                                }}
                                className="gap-1 text-xs h-8 rounded-lg font-bold mr-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                إضافة درس
                              </Button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Lessons List Inside Module */}
                      <div className="p-3 space-y-2">
                        {!module.lessons || module.lessons.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            لا توجد دروس في هذه الوحدة بعد. اضغط "إضافة درس" لإدراج المحتوى التعليمي.
                          </p>
                        ) : (
                          module.lessons.map((lesson, lIdx) => (
                            <div
                              key={lesson.id}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                editingLesson?.id === lesson.id
                                  ? "bg-primary/5 border-primary/50 shadow-xs"
                                  : "bg-muted/20 border-border/50 hover:border-primary/30"
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span className="text-xs text-muted-foreground font-bold shrink-0 mt-0.5">
                                  {mIdx + 1}.{lIdx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs sm:text-sm font-bold text-foreground">
                                      {lesson.title}
                                    </span>
                                    {lesson.isFree && (
                                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] h-4 px-1.5 font-bold">
                                        معاينة مجانية
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                    <span>{lesson.duration || "10:00"} دقيقة</span>
                                    {lesson.videoId || lesson.video ? (
                                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                        <CheckCircle2 className="w-3 h-3" />
                                        فيديو HLS مرتبط
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 font-medium">لم يتم ربط فيديو</span>
                                    )}
                                    {lesson.summary && (
                                      <span className="flex items-center gap-1 text-primary font-medium">
                                        <Paperclip className="w-3 h-3" />
                                        مذكرة مرفقة
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Desktop Buttons */}
                              <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={lIdx === 0 || updateLessonMutation.isPending || deleteLessonMutation.isPending}
                                  onClick={() => handleMoveLesson(module, lIdx, "up")}
                                  className="h-8 w-8 text-muted-foreground rounded-lg"
                                  title="تحريك لأعلى"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={lIdx === module.lessons.length - 1 || updateLessonMutation.isPending || deleteLessonMutation.isPending}
                                  onClick={() => handleMoveLesson(module, lIdx, "down")}
                                  className="h-8 w-8 text-muted-foreground rounded-lg"
                                  title="تحريك لأسفل"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant={editingLesson?.id === lesson.id ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    if (editingLesson?.id === lesson.id) {
                                      handleCloseLessonStudio();
                                    } else {
                                      handleOpenLessonStudio(module.id, lesson);
                                    }
                                  }}
                                  className="h-8 text-xs font-bold gap-1 rounded-xl"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {editingLesson?.id === lesson.id ? "إغلاق التعديل" : "تعديل الدرس والمحتوى"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleDeleteLesson(lesson)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                  title="حذف الدرس"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}

                        {/* Inline Progressive Lesson Studio Accordion inside this Module */}
                        <AnimatePresence>
                          {activeModuleId === module.id && (
                            <motion.div
                              layout
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className={isLessonStudioMinimized ? "hidden" : "overflow-hidden pt-3"}
                            >
                              <div className="p-5 rounded-2xl bg-card border-2 border-primary/30 shadow-lg space-y-6">
                                {/* Studio Header */}
                                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                      <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-black text-sm sm:text-base text-foreground">
                                        {editingLesson ? `تعديل درس: ${editingLesson.title}` : "إضافة درس ومحاضرة جديدة"}
                                      </h4>
                                      <p className="text-[11px] text-muted-foreground">
                                        استوديو الحصة الشامل: أضف العنوان، واربط الفيديو، والمذكرة، والاختبار في مكان واحد بدون نوافذ منبثقة.
                                      </p>
                                    </div>
                                  </div>
                                  {editingLesson && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      asChild
                                      className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
                                      title="إنشاء اختبار لهذا الدرس"
                                    >
                                      <Link to={`/instructor/exams/builder?course_id=${numCourseId}&unit_id=${activeModuleId}&lesson_id=${editingLesson.id}`}>
                                        <FileQuestion className="w-4 h-4" />
                                      </Link>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCloseLessonStudio}
                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted"
                                    title="إغلاق"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>

                                {/* 4-Step Systematic Progressive Studio */}
                                <div className="space-y-4">
                                  {/* Step 1: Basic Lesson Info */}
                                  <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-black text-foreground">
                                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">1</span>
                                      <span>البيانات الأساسية للدرس</span>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-foreground">
                                        عنوان الدرس / المحاضرة <span className="text-destructive">*</span>
                                      </label>
                                      <Input
                                        value={lessonTitle}
                                        onChange={(e) => setLessonTitle(e.target.value)}
                                        placeholder="مثال: الحصة الأولى: المفاهيم الأساسية وتطبيقات الحركة"
                                        className="h-11 rounded-xl text-sm font-medium bg-background"
                                        autoFocus
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-foreground">نوع المحتوى</label>
                                        <select
                                          value={lessonType}
                                          onChange={(e) => setLessonType(e.target.value as typeof lessonType)}
                                          className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
                                        >
                                          <option value="video">فيديو مسجل عالي الجودة (HLS)</option>
                                          <option value="article">شرح تفاعلي ومقال نصي</option>
                                          <option value="quiz">كويز سريع</option>
                                          <option value="assignment">واجب وتكليف منزلي</option>
                                        </select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-foreground">المدة التقريبية (دقيقة:ثانية)</label>
                                        <Input
                                          value={lessonDuration}
                                          onChange={(e) => setLessonDuration(e.target.value)}
                                          placeholder="15:00"
                                          className="h-11 rounded-xl text-sm font-medium bg-background"
                                        />
                                      </div>
                                    </div>

                                    {/* Free Preview Switch */}
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/70">
                                      <div>
                                        <h5 className="text-xs font-bold text-foreground">معاينة مجانية (Free Preview)</h5>
                                        <p className="text-[11px] text-muted-foreground">السماح لجميع الطلاب بمشاهدة هذا الدرس مجاناً قبل الاشتراك في الدورة.</p>
                                      </div>
                                      <Switch checked={lessonIsFree} onCheckedChange={setLessonIsFree} />
                                    </div>
                                  </div>

                                  {/* Step 2: Video Asset (local HLS processing) */}
                                  <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-xs font-black text-foreground">
                                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">2</span>
                                        <VideoIcon className="w-4 h-4 text-primary" />
                                        <span>استوديو الفيديو — HLS ومعالجة تلقائية</span>
                                      </div>
                                      {selectedVideoId && (
                                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] gap-1 font-bold">
                                          <CheckCircle2 className="w-3 h-3" /> تم تحديد الفيديو
                                        </Badge>
                                      )}
                                    </div>

                                    {videoAssets.length > 0 && (
                                      <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground">اختيار من الفيديوهات المرفوعة مسبقاً في مكتبتك:</label>
                                        <select
                                          value={selectedVideoId || ""}
                                          onChange={(e) => setSelectedVideoId(e.target.value ? Number(e.target.value) : null)}
                                          className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
                                        >
                                          <option value="">-- اختر فيديو من مكتبتك --</option>
                                          {videoAssets.map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.title} ({Math.round((v.durationSeconds || 0) / 60)} دقيقة) - [{v.status}]
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}

                                    <div className="space-y-2 pt-1">
                                      <label className="text-[11px] font-bold text-muted-foreground">أو ارفع فيديو جديداً للحصة مباشرة، وسيتم تحويله تلقائياً إلى HLS.</label>
                                      <ChunkedVideoUploader
                                        onUploadStateChange={(uploading) => { setIsVideoUploading(uploading); if (uploading) setHasVideoUploadSession(true); }}
                                        onSuccess={(video) => {
                                          setSelectedVideoId(video.id);
                                          toast({ title: "تم رفع الفيديو وربطه بالحصة! 🎬" });
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Step 3: Summary and PDF Attachment */}
                                  <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-black text-foreground">
                                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">3</span>
                                      <Paperclip className="w-4 h-4 text-primary" />
                                      <span>المذكرة والملخص الأكاديمي (PDF / Notes)</span>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-bold text-muted-foreground">ملاحظات وملخص الدرس للطلاب</label>
                                      <Textarea
                                        rows={3}
                                        value={summaryContent}
                                        onChange={(e) => setSummaryContent(e.target.value)}
                                        placeholder="اكتب النقاط الرئيسية، أهم القوانين، والملاحظات التي يجب على الطالب تذكرها..."
                                        className="rounded-xl text-xs font-medium bg-background"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-bold text-muted-foreground">إرفاق ملف مذكرة أو تمارين (PDF / Word)</label>
                                      <div className="flex items-center gap-3">
                                        <Input
                                          type="file"
                                          accept=".pdf,.doc,.docx"
                                          onChange={(e) => setSummaryPdf(e.target.files?.[0] || null)}
                                          className="h-10 text-xs rounded-xl flex-1 bg-background"
                                        />
                                        {summaryPdf && (
                                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 shrink-0 font-bold">
                                            {summaryPdf.name}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  </div>

                                {/* Studio Action Buttons */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleCloseLessonStudio}
                                    disabled={isSavingLesson}
                                    className="rounded-xl text-xs font-bold px-5"
                                  >
                                    إلغاء
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={handleSaveLessonStudio}
                                    disabled={isSavingLesson || !lessonTitle.trim()}
                                    className="rounded-xl font-bold text-xs px-7 h-10 gap-2 shadow-md shadow-primary/20"
                                  >
                                    {isSavingLesson ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        جاري حفظ الدرس...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-4 h-4" />
                                        حفظ الدرس والمحتوى
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Course-Linked Exams Quick Switch Banner */}
            {!isNew && (
              <div className="mt-8 p-6 bg-gradient-to-r from-primary/10 via-card to-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                      امتحانات وتدريبات الدورة الشاملة
                      <Badge variant="secondary" className="font-semibold text-[11px]">
                        {courseExams.length} {courseExams.length === 1 ? "اختبار" : "اختبارات"}
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      الاختبارات تتبع الدورة التعليمية بالكامل لقياس مستوى استيعاب الطلاب ومتابعة نتائجهم.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("exams")}
                    className="rounded-xl text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    عرض اختبارات الدورة ({courseExams.length})
                  </Button>
                  <Button asChild size="sm" className="rounded-xl text-xs font-bold gap-1.5">
                    <Link to={`/instructor/exams/builder?course_id=${numCourseId}`}>
                      <Plus size={15} />
                      إنشاء اختبار جديد
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Course-Wide Exams & Assessments */}
          <TabsContent value="exams" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                    امتحانات وتقييمات الدورة الشاملة
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary font-bold">
                      {courseExams.length} اختبار
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    هنا تجد كافة الامتحانات والاختبارات التفاعلية المرتبطة بهذه الدورة بالكامل، والتي يستطيع الطلاب خوضها لتقييم مستواهم.
                  </p>
                </div>
              </div>
              <Button asChild className="rounded-xl font-bold gap-2 text-xs sm:text-sm h-10 px-5 shadow-sm shadow-primary/20 shrink-0">
                <Link to={`/instructor/exams/builder?course_id=${numCourseId}`}>
                  <Plus className="w-4 h-4" />
                  إنشاء اختبار جديد للدورة
                </Link>
              </Button>
            </div>

            {isLoadingExams ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-40 rounded-2xl bg-muted/60 animate-pulse border border-border/60" />
                ))}
              </div>
            ) : courseExams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courseExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-5 rounded-2xl bg-card border border-border/80 hover:border-primary/30 transition-all shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              exam.examType === "PRACTICE" || exam.exam_type === "PRACTICE"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900"
                                : "bg-primary/10 text-primary border border-primary/20"
                            }`}
                          >
                            {exam.examType === "ASSIGNMENT" || exam.exam_type === "ASSIGNMENT"
                              ? "واجب أسئلة"
                              : exam.examType === "PRACTICE" || exam.exam_type === "PRACTICE"
                                ? "تدريب تفاعلي"
                                : "امتحان رسمي"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              (exam.isPublished ?? exam.is_published)
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                            }`}
                          >
                            {(exam.isPublished ?? exam.is_published) ? "منشور للطلاب" : "مسودة خاصة"}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                          {exam.title}
                        </h4>
                        {exam.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {exam.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-muted/30 rounded-xl text-center text-xs border border-border/50">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">الأسئلة</span>
                        <span className="font-bold text-foreground">
                          {exam.totalQuestions || exam.total_questions || exam.questions?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">المدة</span>
                        <span className="font-bold text-foreground">
                          {exam.durationMinutes || exam.duration_minutes || 45} دقيقة
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">النجاح</span>
                        <span className="font-bold text-foreground">
                          {exam.passThreshold || exam.pass_threshold || 50}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 rounded-lg text-xs font-semibold gap-1"
                        >
                          <Link to={`/instructor/exams/${exam.id}/builder?course_id=${numCourseId}`}>
                            <Edit className="w-3.5 h-3.5" />
                            تعديل
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 rounded-lg text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Link to={`/exam/${exam.id}`} target="_blank">
                            <Eye className="w-3.5 h-3.5" />
                            معاينة
                          </Link>
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await togglePublishExamMutation.mutateAsync({
                                examId: exam.id,
                                isPublished: !(exam.isPublished ?? exam.is_published),
                              });
                              toast({
                                title: (exam.isPublished ?? exam.is_published) ? "تم تحويل الاختبار لمسودة" : "تم نشر الاختبار للطلاب 🎉",
                              });
                            } catch (e: any) {
                              toast({ title: "فشل تحديث الحالة", description: e?.message, variant: "destructive" });
                            }
                          }}
                          className="h-8 text-xs font-semibold rounded-lg"
                        >
                          {(exam.isPublished ?? exam.is_published) ? "إلغاء النشر" : "نشر الآن"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!window.confirm("هل أنت متأكد من حذف هذا الاختبار من الدورة؟")) return;
                            try {
                              await deleteExamMutation.mutateAsync(exam.id);
                              toast({ title: "تم حذف الاختبار بنجاح" });
                            } catch (e: any) {
                              toast({ title: "فشل حذف الاختبار", description: e?.message, variant: "destructive" });
                            }
                          }}
                          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 sm:p-12 text-center rounded-2xl bg-card border border-dashed border-border/80 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileQuestion className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="font-bold text-base text-foreground">
                    لا توجد اختبارات مرتبطة بهذه الدورة حتى الآن
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    الاختبارات تكون للدورة التعليمية بالكامل. أضف امتحاناً شاملاً أو تدريباً مخصصاً لتقييم فهم واستيعاب الطلاب لكافة محتويات هذه الدورة.
                  </p>
                </div>
                <Button asChild className="rounded-xl font-bold text-xs sm:text-sm h-10 px-6 gap-2">
                  <Link to={`/instructor/exams/builder?course_id=${numCourseId}`}>
                    <Plus className="w-4 h-4" />
                    إنشاء أول اختبار للدورة الآن
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default InstructorCourseBuilder;
