import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useInstructorExams, useDeleteExam, useTogglePublishExam } from "@/features/exams";
import { useInstructorCourses } from "@/features/instructor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  BarChart3,
  FileCheck2,
  AlertTriangle,
  BookOpenCheck,
  Sparkles,
  Globe,
  Clock,
  HelpCircle,
  Search,
  Filter,
  Layers,
  BookOpen,
  GraduationCap,
  X,
  FileCode,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ExamAnalyticsModal } from "@/components/instructor/ExamAnalyticsModal";
import { GradeEssayModal } from "@/components/instructor/GradeEssayModal";
import { QuestionBankImportModal } from "@/components/instructor/QuestionBankImportModal";
import { useToast } from "@/components/ui/use-toast";
import {
  STAGE_LABELS,
  GRADE_LABELS,
  TRACK_LABELS,
  SUBJECT_LABELS,
} from "@/lib/curriculumData";
import type { EducationalStage, EducationalGrade, CourseSubject } from "@/types/curriculum";

export default function InstructorExamManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: exams, isLoading, refetch } = useInstructorExams();
  const { data: rawInstructorCourses } = useInstructorCourses();
  const { mutate: deleteExamMutation, isPending: isDeleting } = useDeleteExam();
  const { mutate: togglePublish, isPending: isToggling } = useTogglePublishExam();

  const instructorCourses: any[] = Array.isArray(rawInstructorCourses)
    ? rawInstructorCourses
    : (rawInstructorCourses as any)?.results || [];

  const [analyticsExamId, setAnalyticsExamId] = useState<number | null>(null);
  const [gradeEssayExamId, setGradeEssayExamId] = useState<number | null>(null);
  const [examToDelete, setExamToDelete] = useState<{ id: number; title: string } | null>(null);
  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  const handleTogglePublish = (examId: number, nextStatus: boolean) => {
    togglePublish(
      { examId, isPublished: nextStatus },
      {
        onSuccess: () => {
          toast({
            title: nextStatus ? "تم نشر الامتحان بنجاح 🚀" : "تم إلغاء النشر وتحويله لمسودة 🔒",
            description: nextStatus
              ? "أصبح الامتحان متاحاً للطلاب المسجلين الآن."
              : "تم إخفاء الامتحان عن الطلاب وأصبح مسودة خاصة.",
          });
          refetch();
        },
        onError: (err: any) => {
          toast({
            title: "تعذر تغيير حالة النشر",
            description: err?.response?.data?.detail || err?.message || "حدث خطأ أثناء الاتصال بالسيرفر.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDeleteExam = () => {
    if (!examToDelete) return;
    deleteExamMutation(examToDelete.id, {
      onSuccess: () => {
        toast({ title: "تم الحذف بنجاح 🗑️", description: `تم حذف امتحان "${examToDelete.title}" نهائياً من النظام.` });
        setExamToDelete(null);
        refetch();
      },
      onError: (err: any) => {
        toast({
          title: "تعذر الحذف",
          description: err?.message || "حدث خطأ أثناء محاولة حذف الامتحان من السيرفر.",
          variant: "destructive",
        });
        setExamToDelete(null);
      },
    });
  };

  const examList = Array.isArray(exams) ? exams : [];

  // Filtered Exam List
  const filteredExams = useMemo(() => {
    return examList.filter((exam: any) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (exam.title || "").toLowerCase().includes(q);
        const descMatch = (exam.description || "").toLowerCase().includes(q);
        if (!titleMatch && !descMatch) return false;
      }
      // Course
      if (selectedCourseFilter !== "all") {
        if (selectedCourseFilter === "standalone") {
          if (exam.course) return false;
        } else {
          if (String(exam.course) !== selectedCourseFilter) return false;
        }
      }
      // Stage
      if (selectedStageFilter !== "all") {
        const stage = exam.educationalStage || exam.educational_stage;
        if (stage !== selectedStageFilter) return false;
      }
      // Type
      if (selectedTypeFilter !== "all") {
        const type = exam.examType || exam.exam_type || "EXAM";
        if (type !== selectedTypeFilter) return false;
      }
      // Status
      if (selectedStatusFilter !== "all") {
        const isPub = exam.isPublished ?? exam.is_published ?? true;
        if (selectedStatusFilter === "published" && !isPub) return false;
        if (selectedStatusFilter === "draft" && isPub) return false;
      }
      return true;
    });
  }, [examList, searchQuery, selectedCourseFilter, selectedStageFilter, selectedTypeFilter, selectedStatusFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCourseFilter !== "all" ||
    selectedStageFilter !== "all" ||
    selectedTypeFilter !== "all" ||
    selectedStatusFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCourseFilter("all");
    setSelectedStageFilter("all");
    setSelectedTypeFilter("all");
    setSelectedStatusFilter("all");
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8 px-4 animate-pulse space-y-6 dir-rtl" dir="rtl">
          <div className="h-28 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 dir-rtl space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3 text-foreground">
              <BookOpenCheck className="w-8 h-8 text-primary" />
              إدارة امتحانات ومراجعات المعلم
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              استعرض امتحاناتك المصنفة بالمناهج الدراسية، تابع أداء الطلاب وحلل النتائج بالبيانات الموثوقة.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQuestionBankModalOpen(true)}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-bold shadow-sm w-full sm:w-auto justify-center rounded-xl h-11"
            >
              <FileCode size={18} />
              استيراد أسئلة من JSON
            </Button>
            <Button asChild className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm w-full sm:w-auto justify-center rounded-xl h-11">
              <Link to="/instructor/exams/builder">
                <Plus size={18} />
                إنشاء امتحان جديد
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <Card className="border shadow-xs rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو وصف الامتحان..."
                  className="ps-9 h-10 rounded-xl text-sm"
                />
              </div>

              {/* Course Filter */}
              <div className="w-full md:w-52">
                <Select value={selectedCourseFilter} onValueChange={setSelectedCourseFilter}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="تصفية بالدورة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الارتباطات</SelectItem>
                    <SelectItem value="standalone">امتحانات عامة فقط (بدون دورة)</SelectItem>
                    {instructorCourses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        دورة: {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage Filter */}
              <div className="w-full md:w-48">
                <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="المرحلة الدراسية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المراحل</SelectItem>
                    {(Object.entries(STAGE_LABELS) as [EducationalStage, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="w-full md:w-40">
                <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="نوع الامتحان" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنظمة</SelectItem>
                    <SelectItem value="EXAM">امتحان تقييمي</SelectItem>
                    <SelectItem value="PRACTICE">مراجعة وتدريب</SelectItem>
                    <SelectItem value="ASSIGNMENT">واجب بنظام الأسئلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-36">
                <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="حالة النشر" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="published">منشور ✓</SelectItem>
                    <SelectItem value="draft">مسودة 🔒</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground gap-1 rounded-xl"
                  title="إلغاء جميع الفلاتر"
                >
                  <X size={14} /> إعادة ضبط
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exams List Table or Empty State */}
        {examList.length === 0 ? (
          <EmptyState
            title="لا توجد امتحانات خاصة بك حالياً"
            description="أنشئ امتحانك أو مراجعتك الأولى بالذكاء الاصطناعي أو النموذج المباشر بنقرة زر واحدة."
            action={{ label: "إنشاء امتحان جديد الآن", onClick: () => navigate("/instructor/exams/builder") }}
            icon={<FileText className="h-16 w-16 text-primary" />}
          />
        ) : filteredExams.length === 0 ? (
          <Card className="border shadow-sm rounded-2xl p-12 text-center">
            <Filter className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-bold text-base text-foreground">لا توجد نتائج مطابقة للفلاتر المحددة</h3>
            <p className="text-xs text-muted-foreground mt-1">جرب تغيير شروط البحث أو مسح الفلاتر لعرض كافة الامتحانات.</p>
            <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 rounded-xl text-xs">
              مسح كل الفلاتر
            </Button>
          </Card>
        ) : (
          <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                امتحاناتك المسجلة ({filteredExams.length} من أصل {examList.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">اضغط على أي امتحان لعرض التحليلات الشاملة والتصحيح.</p>
            </CardHeader>
            <CardContent>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>عنوان الاختبار</TableHead>
                      <TableHead>التصنيف الأكاديمي</TableHead>
                      <TableHead>النوع / النظام</TableHead>
                      <TableHead>حالة النشر</TableHead>
                      <TableHead>المدة</TableHead>
                      <TableHead>الأسئلة</TableHead>
                      <TableHead className="text-center">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExams.map((exam: any) => {
                      const isPub = exam.is_published ?? exam.isPublished ?? true;
                      const isPractice = exam.exam_type === "PRACTICE" || exam.examType === "PRACTICE";
                      const isAssignment = exam.exam_type === "ASSIGNMENT" || exam.examType === "ASSIGNMENT";
                      const questionCount = exam.total_questions ?? exam.totalQuestions ?? (exam.questions ? exam.questions.length : 0);
                      const duration = exam.durationMinutes || exam.duration_minutes || 45;
                      const stage = exam.educationalStage || exam.educational_stage;
                      const grade = exam.educationalGrade || exam.educational_grade;
                      const track = exam.educationalTrack || exam.educational_track;
                      const sub = exam.subject;
                      const courseTitle = exam.course_title;

                      return (
                        <TableRow
                          key={exam.id}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <TableCell
                            className="font-bold text-foreground hover:text-primary max-w-xs"
                            onClick={() => setAnalyticsExamId(exam.id)}
                          >
                            <div className="truncate">{exam.title}</div>
                            {courseTitle && (
                              <div className="text-[11px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5">
                                <BookOpen size={11} className="text-primary" />
                                دورة: {courseTitle}
                              </div>
                            )}
                          </TableCell>

                          {/* Academic Targeting Badges */}
                          <TableCell onClick={() => setAnalyticsExamId(exam.id)}>
                            <div className="flex items-center gap-1 flex-wrap max-w-xs">
                              {stage && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary">
                                  {STAGE_LABELS[stage as EducationalStage] || stage}
                                </Badge>
                              )}
                              {grade && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-border">
                                  {GRADE_LABELS[grade as EducationalGrade] || grade}
                                </Badge>
                              )}
                              {track && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {TRACK_LABELS[track] || track}
                                </Badge>
                              )}
                              {sub && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                  {SUBJECT_LABELS[sub as CourseSubject] || sub}
                                </Badge>
                              )}
                              {!stage && !grade && !sub && !courseTitle && (
                                <span className="text-[11px] text-muted-foreground">عام لجميع المراحل</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell onClick={() => setAnalyticsExamId(exam.id)}>
                            <Badge variant="outline" className={isAssignment ? "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs" : isPractice ? "border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-xs" : "border-primary text-primary bg-primary/10 text-xs"}>
                              {isAssignment ? "واجب أسئلة" : isPractice ? "مراجعة تفاعلية" : "امتحان تقييمي"}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={() => setAnalyticsExamId(exam.id)}>
                            <Badge
                              variant={isPub ? "default" : "secondary"}
                              className={
                                isPub
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                  : "bg-muted text-muted-foreground text-xs"
                              }
                            >
                              {isPub ? "منشور ✓" : "مسودة 🔒"}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={() => setAnalyticsExamId(exam.id)} className="text-xs">
                            {duration} دقيقة
                          </TableCell>
                          <TableCell onClick={() => setAnalyticsExamId(exam.id)} className="text-xs">
                            {questionCount} أسئلة
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Publish / Unpublish Toggle */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTogglePublish(exam.id, !isPub)}
                                disabled={isToggling}
                                className={
                                  isPub
                                    ? "gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 text-xs h-8 rounded-lg"
                                    : "gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs h-8 rounded-lg"
                                }
                                title={isPub ? "إلغاء النشر وجعله مسودة" : "نشر الامتحان للطلاب فوراً"}
                              >
                                <Globe size={13} />
                                {isPub ? "إلغاء النشر" : "نشر"}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAnalyticsExamId(exam.id)}
                                className="gap-1 text-sky-600 border-sky-200 hover:bg-sky-50 text-xs h-8 rounded-lg"
                                title="تحليلات الطلاب"
                              >
                                <BarChart3 size={13} /> التحليلات
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setGradeEssayExamId(exam.id)}
                                className="gap-1 text-primary border-primary/30 hover:bg-primary/10 text-xs h-8 rounded-lg"
                                title="تصحيح المقالي"
                              >
                                <FileCheck2 size={13} /> التصحيح
                              </Button>

                              <Button variant="outline" size="sm" asChild className="h-8 w-8 p-0 rounded-lg" title="تعديل الاختبار">
                                <Link to={`/instructor/exams/builder?id=${exam.id}`}>
                                  <Edit size={14} />
                                </Link>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExamToDelete({ id: exam.id, title: exam.title })}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                title="حذف الامتحان"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredExams.map((exam: any) => {
                  const isPub = exam.is_published ?? exam.isPublished ?? true;
                  const isPractice = exam.exam_type === "PRACTICE" || exam.examType === "PRACTICE";
                  const isAssignment = exam.exam_type === "ASSIGNMENT" || exam.examType === "ASSIGNMENT";
                  const questionCount = exam.total_questions ?? exam.totalQuestions ?? (exam.questions ? exam.questions.length : 0);
                  const duration = exam.durationMinutes || exam.duration_minutes || 45;
                  const stage = exam.educationalStage || exam.educational_stage;
                  const grade = exam.educationalGrade || exam.educational_grade;

                  return (
                    <div
                      key={exam.id}
                      className="p-4 rounded-xl border border-border bg-card text-card-foreground shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3
                            className="font-bold text-base leading-snug cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setAnalyticsExamId(exam.id)}
                          >
                            {exam.title}
                          </h3>
                          {exam.course_title && (
                            <p className="text-xs text-muted-foreground mt-0.5">دورة: {exam.course_title}</p>
                          )}
                        </div>
                        <Badge
                          variant={isPub ? "default" : "secondary"}
                          className={isPub ? "bg-emerald-600 text-white text-[11px]" : "bg-muted text-muted-foreground text-[11px]"}
                        >
                          {isPub ? "منشور ✓" : "مسودة 🔒"}
                        </Badge>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Badge variant="outline" className={isAssignment ? "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30" : isPractice ? "border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-primary text-primary bg-primary/10"}>
                          {isAssignment ? "واجب أسئلة" : isPractice ? "مراجعة تفاعلية" : "امتحان تقييمي"}
                        </Badge>
                        {stage && (
                          <Badge variant="secondary" className="text-[10px]">
                            {STAGE_LABELS[stage as EducationalStage] || stage}
                          </Badge>
                        )}
                        {grade && (
                          <Badge variant="outline" className="text-[10px]">
                            {GRADE_LABELS[grade as EducationalGrade] || grade}
                          </Badge>
                        )}
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock size={12} />
                          {duration} د
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <HelpCircle size={12} />
                          {questionCount} أسئلة
                        </span>
                      </div>

                      {/* Mobile Actions Grid */}
                      <div className="pt-2 border-t border-border flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePublish(exam.id, !isPub)}
                          disabled={isToggling}
                          className={`flex-1 min-w-[110px] h-9 text-xs font-semibold rounded-xl ${
                            isPub ? "text-amber-600 border-amber-200" : "text-emerald-600 border-emerald-200"
                          }`}
                        >
                          <Globe size={13} className="ml-1" />
                          {isPub ? "إلغاء النشر" : "نشر للطلاب"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAnalyticsExamId(exam.id)}
                          className="flex-1 min-w-[90px] h-9 text-xs text-sky-600 border-sky-200 rounded-xl"
                        >
                          <BarChart3 size={13} className="ml-1" /> التحليلات
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-9 px-3 text-xs rounded-xl"
                        >
                          <Link to={`/instructor/exams/builder?id=${exam.id}`}>
                            <Edit size={14} className="ml-1" /> تعديل
                          </Link>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExamToDelete({ id: exam.id, title: exam.title })}
                          className="h-9 px-3 text-destructive hover:bg-destructive/10 rounded-xl"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={Boolean(examToDelete)} onOpenChange={() => setExamToDelete(null)}>
          <DialogContent className="sm:max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
                <AlertTriangle size={20} />
                تأكيد حذف الاختبار
              </DialogTitle>
              <DialogDescription>
                هل أنت متأكد من رغبتك في حذف امتحان <strong>"{examToDelete?.title}"</strong>؟ هذا الإجراء نهائي ولا يمكن التراجع عنه.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={() => setExamToDelete(null)} disabled={isDeleting} className="rounded-xl">
                إلغاء
              </Button>
              <Button variant="destructive" onClick={handleDeleteExam} disabled={isDeleting} className="gap-2 rounded-xl">
                {isDeleting ? "جاري الحذف..." : "تأكيد الحذف نهائياً"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Analytics Modal */}
        <ExamAnalyticsModal
          examId={analyticsExamId}
          isOpen={Boolean(analyticsExamId)}
          onClose={() => setAnalyticsExamId(null)}
        />

        {/* Grade Essay Modal */}
        <GradeEssayModal
          examId={gradeEssayExamId}
          open={Boolean(gradeEssayExamId)}
          onClose={() => setGradeEssayExamId(null)}
          onSuccess={() => refetch()}
        />

        {/* Question Bank Import Modal */}
        <QuestionBankImportModal
          isOpen={isQuestionBankModalOpen}
          onClose={() => setIsQuestionBankModalOpen(false)}
          onImportSuccess={() => {
            refetch();
          }}
        />
      </div>
    </Layout>
  );
}
