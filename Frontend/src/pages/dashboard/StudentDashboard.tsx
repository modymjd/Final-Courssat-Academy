import React, { lazy, Suspense, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { FocusSessionButton } from "@/components/common/FocusSessionButton";
import CourseCard from "@/components/course/CourseCard";
import { useAuth } from "@/features/auth";
import { useStudentDashboard } from "@/features/dashboard";
import { listCourses } from "@/features/courses/api";
import { useStudentWallet } from "@/hooks/usePlatformPricing";
import { STAGE_LABELS, GRADE_LABELS, TRACK_LABELS } from "@/lib/curriculumData";
import {
  BookOpen, Award, Bell, Clock, Calendar,
  CheckCircle, PlayCircle, ArrowLeft, GraduationCap, FileText,
  Flame, Zap, Wallet, Sparkles
} from "lucide-react";

const STAT_ICONS: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen size={20} />,
  CheckCircle: <CheckCircle size={20} />,
  Clock: <Clock size={20} />,
  Award: <Award size={20} />,
};

const StudentExamsTab = lazy(() => import("./StudentExamsTab"));
const StudentGradesTab = lazy(() => import("./StudentGradesTab"));
const StudentNotificationsTab = lazy(() => import("./StudentNotificationsTab"));

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

import { LearningHeatmapWidget } from "@/components/dashboard/LearningHeatmapWidget";
import { FeatureGate } from "@/components/FeatureGate";
import { apiGet } from "@/lib/http";

interface SummaryData {
  streak_days: number;
  today_minutes: number;
  daily_target_minutes: number;
  total_xp: number;
  level: number;
  activity_heatmap: Record<string, number>;
  badges: any[];
}

const getCourseInstructorName = (course: any): string => {
  if (!course) return "مدرب معتمد";
  const ins = course.instructor;
  if (!ins) return "مدرب معتمد";
  if (typeof ins === "string") return ins;
  return ins.name || ins.fullName || ins.full_name || "مدرب معتمد";
};

const getCourseCategoryName = (course: any): string => {
  if (!course) return "عام";
  const cat = course.category;
  if (!cat) return "عام";
  if (typeof cat === "string") return cat;
  return cat.name || "عام";
};

function formatArabicDays(count: number): string {
  if (count === 0) return "0 يوم";
  if (count === 1) return "يوم واحد";
  if (count === 2) return "يومان";
  if (count >= 3 && count <= 10) return `${count} أيام`;
  return `${count} يوماً`;
}

