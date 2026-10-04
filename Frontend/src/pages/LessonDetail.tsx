import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { ClassroomLayout } from "@/components/classroom/ClassroomLayout";
import { useLesson, useCourse, useCourseEnrollment, useSignedStreamUrl } from "@/features/courses/hooks";
import { useLessonProgress } from "@/features/courses/hooks/useLessonProgress";
import { ClassroomNotesTab } from "@/features/courses/components/ClassroomNotesTab";
import {
  completeLesson,
  getSignedStreamUrl,
} from "@/features/courses/api";
import { useAuth } from "@/features/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Download,
  FileCheck,
  BookOpen,
  ArrowRight,
  PlayCircle,
  FileText,
  CheckCircle2,
  VideoOff,
  RefreshCw,
  GraduationCap,
  Clock,
  Award,
  FileQuestion,
  ChevronRight,
  ChevronLeft,
  X,
  RotateCcw,
  Lock,
} from "lucide-react";
import SecureVideoPlayer, { SecureVideoPlayerHandle } from "@/components/video/SecureVideoPlayer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLessonExams } from "@/features/exams";
import { WatermarkConsentModal } from "@/components/classroom/WatermarkConsentModal";
import { qk } from "@/lib/queryKeys";

type LessonWithResources = {
  resources?: Array<{ id?: number | string; url: string; title: string }>;
};

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const LessonDetail = () => {
  const params = useParams<{ courseId: string; lessonId: string }>();
  const courseId = Number(params.courseId);
  const lessonId = Number(params.lessonId);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: lesson, isLoading: isLessonLoading, error } = useLesson(courseId, lessonId);
  const { data: course, isLoading: isCourseLoading } = useCourse(courseId);
  const { data: enrollment } = useCourseEnrollment(courseId);
  const { data: lessonExams = [] } = useLessonExams(lessonId);

  const shouldRequestStream = lesson?.type === "video";
  const {
    data: signedStreamData,
    error: signedStreamError,
    refetch: refetchSignedUrl,
    isFetching: isFetchingSignedUrl,
  } = useSignedStreamUrl(lessonId, shouldRequestStream && !!lessonId);

  const isCompleted = enrollment?.completedLessonIds?.includes(lessonId) || false;

  const playerRef = useRef<SecureVideoPlayerHandle>(null);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState<boolean>(false);

  const initialPosition = useMemo(() => {
    return (lesson as any)?.lastPositionSeconds ?? (lesson as any)?.last_position_seconds ?? 0;
  }, [(lesson as any)?.lastPositionSeconds, (lesson as any)?.last_position_seconds]);

  const isPlayingRef = useRef<boolean>(false);
  const currentTimeRef = useRef<number>(0);

  const {
    watchedPercent,
    setWatchedPercent,
    showResumeBanner,
    setShowResumeBanner,
    syncProgress,
  } = useLessonProgress({
    lessonId,
    initialPosition,
    serverWatchedPercent: (lesson as any)?.watchedPercent ?? (lesson as any)?.watched_percent ?? 0,
    isPlayingRef,
    currentTimeRef,
  });

  const completeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!enrollment) return;
      await completeLesson(enrollment.id, lessonId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: qk.enrollments.course(user.id, courseId) });
      }
    },
  });

  const handleTokenExpired = async () => {
    const fresh = await getSignedStreamUrl(lessonId);
    return fresh?.signedUrl;
  };

  const modules = useMemo(() => course?.modules || [], [course?.modules]);

  const allLessons = useMemo(() => {
    return modules.flatMap(m => m.lessons || []);
  }, [modules]);

  const currentIndex = useMemo(() => {
    return allLessons.findIndex(l => l.id === lessonId);
  }, [allLessons, lessonId]);

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const totalLessons = allLessons.length;
  const completedLessonIds = enrollment?.completedLessonIds || [];

  const progressPercent = useMemo(() => {
    let totalGates = totalLessons;
    let passedGates = completedLessonIds.length;

    modules.forEach((m) => {
      const u = m.unitExam || (m as any).unit_exam;
      if (u) {
        totalGates += 1;
        if (u.is_passed || (u as any).isPassed) passedGates += 1;
      }
      (m.lessons || []).forEach((l) => {
        if (l.quiz) {
          totalGates += 1;
          if (l.quiz.is_passed || (l.quiz as any).isPassed) passedGates += 1;
        }
      });
    });

    if (totalGates > 0) {
      return Math.min(100, Math.round((passedGates + (enrollment?.progress ? 0 : 0)) / totalGates * 100));
    }
    if (typeof enrollment?.progress === "number") return enrollment.progress;
    return 0;
  }, [modules, totalLessons, completedLessonIds.length, enrollment?.progress]);

  const isLoading = isLessonLoading || isCourseLoading;

  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId) || courseId <= 0 || lessonId <= 0) {
    return <Navigate to="/404" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-cairo">
        <div className="h-14 border-b border-border bg-card/60 animate-pulse px-4 flex items-center justify-between">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-6 bg-muted rounded w-32" />
        </div>
        <div className="container mx-auto py-8 px-4 animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="aspect-video bg-muted rounded-2xl w-full max-w-5xl mx-auto" />
          <div className="h-32 bg-muted rounded-xl max-w-5xl mx-auto" />
        </div>
      </div>
    );
  }

  const isLessonLocked = Boolean((lesson as any)?.is_locked || (lesson as any)?.isLocked);
  const lockReason = (lesson as any)?.lock_reason || (lesson as any)?.lockReason || "يجب إكمال الدرس والكويز السابق أولاً بنسبة 70% لفتح هذا الدرس.";

  if (isLessonLocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">هذا الدرس مقفل حالياً 🔒</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lockReason}
          </p>
          {prevLesson ? (
            <Link to={`/course/${courseId}/lesson/${prevLesson.id}`} className="block pt-2">
              <Button className="w-full gap-2 rounded-xl min-h-[44px] font-bold">
                <ArrowRight size={18} />
                <span>العودة للدرس السابق: {prevLesson.title}</span>
              </Button>
            </Link>
          ) : (
            <Link to={`/course/${courseId}`} className="block pt-2">
              <Button className="w-full gap-2 rounded-xl min-h-[44px] font-bold">
                <ArrowRight size={18} />
                <span>العودة لصفحة الدورة</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 font-cairo">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <VideoOff size={32} />
          </div>
          <h2 className="text-xl font-bold">الدرس غير متاح</h2>
          <p className="text-sm text-muted-foreground">
            تعذر العثور على هذا الدرس أو أنك لا تملك صلاحية الوصول إليه حالياً.
          </p>
          <Link to={`/course/${courseId}`} className="block">
            <Button className="w-full gap-2 rounded-xl">
              <ArrowRight size={18} />
              <span>العودة لصفحة الدورة</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const lessonWithResources = lesson as typeof lesson & LessonWithResources;
  const streamUrl = lesson.type === "video" ? signedStreamData?.signedUrl || "" : "";
  const showVideoError = lesson.type === "video" && !!signedStreamError;
  const isVideoLesson = lesson.type === "video";
  const canComplete = !isVideoLesson || watchedPercent >= 90;

  const lessonQuiz = ((lesson as any)?.quiz || (lessonExams && lessonExams.length > 0 ? lessonExams[0] : null));
  const isQuizPassed = Boolean((lesson as any)?.quiz?.is_passed || (lesson as any)?.quiz?.isPassed);
  const isNextLessonGated = Boolean(
    nextLesson && (
      nextLesson.is_locked ||
      (nextLesson as any).isLocked ||
      (lessonQuiz && !isQuizPassed)
    )
  );

  const endCard = (
    <div className="bg-slate-950/95 border border-slate-800 text-white rounded-2xl p-5 sm:p-7 max-w-md w-full mx-auto text-center shadow-2xl space-y-4 font-cairo animate-in zoom-in-95 duration-300">
      <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 size={32} />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-bold text-white">أحسنت! أتممت مشاهدة الدرس 🎉</h3>
        <p className="text-xs sm:text-sm text-slate-300 line-clamp-1">{lesson.title}</p>
      </div>

      {lessonQuiz && !isQuizPassed && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs text-right leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
            <GraduationCap className="w-4 h-4" />
            كويز الدرس مطلوب لفتح الدرس التالي!
          </p>
          <p className="opacity-90">
            يتعين عليك اجتياز هذا الكويز بنسبة 70% على الأقل لتحرير الدرس القادم ومواصلة تقدمك.
          </p>
        </div>
      )}

      <div className="space-y-2.5 pt-1">
        {lessonQuiz && !isQuizPassed ? (
          <Button
            asChild
            className="w-full min-h-[46px] rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 gap-2 shadow-lg"
          >
            <Link to={`/exam/${lessonQuiz.id}`}>
              <GraduationCap size={18} />
              <span>بدء كويز الدرس الآن (درجة النجاح 70%)</span>
            </Link>
          </Button>
        ) : nextLesson && !isNextLessonGated ? (
          <Button
            asChild
            className="w-full min-h-[46px] rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg"
          >
            <Link to={`/course/${courseId}/lesson/${nextLesson.id}`}>
              <span>الدرس التالي: {nextLesson.title}</span>
              <ChevronLeft size={18} />
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            className="w-full min-h-[46px] rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg"
          >
            <Link to={`/course/${courseId}`}>
              <span>العودة لصفحة الدورة</span>
              <ArrowRight size={18} />
            </Link>
          </Button>
        )}

        {lessonExams.length > 0 && isQuizPassed && (
          <Button
            asChild
            variant="outline"
            className="w-full min-h-[44px] rounded-xl font-bold text-xs sm:text-sm bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 gap-2"
          >
            <Link to={`/exam/${lessonExams[0].id}`}>
              <FileQuestion size={16} />
              <span>مراجعة اختبار الدرس ({lessonExams.length})</span>
            </Link>
          </Button>
        )}

        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              playerRef.current?.restart();
            }}
            className="text-xs text-slate-300 hover:text-white hover:bg-white/10 gap-1.5 rounded-lg"
          >
            <RotateCcw size={14} />
            <span>إعادة المشاهدة</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              playerRef.current?.dismissEndCard();
            }}
            className="text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <span>إغلاق البطاقة</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ClassroomLayout
      courseId={courseId}
      courseTitle={course?.title || "دورة تعليمية"}
      lessonTitle={lesson.title}
      currentIndex={currentIndex >= 0 ? currentIndex : 0}
      totalLessons={totalLessons}
      progressPercent={progressPercent}
      modules={modules}
      currentLessonId={lessonId}
      completedLessonIds={completedLessonIds}
      prevLessonId={prevLesson?.id || null}
      nextLessonId={nextLesson?.id || null}
      isCurrentLessonCompleted={isCompleted}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* 1. Video Player Container */}
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-border/80 bg-black">
          {streamUrl ? (
            <SecureVideoPlayer
              ref={playerRef}
              src={streamUrl}
              watermarkText={`User-${user?.id || "Guest"} | ${user?.email || "courssat.online"}`}
              initialTime={initialPosition}
              onTokenExpired={handleTokenExpired}
              onPlay={() => {
                isPlayingRef.current = true;
              }}
              onPause={() => {
                isPlayingRef.current = false;
                syncProgress(true);
              }}
              onEnded={() => {
                isPlayingRef.current = false;
                syncProgress(true);
                setWatchedPercent(100);
              }}
              onTimeUpdate={(current, _duration, pct) => {
                currentTimeRef.current = current;
                if (pct > watchedPercent) {
                  setWatchedPercent(Math.min(100, Math.round(pct)));
                }
              }}
              endCard={endCard}
            />
          ) : (
            <div className="aspect-video bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-300 p-6 sm:p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-amber-500 shadow-inner">
                {showVideoError ? <VideoOff size={32} /> : <PlayCircle size={32} />}
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-bold text-base text-slate-100">
                  {lesson.type === "video" ? "الفيديو غير متاح حالياً" : "هذا الدرس لا يحتوي على مشغل فيديو"}
                </h3>
                <p className="text-xs text-slate-400">
                  {showVideoError
                    ? "تعذر الحصول على رابط التشغيل الآمن. يرجى إعادة المحاولة."
                    : lesson.type === "video"
                    ? "جاري تجهيز رابط التشغيل الآمن لهذا الدرس..."
                    : "يمكنك متابعة ملخص الدرس والمرفقات والتدريبات أدناه."}
                </p>
              </div>
              {lesson.type === "video" && (
                <Button
                  onClick={() => refetchSignedUrl()}
                  disabled={isFetchingSignedUrl}
                  variant="secondary"
                  className="gap-2 rounded-xl min-h-[44px] px-4 font-bold"
                >
                  <RefreshCw size={16} className={isFetchingSignedUrl ? "animate-spin" : ""} />
                  {isFetchingSignedUrl ? "جاري المحاولة..." : "إعادة تشغيل الفيديو"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Resume playback alert banner */}
        {showResumeBanner && initialPosition > 5 && (
          <div className="flex items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/25 rounded-xl text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>
                تم استئناف الشرح من الدقيقة{" "}
                <strong className="font-bold text-primary font-mono">{formatSeconds(initialPosition)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  playerRef.current?.seek(0);
                  setShowResumeBanner(false);
                }}
                className="min-h-[32px] h-8 px-2.5 text-xs rounded-lg gap-1 border-primary/30 hover:bg-primary/15"
              >
                <RotateCcw size={12} />
                <span>البدء من البداية</span>
              </Button>
              <button
                onClick={() => setShowResumeBanner(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                aria-label="إغلاق التنبيه"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 2. Action Dock (Bottom Navigation & Completion Bar) */}
        <div className="space-y-3">
          {/* Prominent Lesson Quiz Gating Banner */}
          {lessonQuiz && (
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
                isQuizPassed
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isQuizPassed ? "bg-emerald-500 text-white" : "bg-amber-500 text-slate-950 font-black"
                  }`}
                >
                  {isQuizPassed ? <CheckCircle2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-foreground">
                      {isQuizPassed ? "تم اجتياز كويز الدرس بنجاح ✓" : "كويز الدرس (مطلوب لفتح الدرس التالي)"}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        isQuizPassed
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30"
                      }`}
                    >
                      نسبة النجاح {lessonQuiz.passThreshold || lessonQuiz.pass_threshold || 70}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isQuizPassed
                      ? "أحسنت! حققت النسبة المطلوبة وأصبح بإمكانك متابعة الدروس القادمة."
                      : "يجب اجتياز هذا الكويز أولاً لتحرير القفل عن الدرس التالي ومواصلة رحلتك التعليمية."}
                  </p>
                </div>
              </div>

              <Link to={`/exam/${lessonQuiz.id}`} className="w-full sm:w-auto shrink-0">
                <Button
                  size="sm"
                  className={`w-full sm:w-auto font-bold rounded-xl text-xs min-h-[42px] px-4 gap-2 shadow-sm ${
                    isQuizPassed
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  }`}
                >
                  <FileQuestion className="w-4 h-4" />
                  <span>{isQuizPassed ? "مراجعة الكويز" : "بدء كويز الدرس الآن"}</span>
                </Button>
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 bg-card border border-border/80 rounded-2xl shadow-xs">
            {/* Previous Lesson */}
            {prevLesson ? (
              <Button
                asChild
                variant="outline"
                className="gap-1.5 min-h-[44px] px-4 font-semibold text-xs sm:text-sm rounded-xl border-border hover:bg-muted/60"
              >
                <Link to={`/course/${courseId}/lesson/${prevLesson.id}`} aria-label="الانتقال للدرس السابق">
                  <ChevronRight size={18} />
                  <span>الدرس السابق</span>
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled className="gap-1.5 min-h-[44px] px-4 opacity-40 font-semibold text-xs sm:text-sm rounded-xl">
                <ChevronRight size={18} />
                <span>الدرس السابق</span>
              </Button>
            )}

            {/* Mark Complete Button */}
            {isCompleted ? (
              <Button
                variant="secondary"
                size="default"
                disabled
                className="gap-2 min-h-[44px] px-5 sm:px-6 rounded-xl font-bold text-xs sm:text-sm shadow-xs border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                aria-label="الدرس مكتمل بالفعل"
              >
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span>مكتمل بنجاح</span>
              </Button>
            ) : canComplete ? (
              <Button
                variant="default"
                size="default"
                onClick={() => {
                  if (enrollment && !isCompleted) completeMutation.mutate();
                }}
                disabled={completeMutation.isPending || !enrollment}
                className="gap-2 min-h-[44px] px-5 sm:px-6 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="تحديد هذا الدرس كمكتمل"
              >
                <CheckCircle2 size={18} className="opacity-80" />
                <span>{completeMutation.isPending ? "جاري الحفظ..." : "تحديد كمكتمل"}</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="default"
                disabled
                className="gap-2 min-h-[44px] px-4 sm:px-6 rounded-xl font-bold text-xs sm:text-sm shadow-xs border-dashed border-muted-foreground/30 text-muted-foreground cursor-not-allowed opacity-80"
                aria-label={`شاهدت ${watchedPercent}%، باقي ${Math.max(0, 90 - watchedPercent)}% للتحديد كمكتمل`}
                title="يجب مشاهدة 90% على الأقل من الفيديو لتحديد هذا الدرس كمكتمل"
              >
                <Clock size={16} className="text-amber-500 shrink-0" />
                <span>شاهدت {watchedPercent}% (باقي {Math.max(0, 90 - watchedPercent)}%)</span>
              </Button>
            )}

            {/* Next Lesson (Gated if quiz not passed or lesson is locked) */}
            {nextLesson ? (
              isNextLessonGated ? (
                <Button
                  variant="outline"
                  disabled
                  className="gap-2 min-h-[44px] px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xs border-dashed border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400 opacity-90 cursor-not-allowed"
                  title={
                    nextLesson.lock_reason ||
                    (nextLesson as any).lockReason ||
                    "يجب اجتياز كويز الدرس أولاً بنسبة 70% لفتح هذا الدرس"
                  }
                >
                  <Lock size={15} className="text-amber-500 shrink-0" />
                  <span>الدرس التالي (مقفل)</span>
                </Button>
              ) : (
                <Button
                  asChild
                  className="gap-1.5 min-h-[44px] px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xs"
                >
                  <Link to={`/course/${courseId}/lesson/${nextLesson.id}`} aria-label="الانتقال للدرس التالي">
                    <span>الدرس التالي</span>
                    <ChevronLeft size={18} />
                  </Link>
                </Button>
              )
            ) : (
              <Button variant="outline" disabled className="gap-1.5 min-h-[44px] px-4 opacity-40 font-semibold text-xs sm:text-sm rounded-xl">
                <span>الدرس التالي</span>
                <ChevronLeft size={18} />
              </Button>
            )}
          </div>
        </div>

        {/* 3. Lesson-linked Exam Banner (If exams exist) */}
        {lessonExams.length > 0 && (
          <div className="p-4 bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  اختبار تطبيقي على هذا الدرس ({lessonExams.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  ثبّت معلوماتك بعد مشاهدة الشرح وحقق نسبة النجاح المطلوبة
                </p>
              </div>
            </div>
            <Link to={`/exam/${lessonExams[0].id}`} className="w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto min-h-[44px] font-bold gap-2 rounded-xl">
                <FileQuestion className="w-4 h-4" />
                بدء الاختبار الآن
              </Button>
            </Link>
          </div>
        )}

        {/* 4. Content Tabs (Summary, Overview, Resources, Exams) - NO Fake Q&A UI */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex flex-wrap gap-1 border border-border/70">
            <TabsTrigger value="summary" className="gap-1.5 font-bold rounded-lg min-h-[38px] text-xs sm:text-sm">
              <BookOpen className="w-4 h-4" />
              ملخص الدرس
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 font-bold rounded-lg min-h-[38px] text-xs sm:text-sm">
              <FileText className="w-4 h-4" />
              الملاحظات
            </TabsTrigger>
            <TabsTrigger value="overview" className="font-bold rounded-lg min-h-[38px] text-xs sm:text-sm">
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="resources" className="font-bold rounded-lg min-h-[38px] text-xs sm:text-sm">
              المرفقات
              {lessonWithResources.resources && lessonWithResources.resources.length > 0 && (
                <span className="ms-1 px-1.5 py-0.2 bg-primary/20 text-primary rounded-full text-[10px] font-mono">
                  {lessonWithResources.resources.length}
                </span>
              )}
            </TabsTrigger>
            {lessonExams.length > 0 && (
              <TabsTrigger value="exams" className="gap-1.5 font-bold rounded-lg min-h-[38px] text-xs sm:text-sm">
                <GraduationCap className="w-4 h-4" />
                اختبارات الدرس ({lessonExams.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Summary */}
          <TabsContent value="summary" className="mt-4 space-y-4">
            {lesson.summary ? (
              <Card className="border border-border">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-primary" />
                    ملخص وشرح الدرس
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                    {lesson.summary.content}
                  </div>
                  {(lesson.summary.attachment || lesson.summary.attachmentUrl) && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {lesson.summary.attachmentName || "ملف ملخص الدرس (PDF)"}
                          </p>
                          <p className="text-xs text-primary font-medium">جاهز للتحميل والطباعة</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setIsWatermarkModalOpen(true)}
                        className="font-bold gap-2 rounded-xl text-xs min-h-[44px] px-4 w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        تحميل PDF الموسوم آمن
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-border">
                <CardContent className="py-12 text-center text-muted-foreground text-sm space-y-2">
                  <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                  <p>لم يتم إضافة ملخص مكتوب لهذا الدرس بعد.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Notes */}
          <TabsContent value="notes" className="mt-4">
            <ClassroomNotesTab
              courseId={courseId}
              lessonId={lessonId}
              currentTimeRef={currentTimeRef}
              onSeek={(seconds) => playerRef.current?.seek(seconds)}
            />
          </TabsContent>

          {/* Tab: Overview */}
          <TabsContent value="overview" className="mt-4">
            <Card className="border border-border">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-base font-bold">وصف الدرس</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lesson.content || "لا يوجد وصف إضافي متاح لهذا الدرس."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Resources */}
          <TabsContent value="resources" className="mt-4">
            <Card className="border border-border">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-base font-bold">الملفات والمرفقات</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {lessonWithResources.resources && lessonWithResources.resources.length > 0 ? (
                  <ul className="space-y-2.5">
                    {lessonWithResources.resources.map((res) => (
                      <li
                        key={res.id ?? res.url}
                        className="flex items-center justify-between p-3 border border-border rounded-xl hover:bg-muted/40 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={18} className="text-primary shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">{res.title}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setIsWatermarkModalOpen(true)}
                          className="rounded-lg gap-1.5 text-xs min-h-[36px] shrink-0 font-bold"
                        >
                          <Download size={14} />
                          تحميل آمن
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    لا توجد ملفات مرفقة لهذا الدرس.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Exams */}
          {lessonExams.length > 0 && (
            <TabsContent value="exams" className="mt-4 space-y-3">
              <Card className="border border-border">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    اختبارات وتدريبات الدرس
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {lessonExams.map((exam) => {
                    const durationMin = exam.durationMinutes || exam.duration_minutes || 15;
                    const passScore = exam.passThreshold || exam.pass_threshold || 60;
                    const questionsCount = exam.totalQuestions || exam.total_questions || exam.questions?.length || 0;

                    return (
                      <div
                        key={exam.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{exam.title}</span>
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                              {exam.examType === "quiz" || exam.exam_type === "quiz" ? "كويز تفاعلي" : "امتحان الدرس"}
                            </Badge>
                          </div>
                          {exam.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{exam.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {durationMin} دقيقة
                            </span>
                            <span className="flex items-center gap-1">
                              <FileQuestion className="w-3.5 h-3.5" />
                              {questionsCount > 0 ? `${questionsCount} سؤال` : "متعدد الأسئلة"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              النجاح {passScore}%
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <Link to={`/exam/${exam.id}`}>
                            <Button size="sm" className="w-full sm:w-auto min-h-[44px] gap-1.5 font-bold rounded-xl shadow-xs">
                              <FileQuestion className="w-4 h-4" />
                              بدء الاختبار
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Watermark PDF Consent & Download Modal */}
        <WatermarkConsentModal
          isOpen={isWatermarkModalOpen}
          onClose={() => setIsWatermarkModalOpen(false)}
          lessonId={lessonId}
          courseId={courseId}
          lessonTitle={lesson.title}
        />
      </div>
    </ClassroomLayout>
  );
};

export default LessonDetail;
