import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExamDetails, useStartExam, useSubmitExam } from '@/features/exams';
import { useExamSecurity } from '@/hooks/useExamSecurity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Maximize,
  Send,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  LayoutGrid,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const OPTION_LABELS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

const ExamSession = () => {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const navigate = useNavigate();

  const { data: exam, isLoading, error } = useExamDetails(examId);
  const startMutation = useStartExam();
  const submitMutation = useSubmitExam();

  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [autoAdvancingQuestionId, setAutoAdvancingQuestionId] = useState<number | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapOffsetY, setMapOffsetY] = useState(0);
  const questionsContainerRef = useRef<HTMLDivElement | null>(null);
  const mapCardRef = useRef<HTMLDivElement | null>(null);

  const questions = useMemo(() => {
    const attempt = startMutation.data?.attempt as any;
    const snapshot = attempt?.questions_snapshot || attempt?.questions_snapshot_json;

    if (Array.isArray(snapshot) && snapshot.length > 0) {
      return snapshot.map((q: any) => {
        const rawOptions = q.options || q.options_json;
        let options = rawOptions;
        if (Array.isArray(rawOptions)) {
          options = rawOptions.map((opt: any, idx: number) => {
            if (typeof opt === 'string') return opt;
            return {
              id: opt.id ?? idx,
              text: String(opt.text || opt.label || ''),
              isCorrect: Boolean(opt.isCorrect || opt.is_correct),
            };
          });
        }
        return {
          id: Number(q.id),
          text: String(q.question_text || q.text || ''),
          imageUrl: String(q.image_url || q.imageUrl || ''),
          image_url: String(q.image_url || q.imageUrl || ''),
          type: String(q.question_type || q.type || 'multiple_choice').toLowerCase() as any,
          options,
          points: Number(q.points || 5),
          order: Number(q.order || 0),
          explanation: String(q.explanation || ''),
          videoTimestampStart: q.video_timestamp_start,
          videoTimestampEnd: q.video_timestamp_end,
        };
      });
    }

    return exam?.questions || [];
  }, [startMutation.data, exam]);
  const totalQuestions = questions.length;
  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter(qId => {
      const val = answers[Number(qId)];
      return val !== undefined && val !== null && String(val).trim() !== '';
    }).length;
  }, [answers]);

  const nextUnansweredIndex = useMemo(() => {
    if (!questions.length) return -1;
    // Look forward from activeQuestionIndex + 1
    const forwardIdx = questions.findIndex((q, idx) => {
      if (idx <= activeQuestionIndex) return false;
      const val = answers[q.id];
      return val === undefined || val === null || String(val).trim() === '';
    });
    if (forwardIdx !== -1) return forwardIdx;

    // Look from beginning
    return questions.findIndex((q) => {
      const val = answers[q.id];
      return val === undefined || val === null || String(val).trim() === '';
    });
  }, [questions, answers, activeQuestionIndex]);

  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const warningCountRef = useRef(0);

  const handleForceSubmit = useCallback((reason: string) => {
    if (submitMutation.isPending) return;

    toast({
      variant: "destructive",
      title: "تم تسليم الاختبار!",
      description: reason,
      duration: 8000,
    });

    const logs: string[] = [];
    for (let i = 0; i < warningCountRef.current; i++) {
      logs.push(`مخالفة أمنية #${i + 1}`);
    }

    submitMutation.mutate({
      examId,
      answers,
      cheatLogs: logs,
      forcedSubmission: true,
    }, {
      onSuccess: () => {
        navigate(`/exam/${examId}/result`, { replace: true });
      }
    });
  }, [examId, answers, submitMutation, navigate]);

  const handleWarning = useCallback((reason: string) => {
    warningCountRef.current += 1;
    setShowWarning(reason);
    window.setTimeout(() => setShowWarning(null), 5000);
  }, []);

  const securityLimit = Math.max(
    0,
    Number(exam?.tabSwitchLimit ?? exam?.tab_switch_limit ?? 0),
  );
  const securityEnabled = securityLimit > 0;

  const { warnings, isBlurred, enterFullscreen } = useExamSecurity({
    onWarning: handleWarning,
    onForceSubmit: handleForceSubmit,
    maxWarnings: securityLimit || 1,
    enabled: securityEnabled && startMutation.isSuccess,
  });

  useEffect(() => {
    if (!exam || startMutation.isPending || startMutation.isSuccess || startMutation.isError) return;

    startMutation.mutate(examId, {
      onSuccess: (data: any) => {
        const dur = exam.durationMinutes || exam.duration_minutes || data?.duration_minutes || 60;
        setTimeLeft(dur * 60);
      },
    });
  }, [exam, examId, startMutation]);

  useEffect(() => {
    if (!startMutation.isSuccess || timeLeft === null) return;

    if (timeLeft > 0) {
      const timer = window.setInterval(() => {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
      }, 1000);
      return () => window.clearInterval(timer);
    }

    handleForceSubmit("انتهى وقت الاختبار المحدد.");
  }, [startMutation.isSuccess, timeLeft, handleForceSubmit]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvancingQuestionId(null);
  }, []);

  const scrollToQuestion = useCallback((idx: number) => {
    cancelAutoAdvance();
    setActiveQuestionIndex(idx);

    if (viewMode === 'single') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const elem = document.getElementById(`question-card-${idx}`);
    if (elem) {
      const yOffset = -95;
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [cancelAutoAdvance, viewMode]);

  const handleSelectAnswer = useCallback((qId: number, questionIndex: number, value: string | number) => {
    // 1. Immediately record answer
    setAnswers(prev => ({ ...prev, [qId]: value }));

    // 2. Clear any pending auto-advance
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // 3. Smooth auto-scroll to next question after 2 seconds
    if (questionIndex < questions.length - 1) {
      setAutoAdvancingQuestionId(qId);
      autoAdvanceTimerRef.current = setTimeout(() => {
        scrollToQuestion(questionIndex + 1);
        setAutoAdvancingQuestionId(null);
      }, 2000);
    } else {
      setAutoAdvancingQuestionId(null);
    }
  }, [questions.length, scrollToQuestion]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Dynamically position the desktop question map directly alongside the active question
  const updateMapPosition = useCallback((questionIdx: number) => {
    if (viewMode === 'single') {
      setMapOffsetY(0);
      return;
    }

    const questionElem = document.getElementById(`question-card-${questionIdx}`);
    const containerElem = questionsContainerRef.current;
    const mapElem = mapCardRef.current;

    if (!questionElem || !containerElem) return;

    const containerRect = containerElem.getBoundingClientRect();
    const questionRect = questionElem.getBoundingClientRect();

    const relativeTop = questionRect.top - containerRect.top;
    const containerHeight = containerElem.offsetHeight;
    const mapHeight = mapElem ? mapElem.offsetHeight : 380;

    const maxAllowed = Math.max(0, containerHeight - mapHeight);
    const targetY = Math.min(Math.max(0, relativeTop), maxAllowed);

    setMapOffsetY(targetY);
  }, [viewMode]);

  // Real-time dynamic tracking of active question as student scrolls up and down
  useEffect(() => {
    if (!questions.length || viewMode === 'single') return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const scrollY = window.scrollY || window.pageYOffset;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;

        let bestIdx = 0;

        // 1. Edge Case: Top of page -> first question
        if (scrollY < 120) {
          bestIdx = 0;
        }
        // 2. Edge Case: Bottom of page -> last question
        else if (scrollY + windowHeight >= docHeight - 75) {
          bestIdx = questions.length - 1;
        }
        // 3. Focal line at 35% down viewport (natural reading line)
        else {
          const focalLine = windowHeight * 0.35;
          let minDistance = Infinity;

          for (let i = 0; i < questions.length; i++) {
            const el = document.getElementById(`question-card-${i}`);
            if (!el) continue;
            const rect = el.getBoundingClientRect();

            if (rect.top <= focalLine && rect.bottom >= focalLine) {
              bestIdx = i;
              minDistance = 0;
              break;
            }

            const cardCenter = (rect.top + rect.bottom) / 2;
            const dist = Math.abs(cardCenter - focalLine);
            if (dist < minDistance) {
              minDistance = dist;
              bestIdx = i;
            }
          }
        }

        setActiveQuestionIndex(bestIdx);

        // Instantly sync map position in the same frame for zero lag
        const questionElem = document.getElementById(`question-card-${bestIdx}`);
        const containerElem = questionsContainerRef.current;
        const mapElem = mapCardRef.current;
        if (questionElem && containerElem) {
          const containerRect = containerElem.getBoundingClientRect();
          const questionRect = questionElem.getBoundingClientRect();
          const relativeTop = questionRect.top - containerRect.top;
          const containerHeight = containerElem.offsetHeight;
          const mapHeight = mapElem ? mapElem.offsetHeight : 380;
          const maxAllowed = Math.max(0, containerHeight - mapHeight);
          const targetY = Math.min(Math.max(0, relativeTop), maxAllowed);
          setMapOffsetY(targetY);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial position on load
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [questions, viewMode]);

  useEffect(() => {
    updateMapPosition(activeQuestionIndex);
  }, [activeQuestionIndex, updateMapPosition]);

  useEffect(() => {
    const handleResize = () => updateMapPosition(activeQuestionIndex);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeQuestionIndex, updateMapPosition]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="font-semibold text-muted-foreground animate-pulse">جاري تحميل بيانات الاختبار والأسئلة...</p>
      </div>
    );
  }

  if (error || !exam || !Number.isFinite(examId) || examId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center p-6 border-destructive/30">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">تعذر تحميل الاختبار</h2>
          <p className="text-sm text-muted-foreground mb-4">حدث خطأ أثناء جلب بيانات الاختبار، يرجى المحاولة مرة أخرى.</p>
          <Button onClick={() => window.location.reload()} className="w-full">إعادة المحاولة</Button>
        </Card>
      </div>
    );
  }

  if (startMutation.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert /> تعذر بدء الاختبار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">لم يتم بدء جلسة الاختبار على الخادم، تأكد من استحقاقك للمحاولة.</p>
            <Button className="w-full" onClick={() => startMutation.reset()}>إعادة المحاولة</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!startMutation.isSuccess || timeLeft === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center space-y-4">
            <div className="mx-auto animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            <p className="font-bold text-foreground">جاري تهيئة جلسة الاختبار وتأمين الاتصال...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPracticeMode = exam.examType === 'PRACTICE' || (exam as any).exam_type === 'PRACTICE';

  return (
    <div className={`min-h-screen bg-muted/20 text-foreground relative ${securityEnabled ? 'selection:bg-transparent' : ''} ${isBlurred ? 'blur-xl select-none pointer-events-none' : ''}`}>
      {/* Security Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs px-4">
          <div className="bg-card border border-destructive p-6 sm:p-8 rounded-2xl max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <ShieldAlert size={56} className="mx-auto text-destructive mb-3 animate-bounce" />
            <h2 className="text-2xl font-black text-destructive mb-2">تحذير أمني!</h2>
            <p className="text-base text-foreground font-medium mb-4 leading-relaxed">{showWarning}</p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-bold">
              التحذيرات المسجلة: {warnings} من {securityLimit}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner for Fullscreen hint */}
      {securityEnabled && !document.fullscreenElement && (
        <aside aria-label="تنبيه ملء الشاشة" className="bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 py-1.5 px-4 text-xs font-semibold text-center flex items-center justify-center gap-3">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>يُفضل تفعيل وضع ملء الشاشة لتجنب احتساب مغادرة النافذة كتحذير.</span>
          <button
            type="button"
            onClick={enterFullscreen}
            className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 transition-opacity"
          >
            <Maximize size={12} /> ملء الشاشة
          </button>
        </aside>
      )}

      {/* Sticky Header */}
      <header className="bg-card/95 backdrop-blur-md border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left / Start Info */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-black text-base sm:text-lg text-foreground truncate max-w-xs sm:max-w-md" title={exam.title}>
              {exam.title}
            </h1>
            {isPracticeMode && (
              <Badge variant="outline" className="text-[11px] font-bold border-teal-500 text-teal-600 dark:text-teal-400">
                تدريب تفاعلي
              </Badge>
            )}
          </div>

          {/* Right / Center Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Security Status Badge */}
            {securityEnabled && (
              <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert size={14} />
                <span>{warnings}/{securityLimit} تحذيرات</span>
              </div>
            )}

            {/* Countdown Timer */}
            <div
              className={`flex items-center gap-1.5 font-mono text-base sm:text-lg font-black px-3 py-1 rounded-xl transition-all ${
                timeLeft < 300
                  ? 'bg-rose-500 text-white animate-pulse shadow-md'
                  : 'bg-muted text-foreground'
              }`}
            >
              <Clock size={16} />
              <span>{formatTime(timeLeft)}</span>
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => setIsSubmitDialogOpen(true)}
              disabled={submitMutation.isPending}
              className="font-bold text-xs sm:text-sm px-4 h-9 rounded-xl shadow-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send size={14} className="rtl:rotate-180" />
              <span>إنهاء وتسليم</span>
            </Button>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="w-full bg-muted/60 h-1.5">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Container with Sidebar Navigator */}
      <div className="container mx-auto py-6 px-4 max-w-5xl pb-28 lg:pb-12">
        {/* Top Control Bar: View Mode Switcher & Active Question Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-2 rounded-2xl bg-card border border-border shadow-2xs">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('continuous')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'continuous'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers size={14} className={viewMode === 'continuous' ? 'text-primary' : ''} />
              <span>عرض كل الأسئلة (التمرير المتزامن)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('single');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'single'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid size={14} className={viewMode === 'single' ? 'text-primary' : ''} />
              <span>سؤال بسؤال (وضع التركيز)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground px-2">
            <span>السؤال المعروض:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-black">
              رقم {activeQuestionIndex + 1} من {totalQuestions}
            </span>
          </div>
        </div>

        <div ref={questionsContainerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
          {/* Main Questions List (8 cols) */}
          <main className="lg:col-span-8 space-y-6">
            {questions.length > 0 ? (
              (viewMode === 'single'
                ? (questions[activeQuestionIndex] ? [{ q: questions[activeQuestionIndex], index: activeQuestionIndex }] : [])
                : questions.map((q, index) => ({ q, index }))
              ).map(({ q, index }) => {
                const currentAnswer = answers[q.id];
                const isAnswered = currentAnswer !== undefined && currentAnswer !== null && String(currentAnswer).trim() !== '';

                return (
                  <Card
                    key={q.id}
                    id={`question-card-${index}`}
                    className={`border transition-all duration-300 rounded-2xl bg-card shadow-xs relative ${
                      activeQuestionIndex === index
                        ? 'border-primary ring-2 ring-primary/25 shadow-md'
                        : 'border-border opacity-95 hover:opacity-100'
                    }`}
                  >
                    <CardHeader className="pb-3 border-b border-border/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            <span className="text-[11px] font-bold text-muted-foreground block">
                              {q.type === 'true_false' ? 'صواب أو خطأ' : q.type === 'essay' ? 'سؤال مقالي' : 'اختيار من متعدد'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeQuestionIndex === index && (
                            <Badge className="bg-primary/15 text-primary border-primary/30 text-[11px] font-black animate-pulse gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> السؤال النشط حالياً
                            </Badge>
                          )}
                          {isAnswered && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-bold gap-1">
                              <Check size={12} /> تم الحل
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[11px] font-bold">
                            {q.points || 5} درجات
                          </Badge>
                        </div>
                      </div>

                      <CardTitle className="text-base sm:text-lg font-bold text-foreground leading-relaxed pt-2">
                        {q.text}
                      </CardTitle>
                      {(q.imageUrl || q.image_url) && (
                        <div className="pt-3">
                          <img
                            src={q.imageUrl || q.image_url}
                            alt={`صورة توضيحية للسؤال ${index + 1}`}
                            className="max-h-[420px] w-auto max-w-full rounded-xl border border-border bg-background object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="pt-5 space-y-4">
                      {/* Multiple Choice Options */}
                      {q.type === 'multiple_choice' && q.options && (
                        <div className="space-y-2.5">
                          {q.options.map((opt: any, optIdx: number) => {
                            const optText = typeof opt === 'string' ? opt : (opt.text || '');
                            const optIdentifier = typeof opt === 'string' ? opt : (opt.text || opt.id);
                            const isSelected = String(currentAnswer).trim().toLowerCase() === String(optIdentifier).trim().toLowerCase()
                              || String(currentAnswer) === String(opt.id)
                              || String(currentAnswer).trim().toLowerCase() === optText.trim().toLowerCase();

                            return (
                              <label
                                key={opt.id ?? optIdx}
                                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 dark:bg-primary/20 text-foreground ring-2 ring-primary/20 shadow-xs'
                                    : 'border-border/80 bg-background hover:bg-muted/40 text-foreground'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`q_${q.id}`}
                                  value={optText}
                                  checked={isSelected}
                                  onChange={() => handleSelectAnswer(q.id, index, optText)}
                                  className="sr-only"
                                />
                                <span
                                  className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-muted text-muted-foreground border-border'
                                  }`}
                                >
                                  {OPTION_LABELS[optIdx] || optIdx + 1}
                                </span>
                                <span className="text-sm font-medium leading-relaxed flex-1">
                                  {optText}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* True / False Options (صواب / خطأ) */}
                      {q.type === 'true_false' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* صواب (True) Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, index, 'صواب')}
                            className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 font-black text-base transition-all ${
                              String(currentAnswer).trim().toLowerCase() === 'صواب' || String(currentAnswer).trim().toLowerCase() === 'true' || String(currentAnswer).trim().toLowerCase() === 'صح'
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/25 shadow-xs'
                                : 'border-border/80 bg-background hover:bg-muted/40 text-foreground'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-6 h-6 ${
                                String(currentAnswer).trim().toLowerCase() === 'صواب' || String(currentAnswer).trim().toLowerCase() === 'صح'
                                  ? 'text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950'
                                  : 'text-muted-foreground'
                              }`}
                            />
                            <span>صواب (صح)</span>
                          </button>

                          {/* خطأ (False) Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, index, 'خطأ')}
                            className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 font-black text-base transition-all ${
                              String(currentAnswer).trim().toLowerCase() === 'خطأ' || String(currentAnswer).trim().toLowerCase() === 'false'
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/25 shadow-xs'
                                : 'border-border/80 bg-background hover:bg-muted/40 text-foreground'
                            }`}
                          >
                            <XCircle
                              className={`w-6 h-6 ${
                                String(currentAnswer).trim().toLowerCase() === 'خطأ' || String(currentAnswer).trim().toLowerCase() === 'false'
                                  ? 'text-rose-600 dark:text-rose-400 fill-rose-100 dark:fill-rose-950'
                                  : 'text-muted-foreground'
                              }`}
                            />
                            <span>خطأ</span>
                          </button>
                        </div>
                      )}

                      {/* 2-Second Smooth Auto-Advance Visual Feedback */}
                      {autoAdvancingQuestionId === q.id && index < questions.length - 1 && (
                        <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-primary/10 via-emerald-500/10 to-primary/10 border border-primary/25 flex items-center justify-between gap-3 text-xs text-foreground animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-2 font-bold text-primary">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                            </span>
                            <span>تم تسجيل إجابتك ✓ جاري الانتقال للسؤال التالي تلقائياً...</span>
                          </div>
                          <button
                            type="button"
                            onClick={cancelAutoAdvance}
                            className="text-[11px] font-black text-primary hover:underline px-2.5 py-1 rounded-lg bg-background/80 border border-border shadow-2xs hover:bg-muted transition-colors shrink-0"
                          >
                            إلغاء التمرير
                          </button>
                        </div>
                      )}

                      {/* Essay Question */}
                      {q.type === 'essay' && (
                        <div className="space-y-2">
                          <textarea
                            className="w-full min-h-[140px] p-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y text-sm leading-relaxed text-foreground placeholder:text-muted-foreground"
                            placeholder="اكتب إجابتك النموذجية وشرحك هنا بالتفصيل..."
                            value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            onPaste={(e) => {
                              if (!securityEnabled) return;
                              e.preventDefault();
                              handleWarning('النسخ واللصق غير مسموح به في الإجابات المقالية لحماية النزاهة الأكاديمية.');
                            }}
                          />
                          <p className="text-[11px] text-muted-foreground text-left">
                            {typeof currentAnswer === 'string' ? currentAnswer.trim().length : 0} حرفاً
                          </p>
                        </div>
                      )}

                      {/* Interactive Explanation in Practice Mode Only */}
                      {isPracticeMode && q.explanation && isAnswered && (
                        <div className="mt-4 p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 text-teal-900 dark:text-teal-200 text-xs sm:text-sm leading-relaxed animate-in fade-in duration-300">
                          <div className="font-bold flex items-center gap-1.5 mb-1 text-teal-800 dark:text-teal-300">
                            <span>💡</span> البرهان والتفسير الأكاديمي:
                          </div>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                لا توجد أسئلة متوفرة في هذا الاختبار حالياً.
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                disabled={activeQuestionIndex <= 0}
                onClick={() => scrollToQuestion(Math.max(0, activeQuestionIndex - 1))}
                className="gap-2 rounded-xl text-xs font-bold"
              >
                <ChevronRight size={16} /> السؤال السابق
              </Button>

              <Button
                onClick={() => setIsSubmitDialogOpen(true)}
                className="gap-2 rounded-xl text-xs font-bold px-6 bg-primary text-primary-foreground"
              >
                <Send size={14} className="rtl:rotate-180" /> مراجعة وتسليم الاختبار
              </Button>

              <Button
                variant="outline"
                disabled={activeQuestionIndex >= questions.length - 1}
                onClick={() => scrollToQuestion(Math.min(questions.length - 1, activeQuestionIndex + 1))}
                className="gap-2 rounded-xl text-xs font-bold"
              >
                السؤال التالي <ChevronLeft size={16} />
              </Button>
            </div>
          </main>

          {/* Sidebar Question Navigator (Glides dynamically alongside active question on Desktop) */}
          <aside className={`hidden lg:block lg:col-span-4 ${viewMode === 'single' ? 'sticky top-24 self-start' : 'relative self-stretch'}`}>
            <div
              ref={mapCardRef}
              style={{
                transform: viewMode === 'single' ? 'none' : `translate3d(0, ${mapOffsetY}px, 0)`,
                transition: viewMode === 'single' ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              className="w-full will-change-transform space-y-3 relative"
            >
              {/* Pointing connector notch to active question card on the right (in RTL) */}
              <div className="hidden lg:flex items-center absolute -right-2 top-5 z-20 pointer-events-none">
                <div className="w-3.5 h-3.5 bg-card border-r border-t border-primary/50 rotate-45 transform shadow-xs" />
              </div>

              {/* Active Question Companion Header Badge */}
              <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs font-black text-primary shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </span>
                  <span>مرافقة السؤال الحالي: رقم {activeQuestionIndex + 1}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-background">
                  السؤال النشط
                </Badge>
              </div>

              <Card className="border border-border bg-card rounded-2xl shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                  <CardTitle className="text-sm font-black flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <LayoutGrid size={16} className="text-primary" />
                      خريطة الأسئلة ({totalQuestions})
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      تمت الإجابة: {answeredCount} من {totalQuestions}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted-foreground">نسبة الإنجاز</span>
                      <span className="text-primary">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>

                  {/* Jump to Next Unanswered Question Button */}
                  {nextUnansweredIndex !== -1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => scrollToQuestion(nextUnansweredIndex)}
                      className="w-full text-xs font-bold gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/10 rounded-xl py-2"
                    >
                      <Sparkles size={13} className="text-primary" />
                      <span>الانتقال للسؤال غير المحلول (رقم {nextUnansweredIndex + 1})</span>
                    </Button>
                  )}

                  {/* Question Pills Grid */}
                  <div className="grid grid-cols-5 gap-2 max-h-[38vh] overflow-y-auto p-1">
                    {questions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
                      const isCurrent = activeQuestionIndex === idx;

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => scrollToQuestion(idx)}
                          className={`h-10 rounded-xl font-black text-xs flex flex-col items-center justify-center transition-all ${
                            isCurrent
                              ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-2 border-primary bg-primary/15 text-primary shadow-xs scale-105 z-10'
                              : isAnswered
                              ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs hover:bg-emerald-700'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          <span>{idx + 1}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> تم الحل
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full ring-2 ring-primary bg-primary/20 shrink-0" /> الحالي
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-muted border shrink-0" /> قيد الانتظار
                    </span>
                  </div>

                  {/* Fast Submit Button */}
                  <Button
                    onClick={() => setIsSubmitDialogOpen(true)}
                    disabled={submitMutation.isPending}
                    className="w-full font-black text-sm h-11 rounded-xl gap-2 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all hover:scale-[1.01]"
                  >
                    <Send size={16} className="rtl:rotate-180" /> إنهاء وتسليم الاختبار
                  </Button>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Floating Bottom Bar (Visible on < lg screens) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-2.5 shadow-2xl flex items-center justify-between gap-2">
        {/* Prev Button */}
        <Button
          variant="outline"
          size="sm"
          disabled={activeQuestionIndex <= 0}
          onClick={() => scrollToQuestion(Math.max(0, activeQuestionIndex - 1))}
          className="h-10 px-3 rounded-xl gap-1 shrink-0 font-bold"
          aria-label="السؤال السابق"
        >
          <ChevronRight size={16} />
          <span className="hidden xs:inline">السابق</span>
        </Button>

        {/* Center Map Trigger Button */}
        <button
          type="button"
          onClick={() => setIsMobileMapOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 h-10 px-3 rounded-xl bg-muted/60 hover:bg-muted border border-border/80 transition-colors"
        >
          <LayoutGrid size={16} className="text-primary shrink-0" />
          <div className="text-right flex items-center gap-2">
            <span className="font-black text-xs text-foreground">
              السؤال {activeQuestionIndex + 1}/{totalQuestions}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground px-1.5 py-0.5 rounded-full bg-background border">
              {answeredCount} مجاب
            </span>
          </div>
        </button>

        {/* Next Button or Submit Button */}
        {activeQuestionIndex < questions.length - 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToQuestion(activeQuestionIndex + 1)}
            className="h-10 px-3 rounded-xl gap-1 shrink-0 font-bold"
            aria-label="السؤال التالي"
          >
            <span className="hidden xs:inline">التالي</span>
            <ChevronLeft size={16} />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setIsSubmitDialogOpen(true)}
            disabled={submitMutation.isPending}
            className="h-10 px-3.5 rounded-xl gap-1.5 shrink-0 font-black bg-primary text-primary-foreground shadow-xs"
          >
            <Send size={14} className="rtl:rotate-180" />
            <span>تسليم</span>
          </Button>
        )}
      </div>

      {/* Mobile Question Map Bottom Sheet */}
      <Sheet open={isMobileMapOpen} onOpenChange={setIsMobileMapOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-border max-h-[82vh] p-5">
          <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-3" />
          <SheetHeader className="text-right pb-3 border-b border-border/50">
            <SheetTitle className="text-base font-black flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LayoutGrid size={18} className="text-primary" />
                خريطة الأسئلة
              </span>
              <Badge variant="outline" className="text-xs font-bold">
                {answeredCount} من {totalQuestions} مكتملة
              </Badge>
            </SheetTitle>
            {/* Live progress */}
            <div className="pt-2 space-y-1">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                <span>الإنجاز</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Question Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5 max-h-[45vh] overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
                const isCurrent = activeQuestionIndex === idx;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setIsMobileMapOpen(false);
                      setTimeout(() => scrollToQuestion(idx), 100);
                    }}
                    className={`h-11 rounded-xl font-black text-xs flex flex-col items-center justify-center transition-all ${
                      isCurrent
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-2 border-primary bg-primary/15 text-primary scale-105'
                        : isAnswered
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>{idx + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-around text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> تم الحل
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full ring-2 ring-primary bg-primary/20" /> الحالي
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-muted border" /> لم يُحل
              </span>
            </div>

            {/* Submit Button inside Mobile Drawer */}
            <Button
              onClick={() => {
                setIsMobileMapOpen(false);
                setIsSubmitDialogOpen(true);
              }}
              disabled={submitMutation.isPending}
              className="w-full font-black text-sm h-12 rounded-xl gap-2 bg-primary text-primary-foreground shadow-md"
            >
              <Send size={16} className="rtl:rotate-180" /> إنهاء وتسليم الاختبار الآن
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Submit Confirmation Dialog */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">تأكيد تسليم الاختبار</DialogTitle>
            <DialogDescription className="text-center pt-2">
              هل أنت متأكد من رغبتك في إنهاء الاختبار وتسليم إجاباتك الآن؟
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="p-4 rounded-xl bg-muted/60 border border-border flex items-center justify-between text-sm font-semibold">
              <span>إجمالي الأسئلة:</span>
              <span className="font-bold">{totalQuestions}</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-sm font-semibold">
              <span>الأسئلة التي تمت الإجابة عليها:</span>
              <span className="font-black text-base">{answeredCount}</span>
            </div>

            {totalQuestions - answeredCount > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={16} /> أسئلة متبقية بدون إجابة:
                </span>
                <span className="font-black text-base">{totalQuestions - answeredCount}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSubmitDialogOpen(false)}
              className="rounded-xl flex-1 font-bold"
            >
              العودة للاختبار
            </Button>
            <Button
              onClick={() => {
                setIsSubmitDialogOpen(false);
                const logs = Array.from(
                  { length: warningCountRef.current },
                  (_, index) => `مخالفة أمنية #${index + 1}`,
                );
                submitMutation.mutate(
                  {
                    examId,
                    answers,
                    cheatLogs: logs,
                    forcedSubmission: false,
                  },
                  {
                    onSuccess: () => {
                      navigate(`/exam/${examId}/result`, { replace: true });
                    },
                  },
                );
              }}
              disabled={submitMutation.isPending}
              className="rounded-xl flex-1 font-bold bg-primary text-primary-foreground"
            >
              {submitMutation.isPending ? "جاري التسليم..." : "نعم، تسليم نهائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExamSession;