function resolveMediaUrl(src?: string | null): string {
  if (!src || !src.trim() || src === "/placeholder.svg") return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:")) {
    return src;
  }
  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "")
    : "http://127.0.0.1:8000";
  return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useStudentDashboard();
  const { wallet } = useStudentWallet();

  const curriculumLabel = useMemo(() => {
    const parts: string[] = [];
    if (user?.educationLevel && STAGE_LABELS[user.educationLevel as keyof typeof STAGE_LABELS]) {
      parts.push(STAGE_LABELS[user.educationLevel as keyof typeof STAGE_LABELS]);
    }
    if (user?.gradeLevel && GRADE_LABELS[user.gradeLevel as keyof typeof GRADE_LABELS]) {
      parts.push(GRADE_LABELS[user.gradeLevel as keyof typeof GRADE_LABELS]);
    }
    if (user?.educationalTrack && TRACK_LABELS[user.educationalTrack]) {
      parts.push(TRACK_LABELS[user.educationalTrack]);
    }
    return parts.join(" • ");
  }, [user?.educationLevel, user?.gradeLevel, user?.educationalTrack]);

  const { data: recommendedCoursesData, isLoading: isRecommendedLoading } = useQuery({
    queryKey: ["courses", "recommended", user?.educationLevel, user?.gradeLevel, user?.educationalTrack],
    queryFn: async () => {
      const params: Record<string, unknown> = { pageSize: 6 };
      if (user?.educationLevel) params.educational_stage = user.educationLevel;
      if (user?.gradeLevel) params.educational_grade = user.gradeLevel;
      if (user?.educationalTrack) params.educational_track = user.educationalTrack;
      return listCourses(params);
    },
    enabled: !!(user?.educationLevel || user?.gradeLevel),
  });

  const summary = data?.summary as SummaryData | undefined;
  const examsData = data?.exams;

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-xl mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const enrollments = data?.enrollments || data?.recentEnrollments || [];
  const stats = data?.stats || [];
  
  const attemptsList = Array.isArray(examsData) ? examsData : examsData?.results || [];
  const publishedList = Array.isArray((data as any)?.publishedExams)
    ? (data as any).publishedExams
    : (data as any)?.publishedExams?.results || [];

  // Group attempts by exam ID and find the latest attempt
  const latestAttemptsByExamId = new Map<string, any>();
  for (const att of attemptsList) {
    const rawExam = att.exam as Record<string, unknown> | number | string | undefined;
    const rawExamId =
      typeof rawExam === "object" && rawExam !== null
        ? rawExam.id
        : att.exam_id ?? att.examId ?? att.exam;
    if (!rawExamId) continue;
    const examId = String(rawExamId);

    const existing = latestAttemptsByExamId.get(examId);
    if (!existing) {
      latestAttemptsByExamId.set(examId, att);
    } else {
      const currentAttemptNum = Number(att.attempt_number ?? att.attemptNumber ?? 1);
      const existingAttemptNum = Number(existing.attempt_number ?? existing.attemptNumber ?? 1);
      if (currentAttemptNum > existingAttemptNum) {
        latestAttemptsByExamId.set(examId, att);
      }
    }
  }

  // Combine published exams and attempts into a single unified list
  const unifiedExamsMap = new Map<string, any>();

  // 1. Add all published exams
  for (const pub of publishedList) {
    const examId = String(pub.id);
    const attempt = latestAttemptsByExamId.get(examId);

    if (attempt) {
      const attemptsAllowed = Number(
        attempt.attempts_allowed ?? attempt.attemptsAllowed ?? pub.attempts_allowed ?? pub.attemptsAllowed ?? 1
      );
      const attemptNum = Number(attempt.attempt_number ?? attempt.attemptNumber ?? 1);
      const maxScore = Number(attempt.max_score ?? attempt.maxScore ?? pub.max_score ?? pub.maxScore ?? 100);
      const score = attempt.score !== null && attempt.score !== undefined ? Number(attempt.score) : null;
      const percentage =
        attempt.percentage ??
        (score !== null ? Math.round((score / Math.max(maxScore, 1)) * 100) : null);

      unifiedExamsMap.set(examId, {
        id: Number(examId),
        title: attempt.exam_title || attempt.examTitle || pub.title || "اختبار",
        description: attempt.exam_description || attempt.examDescription || pub.description || "",
        durationMinutes:
          attempt.exam_duration_minutes ||
          attempt.examDurationMinutes ||
          pub.duration_minutes ||
          pub.durationMinutes ||
          60,
        totalQuestions: attempt.total_questions || attempt.totalQuestions || pub.question_count || 10,
        status: String(attempt.status || (score !== null ? "GRADED" : "PENDING")).toLowerCase(),
        isPassed:
          attempt.is_passed ??
          (percentage !== null ? percentage >= (pub.pass_threshold ?? 50) : false),
        score,
        maxScore,
        percentage,
        attemptsAllowed,
        attemptNumber: attemptNum,
        hasAttempt: true,
      });
    } else {
      const attemptsAllowed = Number(pub.attempts_allowed ?? pub.attemptsAllowed ?? 1);
      const maxScore = Number(pub.max_score ?? pub.maxScore ?? 100);

      unifiedExamsMap.set(examId, {
        id: Number(examId),
        title: pub.title || "اختبار",
        description: pub.description || "",
        durationMinutes: pub.duration_minutes || pub.durationMinutes || 60,
        totalQuestions: pub.question_count || 10,
        status: "pending",
        isPassed: false,
        score: null,
        maxScore,
        percentage: null,
        attemptsAllowed,
        attemptNumber: 0,
        hasAttempt: false,
      });
    }
  }

  // 2. Add any attempts that might not have been in publishedList
  for (const [examId, attempt] of latestAttemptsByExamId.entries()) {
    if (!unifiedExamsMap.has(examId)) {
      const attemptsAllowed = Number(attempt.attempts_allowed ?? attempt.attemptsAllowed ?? 1);
      const attemptNum = Number(attempt.attempt_number ?? attempt.attemptNumber ?? 1);
      const maxScore = Number(attempt.max_score ?? attempt.maxScore ?? 100);
      const score = attempt.score !== null && attempt.score !== undefined ? Number(attempt.score) : null;
      const percentage =
        attempt.percentage ??
        (score !== null ? Math.round((score / Math.max(maxScore, 1)) * 100) : null);

      unifiedExamsMap.set(examId, {
        id: Number(examId),
        title: attempt.exam_title || attempt.examTitle || "اختبار",
        description: attempt.exam_description || attempt.examDescription || "",
        durationMinutes: attempt.exam_duration_minutes || attempt.examDurationMinutes || 60,
        totalQuestions: attempt.total_questions || attempt.totalQuestions || 10,
        status: String(attempt.status || (score !== null ? "GRADED" : "PENDING")).toLowerCase(),
        isPassed: attempt.is_passed ?? (percentage !== null ? percentage >= 50 : false),
        score,
        maxScore,
        percentage,
        attemptsAllowed,
        attemptNumber: attemptNum,
        hasAttempt: true,
      });
    }
  }

  const formattedExamsData = Array.from(unifiedExamsMap.values());

  const upcomingEvents = data?.upcomingEvents || data?.upcoming_events || [];
  const recentGrades = data?.recentGrades || data?.recent_grades || [];
  const notifications = data?.notifications || [];
  const activeCourses = enrollments.filter((e: any) => !e.completedAt && !e.completed_at);
  const completedCourses = enrollments.filter((e: any) => e.completedAt || e.completed_at);

  const streakCount = summary?.streak_days ?? (data as any)?.streak_days ?? user?.studyStreak ?? 0;

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8 dir-rtl">
        {/* Top Header Banner - Fully Mobile Responsive */}
        <motion.div
          className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card/70 backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/60 shadow-xs"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 text-foreground">
              مرحباً، {user?.firstName} 👋
            </h1>
            {curriculumLabel ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/25 text-xs font-semibold py-1 px-3 rounded-xl flex items-center gap-1.5 shadow-xs">
                  <GraduationCap size={15} />
                  <span>{curriculumLabel}</span>
                </Badge>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  تابع رحلتك التعليمية واستمر في التقدم والمذاكرة الفعالة
                </p>
                <Link to="/settings" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                  (أكمل بيانات مرحلتك الدراسية)
                </Link>
              </div>
            )}
          </div>

          {/* Quick Tools Bar - Touch Swipeable on Mobile */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-0 w-full lg:w-auto scrollbar-none touch-pan-x">
            <div className="flex items-center gap-1.5 bg-achievement/10 border border-achievement/30 text-achievement px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
              <Flame className="w-4 h-4 fill-current animate-bounce" />
              <span>شعلة المذاكرة: {formatArabicDays(streakCount)}</span>
            </div>

            <FeatureGate feature="xp_system">
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
                <Zap className="w-4 h-4 fill-current" />
                <span>المستوى {summary?.level || 1} ({summary?.total_xp || 120} XP)</span>
              </div>
            </FeatureGate>

            <FeatureGate feature="focus_mode">
              <div className="shrink-0">
                <FocusSessionButton />
              </div>
            </FeatureGate>

            <FeatureGate feature="notes">
              <Button asChild size="sm" variant="outline" className="rounded-xl border-border/80 text-xs shrink-0 px-3">
                <Link to="/student/notebook" className="gap-1.5">
                  <FileText className="w-4 h-4 text-teal-500" />
                  <span>الدفتر الذكي</span>
                </Link>
              </Button>
            </FeatureGate>

            <Button asChild size="sm" variant="outline" className="rounded-xl border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-xs shrink-0 px-3 hover:bg-emerald-100/50">
              <Link to="/student/wallet" className="gap-1.5 font-bold">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>محفظتي ({wallet ? Number(wallet.available_balance).toLocaleString() : 0} ج.م)</span>
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* 52-Week Activity Heatmap */}
        <FeatureGate feature="analytics">
          <LearningHeatmapWidget activityMatrix={summary?.activity_heatmap || {}} />
        </FeatureGate>

        {/* Stats Row */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 student-dashboard-stats"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp}>
              <StatCard
                title={stat.label}
                value={stat.value}
                icon={STAT_ICONS[stat.icon ?? ""] ?? <BookOpen size={20} />}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Continue Learning */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <PlayCircle size={20} className="text-primary" />
              جاري التعلم
              {activeCourses.length > 0 && (
                <Badge variant="secondary" className="text-[11px] px-2 py-0.5 rounded-lg font-bold">
                  {activeCourses.length}
                </Badge>
              )}
            </h2>
            <Link to="/courses" className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 font-semibold">
              تصفح الدورات
              <ArrowLeft size={14} />
            </Link>
          </div>

          {activeCourses.length === 0 && completedCourses.length === 0 ? (
            <EmptyState
              title="لم تسجل في أي دورة بعد"
              description="ابدأ رحلتك التعليمية الآن وتصفح مئات الدورات المتاحة"
              action={{ label: "تصفح الدورات", onClick: () => navigate("/courses") }}
              icon={<GraduationCap className="h-16 w-16" />}
            />
          ) : activeCourses.length === 0 ? (
            <Card className="border-dashed border-primary/25 bg-primary/5 rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground font-medium">أحسنت! أكملت جميع دوراتك المسجلة 🎉</p>
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl text-xs font-bold">
                <Link to="/courses">سجل في دورة جديدة</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {activeCourses.map((enrollment: any) => {
                const courseId = enrollment.courseId || enrollment.course_id || enrollment.course?.id || "";
                const courseTitle = enrollment.course?.title || "دورة تعليمية";
                const instructorName = getCourseInstructorName(enrollment.course);
                const categoryName = getCourseCategoryName(enrollment.course);
                const progress = Number(enrollment.progress) || 0;
                const completedCount = (enrollment.completedLessonIds || enrollment.completed_lesson_ids || []).length;
                const lessonCount = enrollment.course?.lessonCount ?? enrollment.course?.lesson_count ?? 0;
                const lastAccessed = enrollment.lastAccessedAt || enrollment.last_accessed_at || "مؤخراً";
                const rawImg = enrollment.course?.image || enrollment.course?.thumbnail || enrollment.course?.coverImage || enrollment.course?.cover_image || enrollment.course?.imageUrl;
                const courseImage = rawImg ? resolveMediaUrl(rawImg) : "";
                const nextLessonId = enrollment.nextLessonId || enrollment.next_lesson_id;
                const nextLessonTitle = enrollment.nextLessonTitle || enrollment.next_lesson_title;
                const resumeUrl = nextLessonId ? `/course/${courseId}/lesson/${nextLessonId}` : `/course/${courseId}`;

                return (
                  <Card key={enrollment.id} className="group transition-all duration-300 hover:shadow-lg hover:border-primary/40 border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card">
                    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/20 via-emerald-600/15 to-primary/5">
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-primary/40 p-4 text-center">
                        <BookOpen className="w-10 h-10" />
                        <span className="text-[11px] font-bold opacity-60 line-clamp-1">{courseTitle}</span>
                      </div>
                      {courseImage && (
                        <img
                          src={courseImage}
                          alt={courseTitle}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <Badge variant="secondary" className="absolute top-2.5 start-2.5 text-[10px] px-2.5 py-0.5 backdrop-blur-md bg-background/85 font-semibold">
                        {categoryName}
                      </Badge>
                      <div className="absolute bottom-2 start-2.5 end-2.5 flex items-center justify-between text-white text-[11px] font-medium pointer-events-none">
                        <span className="flex items-center gap-1 drop-shadow-sm">
                          <Clock size={12} />
                          {lastAccessed}
                        </span>
                        <span className="bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
                          {completedCount}/{lessonCount} درس
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <Link to={`/course/${courseId}`}>
                          <h3 className="font-bold text-sm sm:text-base leading-snug hover:text-primary transition-colors line-clamp-2 mb-0.5">
                            {courseTitle}
                          </h3>
                        </Link>
                        <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{instructorName}</p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>التقدم</span>
                          <span className="font-bold text-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2 rounded-full" />
                      </div>
                      <Button asChild size="sm" className="w-full rounded-xl text-xs font-bold h-9">
                        <Link to={resumeUrl} className="flex items-center justify-center gap-1.5 truncate">
                          <PlayCircle size={15} className="shrink-0" />
                          <span className="truncate">{nextLessonTitle ? `إكمال: ${nextLessonTitle}` : "إكمال الدرس"}</span>
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Completed Courses — permanently visible below active */}
          {completedCourses.length > 0 && (
            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-500" />
                  الدورات المكتملة
                </h2>
                <Badge className="text-[11px] px-2.5 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-600 border-0">
                  {completedCourses.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {completedCourses.map((enrollment: any) => {
                  const courseId = enrollment.courseId || enrollment.course_id || enrollment.course?.id || "";
                  const courseTitle = enrollment.course?.title || "دورة تعليمية";
                  const instructorName = getCourseInstructorName(enrollment.course);
                  const categoryName = getCourseCategoryName(enrollment.course);
                  const lessonCount = enrollment.course?.lessonCount ?? enrollment.course?.lesson_count ?? 0;
                  const rawImg = enrollment.course?.image || enrollment.course?.thumbnail || enrollment.course?.coverImage || enrollment.course?.cover_image || enrollment.course?.imageUrl;
                  const courseImage = rawImg ? resolveMediaUrl(rawImg) : "";
                  const certificateId = enrollment.certificateId || enrollment.certificate_id;

                  return (
                    <Card key={enrollment.id} className="group transition-all duration-300 hover:shadow-lg border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl overflow-hidden flex flex-col bg-card">
                      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-emerald-500/20 via-teal-600/15 to-emerald-500/5">
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-emerald-500/40 p-4 text-center">
                          <CheckCircle className="w-10 h-10" />
                          <span className="text-[11px] font-bold opacity-60 line-clamp-1">{courseTitle}</span>
                        </div>
                        {courseImage && (
                          <img
                            src={courseImage}
                            alt={courseTitle}
                            className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-opacity duration-500"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                        <Badge className="absolute top-2.5 start-2.5 text-[10px] px-2.5 py-0.5 bg-emerald-500 text-white border-0 font-bold flex items-center gap-1 shadow-sm">
                          <CheckCircle size={10} />
                          مكتملة
                        </Badge>
                        <div className="absolute bottom-2 end-2.5 text-white text-[11px] font-medium pointer-events-none">
                          <span className="bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">{lessonCount} درس</span>
                        </div>
                      </div>

                      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <Link to={`/course/${courseId}`}>
                            <h3 className="font-bold text-sm sm:text-base leading-snug hover:text-emerald-600 transition-colors line-clamp-2 mb-0.5">
                              {courseTitle}
                            </h3>
                          </Link>
                          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{instructorName}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md mt-1.5 border-border/60 text-muted-foreground">
                            {categoryName}
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-emerald-600">
                            <span>مكتمل بالكامل</span>
                            <span>100%</span>
                          </div>
                          <Progress value={100} className="h-2 rounded-full [&>div]:bg-emerald-500" />
                        </div>
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline" className="flex-1 rounded-xl text-xs font-bold h-9 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                            <Link to={`/course/${courseId}`} className="flex items-center justify-center gap-1">
                              <BookOpen size={13} className="shrink-0" />
                              مراجعة
                            </Link>
                          </Button>
                          {certificateId && (
                            <Button asChild size="sm" className="flex-1 rounded-xl text-xs font-bold h-9 bg-emerald-500 hover:bg-emerald-600 text-white">
                              <Link to={`/certificate/${certificateId}`} className="flex items-center justify-center gap-1">
                                <Award size={13} className="shrink-0" />
                                الشهادة
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </motion.section>

        {/* Egyptian Curriculum Courses Section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                <Sparkles size={20} className="text-amber-500" />
                <span>مناهج ومقررات صفي الدراسي</span>
              </h2>
              {curriculumLabel ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  دورات ومناهج مقترحة خصيصاً لـ: <span className="font-semibold text-foreground">{curriculumLabel}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  دورات مقترحة وفقاً لمنهجك التعليمي
                </p>
              )}
            </div>
            <Link
              to="/courses"
              className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              تصفح كل المقررات
              <ArrowLeft size={14} />
            </Link>
          </div>

          {!user?.educationLevel && !user?.gradeLevel ? (
            <Card className="border-dashed border-primary/30 bg-primary/5 rounded-2xl p-5 text-center sm:text-start flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">
                    حدد مرحلتك وصفك الدراسي لعرض مقرراتك المنهجية
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختر مرحلتك التعليمية (ابتدائي، إعدادي، ثانوي، أو بكالوريا مصرية) في إعدادات حسابك لتظهر لك موادك الدراسية هنا مباشرة.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="rounded-xl font-bold shrink-0 px-4">
                <Link to="/settings">
                  ضبط المرحلة الدراسية
                </Link>
              </Button>
            </Card>
          ) : isRecommendedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (recommendedCoursesData?.data && recommendedCoursesData.data.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {recommendedCoursesData.data.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  instructor={course.instructor}
                  description={course.description || course.shortDescription}
                  image={course.image ? resolveMediaUrl(course.image) : "/placeholder.svg"}
                  duration={course.duration}
                  level={course.level}
                  category={course.category}
                  price={course.price}
                  isFree={course.isFree}
                  educationalStage={course.educationalStage}
                  educationalGrade={course.educationalGrade}
                  educationalTrack={course.educationalTrack}
                  subject={course.subject}
                  subjectBranch={course.subjectBranch}
                />
              ))}
            </div>
          ) : (
            <Card className="border-border/60 bg-muted/20 rounded-2xl p-6 text-center">
              <div className="max-w-md mx-auto space-y-2">
                <BookOpen className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                <p className="font-bold text-xs sm:text-sm text-foreground">
                  جاري إضافة دورات جديدة لمنهج {curriculumLabel || "صفك الدراسي"}
                </p>
                <p className="text-xs text-muted-foreground">
                  يمكنك استكشاف المقررات المتاحة لجميع المراحل من خلال دليل الدورات.
                </p>
                <Button asChild variant="outline" size="sm" className="rounded-xl text-xs mt-2">
                  <Link to="/courses">تصفح كل المقررات</Link>
                </Button>
              </div>
            </Card>
          )}
        </motion.section>

        {/* Tabs Section - Touch Horizontal Scroll Bar on Mobile */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="upcoming" className="mb-8">
            <div className="overflow-x-auto pb-2 scrollbar-none touch-pan-x mb-4">
              <TabsList className="inline-flex w-max sm:w-auto p-1.5 bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl gap-1">
                <TabsTrigger value="upcoming" className="gap-1.5 text-xs font-bold px-3 py-2 rounded-xl">
                  <Calendar size={15} />
                  <span>القادم</span>
                </TabsTrigger>
                <TabsTrigger value="exams" className="gap-1.5 text-xs font-bold px-3 py-2 rounded-xl">
                  <FileText size={15} />
                  <span>الاختبارات المطلوبة</span>
                </TabsTrigger>
                <TabsTrigger value="grades" className="gap-1.5 text-xs font-bold px-3 py-2 rounded-xl">
                  <Award size={15} />
                  <span>الدرجات</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-1.5 text-xs font-bold px-3 py-2 rounded-xl">
                  <Bell size={15} />
                  <span>الإشعارات</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="upcoming">
              <Card className="border-border/60 rounded-2xl overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base font-bold">الدروس والمواعيد القادمة</CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingEvents.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs sm:text-sm py-6">لا توجد مواعيد قادمة</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              event.type === "quiz" ? "bg-amber-500" :
                              event.type === "deadline" ? "bg-destructive" : "bg-primary"
                            }`} />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold truncate">{event.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{event.courseName ?? event.course_name}</p>
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <Badge variant={event.type === "deadline" ? "destructive" : "secondary"} className="text-[10px] px-2">
                              {event.type === "quiz" ? "اختبار" : event.type === "deadline" ? "موعد تسليم" : "درس"}
                            </Badge>
                            {event.time && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{event.time}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exams">
              <ErrorBoundary>
                <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-2xl" />}>
                  <StudentExamsTab examsData={formattedExamsData} />
                </Suspense>
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="grades">
              <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-2xl" />}>
                <StudentGradesTab recentGrades={recentGrades} />
              </Suspense>
            </TabsContent>

            <TabsContent value="notifications">
              <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-2xl" />}>
                <StudentNotificationsTab notifications={notifications} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </motion.div>

      </div>
    </Layout>
  );
};

export default StudentDashboard;
