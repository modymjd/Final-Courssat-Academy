import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import Layout from "@/components/layout/Layout";
import { apiGet } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  BookOpenCheck,
  PlayCircle,
} from "lucide-react";

export interface ExamAnswerReview {
  id?: number;
  questionId: number;
  questionText: string;
  imageUrl?: string;
  questionType: string;
  pointsEarned: number;
  maxPoints: number;
  isCorrect: boolean;
  studentAnswer: any;
  correctAnswer: any;
  explanation?: string;
  options?: any[];
  videoReviewTimestamps?: { start: number; end?: number };
}

interface StudentExamAttempt {
  id: number;
  student: number;
  exam: number;
  examTitle: string;
  examDescription?: string;
  examDurationMinutes: number;
  maxScore: number;
  passThreshold: number;
  attemptNumber: number;
  score: string | number;
  isPassed: boolean;
  status: string;
  startedAt: string;
  completedAt: string;
  tabSwitchesCount: number;
  instructorFeedback?: string;
  answers?: ExamAnswerReview[];
}

export const ExamResult: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Fetch student's attempts for this exam
  const { data: attemptsData, isLoading } = useQuery({
    queryKey: ["studentExamAttempts", examId],
    queryFn: async () => {
      const res = await apiGet<any>(`/exams/${examId}/`);
      const myAttempts = await apiGet<any>("/exams/student/?latest=false");
      const list: StudentExamAttempt[] = Array.isArray(myAttempts)
        ? myAttempts
        : myAttempts?.results || [];
      const filtered = list.filter((a) => a.exam === examId || (a as any).examId === examId);
      return {
        exam: res,
        latestAttempt: filtered[0] || null,
        attempts: filtered,
      };
    },
    enabled: examId > 0,
  });

  const latestAttempt = attemptsData?.latestAttempt;
  const exam = attemptsData?.exam;

  const rawAnswers: any[] = latestAttempt?.answers || (latestAttempt as any)?.answer_details || [];
  const reviewAnswers: ExamAnswerReview[] = rawAnswers.map((a: any) => ({
    id: a.id,
    questionId: a.questionId ?? a.question_id,
    questionText: a.questionText ?? a.question_text ?? "",
    imageUrl: a.imageUrl ?? a.image_url ?? "",
    questionType: a.questionType ?? a.question_type ?? "multiple_choice",
    pointsEarned: Number(a.pointsEarned ?? a.points_earned ?? 0),
    maxPoints: Number(a.maxPoints ?? a.max_points ?? 1),
    isCorrect: Boolean(a.isCorrect ?? a.is_correct),
    studentAnswer: a.studentAnswer ?? a.student_answer,
    correctAnswer: a.correctAnswer ?? a.correct_answer,
    explanation: a.explanation ?? "",
    options: a.options ?? [],
    videoReviewTimestamps: a.videoReviewTimestamps ?? a.video_review_timestamps ?? (
      a.video_timestamp_start !== undefined ? { start: Number(a.video_timestamp_start), end: a.video_timestamp_end ? Number(a.video_timestamp_end) : undefined } : undefined
    ),
  }));

  const correctCount = reviewAnswers.filter((a) => a.isCorrect).length;
  const incorrectCount = reviewAnswers.length - correctCount;

  const rawScore = Number(latestAttempt?.score || 0);
  const rawMax = Number(latestAttempt?.maxScore || exam?.maxScore || 100);

  // The server-side attempt score is authoritative, especially after manual
  // grading of essay questions.
  const effectiveScore = rawScore;
  const effectiveMaxScore = rawMax;
  const percentage = Math.round((effectiveScore / Math.max(effectiveMaxScore, 1)) * 100);
  const passThreshold = latestAttempt?.passThreshold ?? exam?.passThreshold ?? 50;
  const isPendingManualGrade = String(latestAttempt?.status || "").toUpperCase() === "SUBMITTED";
  const isPassed = !isPendingManualGrade && Boolean(
    latestAttempt?.isPassed ?? percentage >= passThreshold
  );

  // 30-Second Cooldown Timer Countdown before Retake Button is Enabled
  const [cooldown, setCooldown] = useState<number>(30);

  useEffect(() => {
    if (isPassed || isPendingManualGrade) {
      setCooldown(0);
      return;
    }

    setCooldown(30);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPassed, isPendingManualGrade]);

  // Review sections for incorrect questions that have timestamps
  const reviewSections = reviewAnswers.filter(
    (ans) => !ans.isCorrect && ans.videoReviewTimestamps && typeof ans.videoReviewTimestamps.start === "number"
  );

  const [reviewFilter, setReviewFilter] = useState<"all" | "correct" | "incorrect">("all");

  const filteredAnswers = reviewAnswers.filter((ans) => {
    if (reviewFilter === "correct") return ans.isCorrect;
    if (reviewFilter === "incorrect") return !ans.isCorrect;
    return true;
  });

  // Trigger celebration confetti if passed
  useEffect(() => {
    if (isPassed && !isPendingManualGrade && !isLoading) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10b981", "#6366f1", "#f59e0b", "#3b82f6"],
        });
      } catch {
        // Safe fallback if confetti canvas fails
      }
    }
  }, [isPassed, isPendingManualGrade, isLoading]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4 max-w-2xl animate-pulse space-y-6">
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-10 px-4 max-w-3xl">
        {/* Top Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-medium">
          <Link to="/student/dashboard" className="hover:text-indigo-600">
            {t("examResult.dashboard", "لوحة التحكم")}
          </Link>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          <span>{exam?.title || t("examResult.title", "نتيجة الاختبار")}</span>
        </div>

        {/* Hero Result Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 rounded-3xl overflow-hidden text-center p-8 sm:p-12 relative">
          <div className="space-y-6">
            {/* Status Icon */}
            <div className="flex justify-center">
              {isPendingManualGrade ? (
                <div className="w-24 h-24 rounded-3xl bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-lg">
                  <Clock className="w-12 h-12" />
                </div>
              ) : isPassed ? (
                <div className="w-24 h-24 rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 border-2 border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10 scale-105">
                  <Trophy className="w-12 h-12 animate-bounce" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-300 dark:border-rose-700 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-lg shadow-rose-500/10">
                  <XCircle className="w-12 h-12" />
                </div>
              )}
            </div>

            {/* Header Text */}
            <div>
              <Badge
                className={`text-xs px-3 py-1 font-bold rounded-full ${
                  isPendingManualGrade
                    ? "bg-amber-500 hover:bg-amber-500 text-white"
                    : isPassed
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-rose-500 hover:bg-rose-600 text-white"
                }`}
              >
                {isPendingManualGrade
                  ? "بانتظار تصحيح المدرس"
                  : isPassed
                  ? t("examResult.passedBadge", "ناجح بجدارة ✓")
                  : t("examResult.failedBadge", "لم يتم اجتياز الاختبار")}
              </Badge>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
                {isPendingManualGrade
                  ? "تم تسليم إجابتك وسيظهر التقييم بعد التصحيح"
                  : isPassed
                  ? t("examResult.congratsTitle", "تهانينا! لقد اجتزت الاختبار بنجاح")
                  : t("examResult.failTitle", "حاول مرة أخرى لتحسين نتيجتك")}
              </h1>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {exam?.title || "الاختبار التقييمي"}
              </p>
            </div>

            {/* Score Big Display */}
            <div className="p-6 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl max-w-sm mx-auto space-y-3">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white">
                  {effectiveScore}
                </span>
                <span className="text-xl font-bold text-slate-400">/ {effectiveMaxScore}</span>
              </div>

              <div className="space-y-1.5">
                <Progress
                  value={percentage}
                  className={`h-3 bg-slate-200 dark:bg-slate-700 ${
                    isPassed ? "[&>div]:bg-emerald-500" : "[&>div]:bg-rose-500"
                  }`}
                />
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>{t("examResult.yourPercent", "نسبتك")}: {percentage}%</span>
                  <span>{t("examResult.requiredPass", "درجة النجاح")}: {passThreshold}%</span>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-right">
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-[11px] text-slate-400 font-bold">الأسئلة الصحيحة</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {correctCount} من {reviewAnswers.length || exam?.totalQuestions || 0}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-[11px] text-slate-400 font-bold">{t("examResult.attemptNum", "المحاولة")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestAttempt?.attemptNumber || 1} / {exam?.attemptsAllowed || 1}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-[11px] text-slate-400 font-bold">{t("examResult.duration", "المدة")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                  {exam?.durationMinutes || 60} {t("examResult.minutes", "دقيقة")}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-[11px] text-slate-400 font-bold">{t("examResult.tabSwitches", "تبديل النوافذ")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestAttempt?.tabSwitchesCount || 0}
                </p>
              </div>
            </div>

            {/* Instructor Feedback if available */}
            {latestAttempt?.instructorFeedback && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-2xl text-right max-w-lg mx-auto">
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                  {t("examResult.instructorFeedback", "ملاحظات المعلم:")}
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {latestAttempt.instructorFeedback}
                </p>
              </div>
            )}

            {/* Pass Celebration Banner */}
            {isPassed && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 max-w-lg mx-auto flex items-center justify-center gap-2 font-bold text-sm">
                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>تم فتح الدرس التالي بنجاح ✓</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {exam?.course && (
                <Button variant="outline" asChild className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold gap-2">
                  <Link to={`/course/${exam.course}`}>
                    <BookOpen className="w-4 h-4" />
                    {t("examResult.backToCourse", "العودة إلى الدورة")}
                  </Link>
                </Button>
              )}

              <Button asChild className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
                <Link to="/student/dashboard">
                  <GraduationCap className="w-4 h-4" />
                  {t("examResult.myDashboard", "لوحة التعلم الخاصة بي")}
                </Link>
              </Button>

              {!isPendingManualGrade && (!isPassed || (latestAttempt?.attemptNumber || 1) < (exam?.attemptsAllowed || 1)) && (
                <Button
                  variant="secondary"
                  disabled={!isPassed && cooldown > 0}
                  onClick={() => navigate(`/exam/${examId}/session`)}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold gap-2 min-w-[160px]"
                >
                  <RotateCcw className={`w-4 h-4 ${!isPassed && cooldown > 0 ? "animate-spin" : ""}`} />
                  {!isPassed && cooldown > 0
                    ? `إعادة المحاولة (${cooldown} ثانية)`
                    : t("examResult.retakeExam", "إعادة المحاولة")}
                </Button>
              )}
            </div>

            {/* Review sections (أجزاء تحتاج إلى مراجعة) for failed exams */}
            {!isPendingManualGrade && !isPassed && reviewSections.length > 0 && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-right space-y-3 mt-4">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-black text-sm">
                  <PlayCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>أجزاء تحتاج إلى مراجعة قبل إعادة الاختبار</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  راجع المقاطع التعليمية التالية في الدرس للأسئلة غير الصحيحة لرفع مستواك واجتياز الاختبار بنجاح:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {reviewSections.map((sec, i) => {
                    const startSec = sec.videoReviewTimestamps!.start;
                    const mins = Math.floor(startSec / 60);
                    const secs = startSec % 60;
                    const timeFormatted = `${mins}:${secs.toString().padStart(2, "0")}`;
                    const lessonTarget = exam?.lesson || 0;
                    const courseTarget = exam?.course || 0;
                    const linkHref = courseTarget && lessonTarget
                      ? `/course/${courseTarget}/lesson/${lessonTarget}#t=${startSec}`
                      : courseTarget
                      ? `/course/${courseTarget}#t=${startSec}`
                      : `#`;

                    return (
                      <Link
                        key={i}
                        to={linkHref}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/5 transition-all text-xs font-bold text-foreground group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[11px] shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate max-w-[200px]">{sec.questionText}</span>
                        </div>
                        <span className="text-primary font-mono shrink-0 group-hover:underline">
                          {timeFormatted} ◀
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Questions & Answers Review Section */}
        {!isPendingManualGrade && reviewAnswers.length > 0 && (
          <section className="mt-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2.5">
                  <BookOpenCheck className="w-6 h-6 text-primary" />
                  مراجعة الأسئلة والإجابات النموذجية
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  اطلع على تفاصيل إجاباتك مقارنة بالإجابات الصحيحة وشروح الأساتذة الأكاديمية.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-muted rounded-2xl shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setReviewFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reviewFilter === "all"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  الكل ({reviewAnswers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter("correct")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    reviewFilter === "correct"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "text-muted-foreground hover:text-emerald-600"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  الصحيحة ({correctCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter("incorrect")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    reviewFilter === "incorrect"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-muted-foreground hover:text-rose-600"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  الخاطئة ({incorrectCount})
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {filteredAnswers.map((ans, idx) => (
                <Card
                  key={ans.questionId || idx}
                  className={`rounded-2xl border-2 overflow-hidden transition-all shadow-xs ${
                    ans.isCorrect
                      ? "border-emerald-500/30 dark:border-emerald-500/20 bg-card"
                      : "border-rose-500/30 dark:border-rose-500/20 bg-card"
                  }`}
                >
                  {/* Top Indicator Strip */}
                  <div className={`h-1.5 w-full ${ans.isCorrect ? "bg-emerald-500" : "bg-rose-500"}`} />

                  <CardContent className="p-5 sm:p-6 space-y-4">
                    {/* Header: Question Number, Type, Status Badge, Points */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-8 h-8 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center shrink-0 ${
                            ans.isCorrect
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground block">
                            {ans.questionType === "true_false"
                              ? "صواب أو خطأ"
                              : ans.questionType === "essay"
                              ? "سؤال مقالي"
                              : "اختيار من متعدد"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            ans.isCorrect
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {ans.isCorrect ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={12} /> إجابة صحيحة
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle size={12} /> إجابة غير صحيحة
                            </span>
                          )}
                        </Badge>

                        <Badge variant="outline" className="text-xs font-bold">
                          {ans.pointsEarned} / {ans.maxPoints} درجة
                        </Badge>
                      </div>
                    </div>

                    {/* Question Text */}
                    <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed">
                      {ans.questionText}
                    </p>
                    {ans.imageUrl && (
                      <img
                        src={ans.imageUrl}
                        alt="صورة توضيحية للسؤال"
                        className="max-h-[360px] w-auto max-w-full rounded-xl border border-border bg-background object-contain"
                        loading="lazy"
                      />
                    )}

                    {/* Answers Comparison Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {/* Student Answer */}
                      <div
                        className={`p-3.5 rounded-xl border ${
                          ans.isCorrect
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
                            : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-1 text-muted-foreground">
                          {ans.isCorrect ? (
                            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle size={14} className="text-rose-600 dark:text-rose-400" />
                          )}
                          <span>إجابتك المسجلة:</span>
                        </div>
                        <p
                          className={`text-sm font-black ${
                            ans.isCorrect
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {!ans.isCorrect && !isPassed
                            ? "غير صحيحة"
                            : ans.studentAnswer !== undefined && ans.studentAnswer !== null && String(ans.studentAnswer).trim() !== ""
                            ? String(ans.studentAnswer)
                            : "لم تتم الإجابة على السؤال"}
                        </p>
                      </div>

                      {/* Correct Answer - Strictly suppressed if !isPassed */}
                      {isPassed && ans.correctAnswer !== undefined && ans.correctAnswer !== null && String(ans.correctAnswer).trim() !== "" && (
                        <div className="p-3.5 rounded-xl border bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/25">
                          <div className="flex items-center gap-1.5 text-xs font-bold mb-1 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                            <span>الإجابة النموذجية المعتمدة:</span>
                          </div>
                          <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                            {String(ans.correctAnswer)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Scientific Explanation / Proof - Strictly suppressed if !isPassed */}
                    {isPassed && ans.explanation && (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-500/20 text-foreground text-xs sm:text-sm leading-relaxed space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <Sparkles size={14} />
                          <span>البرهان والتفسير الأكاديمي:</span>
                        </div>
                        <p className="text-muted-foreground">{ans.explanation}</p>
                      </div>
                    )}

                    {/* Video review button for incorrect question */}
                    {!ans.isCorrect && ans.videoReviewTimestamps && typeof ans.videoReviewTimestamps.start === "number" && (
                      <div className="pt-2">
                        <Link
                          to={
                            exam?.course && exam?.lesson
                              ? `/course/${exam.course}/lesson/${exam.lesson}#t=${ans.videoReviewTimestamps.start}`
                              : exam?.course
                              ? `/course/${exam.course}#t=${ans.videoReviewTimestamps.start}`
                              : "#"
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-colors"
                        >
                          <PlayCircle size={14} />
                          <span>
                            مراجعة الجزء في الفيديو ({Math.floor(ans.videoReviewTimestamps.start / 60)}:
                            {String(ans.videoReviewTimestamps.start % 60).padStart(2, "0")})
                          </span>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default ExamResult;
