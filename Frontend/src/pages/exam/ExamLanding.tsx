import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useExamDetails } from "@/features/exams";
import {
  ShieldCheck,
  Clock,
  HelpCircle,
  Maximize,
  RefreshCw,
  Award,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { logger } from "@/lib/logger";

const ExamLanding = () => {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const navigate = useNavigate();
  const { data: exam, isLoading, error, refetch } = useExamDetails(examId);
  const [agreed, setAgreed] = useState(false);
  const [showAttemptWarningModal, setShowAttemptWarningModal] = useState(false);

  const attemptsAllowed = Number(exam?.attemptsAllowed || (exam as any)?.attempts_allowed || (exam as any)?.max_attempts || 3);
  const isUnitExam = (exam as any)?.kind === "UNIT_EXAM";
  const isAssignment = exam?.examType === "ASSIGNMENT" || (exam as any)?.exam_type === "ASSIGNMENT";
  const usedAttempts = Number((exam as any)?.attemptsCount || (exam as any)?.attempts_count || (exam as any)?.attemptsUsed || (exam as any)?.attempts_used || 0);
  const remainingAttempts = Math.max(0, attemptsAllowed - usedAttempts);

  // 24h Lockout & Cooldown calculation
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  React.useEffect(() => {
    if (!exam) return;

    const lockedUntilStr = exam.lockedUntil || (exam as any).locked_until;
    if (lockedUntilStr) {
      const targetTime = new Date(lockedUntilStr).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((targetTime - now) / 1000));
      setLockoutSeconds(diffSec);
    } else {
      setLockoutSeconds(0);
    }

    const cd = exam.cooldownSecondsRemaining || (exam as any).cooldown_seconds_remaining || 0;
    setCooldownSeconds(Math.max(0, cd));
  }, [exam]);

  React.useEffect(() => {
    if (lockoutSeconds <= 0 && cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds, cooldownSeconds]);

  const isLockedOut = lockoutSeconds > 0;
  const isInCooldown = cooldownSeconds > 0;

  const formatLockout = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hours > 0) return `${hours} ساعة و ${mins} دقيقة`;
    if (mins > 0) return `${mins} دقيقة و ${s} ثانية`;
    return `${s} ثانية`;
  };

  const proceedToSession = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      logger.warn("Fullscreen request failed, but continuing to exam.");
    }

    navigate(`/exam/${examId}/session`, { replace: true });
  };

  const handleStart = async () => {
    if (!agreed || !Number.isFinite(examId) || examId <= 0 || isLockedOut || isInCooldown) return;

    if (isUnitExam) {
      setShowAttemptWarningModal(true);
      return;
    }

    proceedToSession();
  };

  if (!Number.isFinite(examId) || examId <= 0) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4 text-center">
          <p className="text-muted-foreground">الاختبار المطلوب غير صالح.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4 max-w-2xl animate-pulse space-y-6">
          <div className="h-28 bg-muted rounded-3xl" />
          <div className="h-64 bg-muted rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (error || !exam) {
    return (
      <Layout>
        <div className="container mx-auto py-16 px-4 text-center">
          <div className="max-w-md mx-auto p-8 rounded-3xl border bg-card space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-xl font-bold text-foreground">تعذر تحميل بيانات الاختبار</h2>
            <p className="text-sm text-muted-foreground">يرجى التحقق من اتصال الإنترنت ثم إعادة المحاولة.</p>
            <Button variant="outline" onClick={() => refetch()} className="gap-2 rounded-xl">
              <RefreshCw size={16} /> إعادة المحاولة
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-10 px-4 max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 font-medium">
          <Link to="/student/dashboard" className="hover:text-primary transition-colors">
            لوحة التعلم
          </Link>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          <span className="text-foreground font-semibold">{exam.title}</span>
        </div>

        <Card className="border border-border/80 shadow-lg rounded-3xl overflow-hidden bg-card">
          <div className="h-2 bg-gradient-to-r from-primary via-indigo-500 to-teal-500" />
          <CardHeader className="text-center pb-2 pt-8 px-6 sm:px-10">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-xs">
              <Award size={32} />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-black text-foreground">
              {exam.title}
            </CardTitle>
            {exam.description && (
              <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto leading-relaxed">
                {exam.description}
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-6 pt-4 px-6 sm:px-10">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-muted/40 border border-border/60 rounded-2xl">
              <div className="text-center p-2">
                <Clock size={20} className="mx-auto mb-1.5 text-primary" />
                <p className="font-black text-base text-foreground">{exam.durationMinutes || 60} دقيقة</p>
                <p className="text-xs text-muted-foreground font-medium">المدة الزمنية</p>
              </div>
              <div className="text-center p-2">
                <HelpCircle size={20} className="mx-auto mb-1.5 text-indigo-500" />
                <p className="font-black text-base text-foreground">{exam.totalQuestions || 0} أسئلة</p>
                <p className="text-xs text-muted-foreground font-medium">إجمالي الأسئلة</p>
              </div>
              <div className="text-center p-2 col-span-2 sm:col-span-1">
                <ShieldCheck size={20} className="mx-auto mb-1.5 text-emerald-500" />
                <p className="font-black text-base text-foreground">{exam.passThreshold || 50}%</p>
                <p className="text-xs text-muted-foreground font-medium">درجة النجاح</p>
              </div>
            </div>

            {/* Instruction Guidelines Card */}
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Info size={18} className="text-primary shrink-0" />
                {isAssignment ? "تعليمات وضوابط حل الواجب" : "تعليمات وضوابط جلسة الاختبار"}
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed pr-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>سيتم تفعيل وضع ملء الشاشة للتركيز وتوفير بيئة اختبار هادئة وخالية من التشتيت.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>يرجى عدم مغادرة نافذة الاختبار أو فتح تبويبات خارجية لتفادي تسجيل تنبيهات النزاهة الأكاديمية.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>يتم حفظ وتوثيق إجاباتك تلقائياً وبشكل دوري على الخادم لضمان عدم فقدان أي تقدم.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>عند انتهاء الوقت المحدد، سيقوم النظام بتسليم الإجابات المرصودة واعتماد النتيجة فورياً.</span>
                </li>
              </ul>
            </div>

            {/* Lockout / Cooldown Banners */}
            {isLockedOut && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="text-right">
                  <h4 className="font-bold text-sm">فترة حظر مؤقتة (24 ساعة)</h4>
                  <p className="text-xs mt-0.5 leading-relaxed">
                    أنت في فترة حظر لمدة 24 ساعة بعد استنفاد محاولاتك. يرفع الحظر بعد {formatLockout(lockoutSeconds)}.
                  </p>
                </div>
              </div>
            )}

            {isInCooldown && !isLockedOut && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 shrink-0 animate-spin" />
                <div className="text-right">
                  <h4 className="font-bold text-sm">فترة انتظار مؤقتة</h4>
                  <p className="text-xs mt-0.5 leading-relaxed">
                    يرجى الانتظار {cooldownSeconds} ثانية قبل إعادة المحاولة.
                  </p>
                </div>
              </div>
            )}

            {/* Agreement Checkbox */}
            <label className="flex items-start gap-3.5 p-4 border border-border/80 rounded-2xl cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 rounded-md accent-primary shrink-0 cursor-pointer"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                أقر بأني اطلعت على التعليمات أعلاه وأنا مستعد لبدء الاختبار مع الالتزام بقواعد النزاهة الأكاديمية.
              </span>
            </label>
          </CardContent>

          <CardFooter className="px-6 sm:px-10 pb-8 pt-2">
            <Button
              className="w-full text-base sm:text-lg h-12 sm:h-14 gap-2.5 rounded-2xl font-black shadow-md shadow-primary/20 transition-all hover:scale-[1.01]"
              disabled={!agreed || isLockedOut || isInCooldown}
              onClick={handleStart}
            >
              <Maximize size={20} />
              {isLockedOut
                ? `محظور مؤقتاً (${formatLockout(lockoutSeconds)})`
                : isInCooldown
                ? `يرجى الانتظار (${cooldownSeconds} ثانية)`
                : isAssignment ? "بدء حل الواجب الآن" : "بدء الاختبار الآن"}
            </Button>
          </CardFooter>
        </Card>

        {/* Unit Exam 3-Attempt Warning Modal */}
        <Dialog open={showAttemptWarningModal} onOpenChange={setShowAttemptWarningModal}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6 text-foreground bg-card border border-border shadow-2xl space-y-4" dir="rtl">
            <DialogHeader className="text-right space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    تأكيد بدء امتحان الوحدة
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    استهلاك محاولة رسمية نهائية
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm leading-relaxed space-y-2 font-medium">
              <p>
                تحذير: متبقي لديك {remainingAttempts} محاولات من أصل {attemptsAllowed}. بمجرد بدء الامتحان سيتم استهلاك محاولة فوراً ولا يمكن استرجاعها أو إيقاف الوقت.
              </p>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAttemptWarningModal(false)}
                className="w-full sm:w-auto rounded-xl font-bold text-xs sm:text-sm min-h-[44px]"
              >
                إلغاء والعودة
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setShowAttemptWarningModal(false);
                  proceedToSession();
                }}
                className="w-full sm:w-auto gap-2 rounded-xl font-bold text-xs sm:text-sm min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white shadow-md"
              >
                <Maximize size={16} />
                تأكيد وبدء الامتحان الآن
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ExamLanding;
