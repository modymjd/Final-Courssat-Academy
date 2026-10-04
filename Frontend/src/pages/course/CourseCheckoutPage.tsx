import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Ticket,
  KeyRound,
  CreditCard,
  Wallet,
  Store,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
  Star,
  Clock,
  User,
  ExternalLink,
  Gift,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import ThemeToggle from "@/components/theme/ThemeToggle";

import { useAuth } from "@/features/auth";
import { useCourse, useCourseEnrollment, useEnrollCourse } from "@/features/courses/hooks";
import { usePlatformPricing, useStudentWallet } from "@/hooks/usePlatformPricing";
import { normalizeActivationPin, useValidateCode, useRedeemCode } from "@/features/activation-codes";
import { useQueryClient } from "@tanstack/react-query";
import { STAGE_LABELS, GRADE_LABELS, TRACK_LABELS } from "@/lib/curriculumData";

export default function CourseCheckoutPage() {
  const params = useParams<{ id?: string; courseId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { user, isAuthenticated } = useAuth();
  const rawId = params.id || params.courseId || "1";
  const parsedId = parseInt(rawId.split("-")[0], 10);
  const courseId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 1;

  // Course Details & Enrollment Status
  const { data: course, isLoading: isCourseLoading, error: courseError } = useCourse(courseId);
  const { data: enrollment } = useCourseEnrollment(courseId);
  const isEnrolled = Boolean(enrollment);

  // Pricing & Payment Hooks
  const {
    validateCoupon,
    isValidatingCoupon,
    createKashierSession,
    isCreatingKashierSession,
    gatewayStatus,
  } = usePlatformPricing();
  const { wallet, payWithBalance, isPayingWithBalance } = useStudentWallet();

  // Free Course Instant Enrollment Hook
  const { mutateAsync: enrollCourseMutation, isPending: isEnrollingFree } = useEnrollCourse();

  // Activation Code Hooks
  const { mutateAsync: validateCodeMutation, isPending: isValidatingCode } = useValidateCode();
  const { mutateAsync: redeemCodeMutation, isPending: isRedeemingCode } = useRedeemCode();

  // Pricing Calculations & Free Course Detection
  const basePrice = Number(course?.price ?? 0);
  const isCourseFree = Boolean(course?.isFree || (course as any)?.is_free || basePrice === 0);

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<"activation_code" | "wallet_balance" | "kashier_card" | "kashier_wallet">("activation_code");
  const [couponInput, setCouponInput] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Activation Code Corner State
  const initialCodeFromUrl = searchParams.get("code") || "";
  const [activationCode, setActivationCode] = useState(initialCodeFromUrl);
  const [activationPassword, setActivationPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeValidationError, setCodeValidationError] = useState<string | null>(null);
  const [codeWrongCourse, setCodeWrongCourse] = useState<{ id: number; title: string } | null>(null);
  const [codeValidationSuccess, setCodeValidationSuccess] = useState<string | null>(null);
  const [showCodeCornerForFreeCourse, setShowCodeCornerForFreeCourse] = useState(Boolean(initialCodeFromUrl));

  // Purchase / Activation Success State
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const pinInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus PIN field if code was passed in URL
  useEffect(() => {
    if (initialCodeFromUrl && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [initialCodeFromUrl]);

  const finalPrice = isCourseFree ? 0 : Math.max(0, basePrice - discountAmount);
  const availableBalance = wallet ? Number(wallet.available_balance) : 0;
  const isWalletSufficient = availableBalance >= finalPrice;
  const isGatewayActive = Boolean(gatewayStatus?.is_enabled);

  // Free Course Instant 1-Click Enrollment Handler
  const handleFreeEnrollment = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/course/${courseId}/checkout`, {
        state: { message: "يرجى تسجيل الدخول أو إنشاء حساب لإتمام التسجيل في هذه الدورة المجانية." },
      });
      return;
    }

    try {
      await enrollCourseMutation(courseId);

      triggerConfetti();
      setPurchaseSuccess(true);
      setSuccessMessage("تم تسجيلك في الدورة المجانية بنجاح! يمكنك الآن بدء التعلم ومتابعة المحاضرات فوراً.");

      queryClient.invalidateQueries({ queryKey: ["course-enrollment", courseId] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });

      toast({
        title: "تم الاشتراك بنجاح! 🎉",
        description: `أهلاً بك في دورة "${course?.title}". تم تفعيل الدورة في حسابك مجاناً.`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.message ||
        "تعذر إتمام التسجيل المجاني، يرجى المحاولة لاحقاً.";
      toast({
        variant: "destructive",
        title: "خطأ في التسجيل",
        description: errorMsg,
      });
    }
  };

  // Trigger celebratory confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#0d9488", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"],
      });
    } catch {
      // safe fallback if canvas-confetti fails
    }
  };

  // 1. Coupon Application Handler
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const res = await validateCoupon({
        code: couponInput.trim().toUpperCase(),
        plan_id: courseId,
        billing_cycle: "monthly",
      });
      setDiscountAmount(Number(res.discount_amount));
      setAppliedCoupon(res.code);
      toast({
        title: "تم تطبيق كود الخصم! 🎉",
        description: `تم خصم ${res.discount_amount} ج.م من سعر الدورة.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "كوبون غير صالح",
        description: err?.message || "تأكد من كود الخصم وصلاحيته لهذه الدورة.",
      });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponInput("");
  };

  // 2. Validate Code Handler
  const handleValidateCode = async () => {
    if (!activationCode.trim() || !activationPassword.trim()) {
      setCodeValidationError("يرجى إدخال كود التفعيل والرقم السري معاً.");
      return;
    }
    setCodeValidationError(null);
    setCodeWrongCourse(null);
    setCodeValidationSuccess(null);

    try {
      const res: any = await validateCodeMutation({
        code: activationCode.trim().toUpperCase(),
        password: normalizeActivationPin(activationPassword),
        courseId: courseId,
      });

      // Cross-course check
      if (res.courses && res.courses.length > 0) {
        const matchesThisCourse = res.courses.some((c: any) => c.id === courseId);
        if (!matchesThisCourse) {
          const targetCourse = res.courses[0];
          setCodeWrongCourse({ id: targetCourse.id, title: targetCourse.title });
          return;
        }
      }

      setCodeValidationSuccess("الكود صالح وجاهز للتفعيل الفوري لهذا الكورس! ✨");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || "الكود أو كلمة المرور غير صحيحة.";
      setCodeValidationError(errorMsg);
    }
  };

  // 3. Redeem Activation Code Handler
  const handleRedeemCode = async () => {
    if (!isAuthenticated) {
      sessionStorage.setItem("pendingActivationCode", activationCode);
      sessionStorage.setItem("pendingActivationPassword", normalizeActivationPin(activationPassword));
      navigate(`/login?redirect=/course/${courseId}/checkout?code=${encodeURIComponent(activationCode)}`, {
        state: { message: "يرجى تسجيل الدخول أو إنشاء حساب لإتمام تفعيل الكود." },
      });
      return;
    }

    if (!activationCode.trim() || !activationPassword.trim()) {
      setCodeValidationError("يرجى إدخال كود التفعيل والرقم السري.");
      return;
    }

    setCodeValidationError(null);
    setCodeWrongCourse(null);

    try {
      const res = await redeemCodeMutation({
        code: activationCode.trim().toUpperCase(),
        password: normalizeActivationPin(activationPassword),
        courseId: courseId,
      });

      triggerConfetti();
      setPurchaseSuccess(true);
      setSuccessMessage(res.message || "تم تفعيل اشتراكك في الكورس بنجاح!");

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["course-enrollment", courseId] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["user-my-wallet", user?.id] });

      toast({
        title: "تم التفعيل بنجاح! 🎉",
        description: `أهلاً بك في دورة "${course?.title}". يمكنك الآن بدء المشاهدة.`,
      });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || "فشل تفعيل الكود. تأكد من صحة البيانات.";
      setCodeValidationError(errorMsg);
      toast({
        variant: "destructive",
        title: "خطأ في التفعيل",
        description: errorMsg,
      });
    }
  };

  // 4. Wallet Balance Checkout Handler
  const handlePayWithWallet = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/course/${courseId}/checkout`);
      return;
    }

    if (!isWalletSufficient) {
      toast({
        variant: "destructive",
        title: "رصيد المحفظة غير كافٍ",
        description: "رصيدك الحالي أقل من تكلفة الكورس. يمكنك استخدام كود التفعيل أو شحن الرصيد.",
      });
      return;
    }

    try {
      await payWithBalance({
        course_id: courseId,
        coupon_code: appliedCoupon || undefined,
      });

      triggerConfetti();
      setPurchaseSuccess(true);
      setSuccessMessage(`تم الدفع وخصم ${finalPrice} ج.م من رصيد محفظتك بنجاح!`);

      queryClient.invalidateQueries({ queryKey: ["course-enrollment", courseId] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });

      toast({
        title: "تم الاشتراك بنجاح! 🎉",
        description: `تم تسجيلك في دورة "${course?.title}".`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل إتمام الشراء",
        description: err?.message || "حدث خطأ أثناء الخصم من المحفظة.",
      });
    }
  };

  // 5. Kashier Electronic Payment Session Handler
  const handlePayWithKashier = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/course/${courseId}/checkout`);
      return;
    }

    if (!isGatewayActive) {
      toast({
        title: "الدفع الإلكتروني متاح قريباً",
        description: "الدفع الإلكتروني بالبطاقات البنكية قيد المراجعة والاعتماد المصرفي النهائي (قريباً). يرجى استخدام كود التفعيل أو رصيد المحفظة.",
      });
      return;
    }

    try {
      const session = await createKashierSession({
        resource_type: "course",
        resource_id: courseId,
        amount: finalPrice,
        coupon_code: appliedCoupon || undefined,
        return_url: window.location.href,
      });

      toast({
        title: "جاري فتح بوابة الدفع المشفرة...",
        description: "يتم تحويلك إلى نافذة الدفع الآمنة عبر كاشيير.",
      });

      if (session.checkout_url) {
        window.location.href = session.checkout_url;
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في بوابة الدفع",
        description: err?.message || "تعذر إنشاء جلسة الدفع عبر كاشيير. يرجى استخدام كود التفعيل.",
      });
    }
  };

  // Find first lesson to direct student to upon success
  const firstLessonId = course?.modules?.[0]?.lessons?.[0]?.id || 1;

  if (isCourseLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">جاري تجهيز صفحة الشراء الآمنة...</p>
      </div>
    );
  }

  if (courseError || !course) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center" dir="rtl">
        <AlertCircle className="w-16 h-16 text-destructive mb-3" />
        <h2 className="text-2xl font-bold mb-2">تعذر العثور على الدورة المطلوبة</h2>
        <p className="text-muted-foreground mb-6">قد تكون هذه الدورة غير منشورة أو تم نقلها.</p>
        <Link to="/courses">
          <Button variant="default">تصفح الدورات التعليمية</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/25 dark:bg-background text-foreground transition-colors duration-200" dir="rtl">
      {/* ──────────────── Top Navigation Bar ──────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-card/90 backdrop-blur-md border-b border-border/70 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/course/${courseId}`}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-muted"
            >
              <ArrowRight size={16} />
              <span>العودة للدورة</span>
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
              <span>/</span>
              <Link to="/courses" className="hover:text-primary transition-colors">الدورات</Link>
              <span>/</span>
              <span className="text-foreground font-medium">إتمام الشراء</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800">
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>دفع وتفعيل مشفّر 256-bit</span>
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ──────────────── Main Checkout Body ──────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {isCourseFree && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 gap-1.5 font-bold">
                <Gift size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>دورة تعليمية مجانية 100%</span>
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            {isCourseFree ? "تأكيد الاشتراك في الدورة المجانية" : "إتمام الاشتراك والشراء"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCourseFree
              ? "مجرد تأكيد رغبتك بالانضمام، وستتم إضافة الدورة فوراً لحسابك بدون أي رسوم أو بيانات بنكية."
              : "خطوة واحدة تفصلك عن الانضمام إلى أفضل الكوادر التعليمية وبدء رحلة التفوق."}
          </p>
        </div>

        {/* ── Banner 1: Already Enrolled Notification ── */}
        {isEnrolled && !purchaseSuccess && (
          <Alert className="mb-8 border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-2xl p-5 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                  أنت مسجل بالفعل في هذه الدورة! 🎉
                </AlertTitle>
                <AlertDescription className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                  لديك وصول كامل ومباشر لكافة دروس واختبارات وملحقات هذه الدورة في حسابك.
                </AlertDescription>
                <div className="mt-4 flex gap-3">
                  <Link to={`/lesson/${courseId}/${firstLessonId}`}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm">
                      <BookOpen size={16} />
                      الانتقال إلى قاعة الدراسة ومتابعة التعلم
                    </Button>
                  </Link>
                  <Link to={`/course/${courseId}`}>
                    <Button variant="outline" className="border-emerald-500/40 text-emerald-800 dark:text-emerald-300">
                      صفحة تفاصيل الدورة
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Alert>
        )}

        {/* ── Banner 2: Unauthenticated Notice ── */}
        {!isAuthenticated && (
          <Alert className="mb-8 border-primary/30 bg-primary/5 rounded-2xl p-5 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <User className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="text-base font-bold text-foreground">
                  أهلاً بك! يرجى تسجيل الدخول لحفظ اشتراكك
                </AlertTitle>
                <AlertDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                  لتتمكن من تفعيل الكود أو الشراء والوصول للمحاضرات من أي جهاز، سجّل دخولك أو أنشئ حساباً جديداً في ثوانٍ.
                </AlertDescription>
                <div className="mt-3 flex gap-2.5">
                  <Button
                    size="sm"
                    className="font-bold gap-1.5"
                    onClick={() =>
                      navigate(
                        `/login?redirect=/course/${courseId}/checkout${
                          activationCode ? `?code=${encodeURIComponent(activationCode)}` : ""
                        }`
                      )
                    }
                  >
                    تسجيل الدخول
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/register?redirect=/course/${courseId}/checkout${
                          activationCode ? `?code=${encodeURIComponent(activationCode)}` : ""
                        }`
                      )
                    }
                  >
                    إنشاء حساب جديد
                  </Button>
                </div>
              </div>
            </div>
          </Alert>
        )}

        {/* ── Success Card: Confetti Celebration State ── */}
        <AnimatePresence>
          {purchaseSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="mb-8 p-6 sm:p-8 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-2 border-emerald-500/30 rounded-3xl text-center shadow-md"
            >
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ring-8 ring-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                تهانينا! تم تفعيل اشتراكك بنجاح 🎉
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-lg mx-auto">
                {successMessage || `تمت إضافة دورة "${course?.title}" إلى حسابك التعليمي بنجاح، ويمكنك الآن البدء في دراستها.`}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link to={`/lesson/${courseId}/${firstLessonId}`}>
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base px-8 h-12 gap-2 shadow-md hover:shadow-lg transition-all">
                    <BookOpen size={20} />
                    ابدأ دراسة أول محاضرة الآن
                  </Button>
                </Link>
                <Link to="/student/dashboard">
                  <Button size="lg" variant="outline" className="h-12 font-bold">
                    لوحة تحكم الطالب
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Two-Column Layout Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ════════════════ Column 1: Main Details (8 cols) ════════════════ */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Hero Course Overview Card */}
            <Card className="overflow-hidden border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-xs rounded-2xl">
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start">
                <div className="relative w-full sm:w-48 aspect-video sm:aspect-4/3 rounded-xl overflow-hidden shrink-0 border border-border/50 shadow-xs">
                  <img
                    src={course.image || (course as any).imageUrl || "/placeholder.svg"}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-slate-900/80 text-white text-[10px] backdrop-blur-xs font-semibold">
                      {STAGE_LABELS[course.educationalStage as keyof typeof STAGE_LABELS] || "كورس معتمد"}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="flex flex-wrap gap-2 items-center">
                    {course.educationalGrade && (
                      <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                        {GRADE_LABELS[course.educationalGrade as keyof typeof GRADE_LABELS] || course.educationalGrade}
                      </Badge>
                    )}
                    {course.educationalTrack && course.educationalTrack !== "general" && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {TRACK_LABELS[course.educationalTrack as keyof typeof TRACK_LABELS] || course.educationalTrack}
                      </Badge>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                    {course.title}
                  </h2>

                  {/* Instructor Meta */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground pt-1">
                    <Avatar className="w-6 h-6 border">
                      <AvatarImage src={(course.instructor as any)?.avatar} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {course.instructor?.name?.charAt(0) || "م"}
                      </AvatarFallback>
                    </Avatar>
                    <span>المحاضر:</span>
                    <span className="font-semibold text-foreground">{course.instructor?.name}</span>
                  </div>

                  {/* Course Specs */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/60">
                    <div className="flex items-center gap-1.5">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="font-bold text-foreground">{course.rating || "5.0"}</span>
                      <span>({course.studentCount || 0} طالب)</span>
                    </div>
                    {course.duration && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>{course.duration}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <BookOpen size={14} />
                      <span>{course.lessonCount || "متاح بالكامل"} محاضرة</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Benefits / Perks Strip */}
              <div className="bg-muted/40 dark:bg-muted/20 px-5 sm:px-6 py-4 border-t border-border/60">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  مميزات الاشتراك في هذه الدورة:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-foreground">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>وصول كامل لكافة المحاضرات والملخصات</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-foreground">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>اختبارات تقييمية ومتابعة دورية مستمرة</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-foreground">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>شهادة إتمام معتمدة فور إكمال متطلبات الدورة</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-foreground">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>دعم فني وتواصل مباشر مع فريق المعلم</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 1.5 Dedicated Free Course Instant Enrollment Confirmation Card */}
            {isCourseFree && (
              <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-card shadow-sm rounded-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-2.5 h-full bg-emerald-500" />
                <CardHeader className="p-5 sm:p-6 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                        <Gift size={26} />
                      </div>
                      <div>
                        <CardTitle className="text-lg sm:text-xl font-black text-foreground">
                          تأكيد الانضمام الفوري للدورة المجانية
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                          دورة مجانية بالكامل متاحة لجميع الطلاب — بدون أي بطاقات دفع أو بيانات بنكية
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold text-xs py-1 px-3 hidden sm:inline-flex">
                      مجاناً 100%
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6 pt-2 space-y-4">
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-card/80 border border-emerald-500/20 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">الدورة المطلوبة:</span>
                      <span className="font-bold text-foreground">{course.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">المحاضر:</span>
                      <span className="font-bold text-foreground">{course.instructor?.name}</span>
                    </div>
                    {course.educationalStage && (
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">المرحلة الدراسية:</span>
                        <span className="font-semibold text-foreground">
                          {STAGE_LABELS[course.educationalStage as keyof typeof STAGE_LABELS] || course.educationalStage}
                          {course.educationalGrade ? ` - ${GRADE_LABELS[course.educationalGrade as keyof typeof GRADE_LABELS] || course.educationalGrade}` : ""}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-emerald-500/20">
                      <span className="text-muted-foreground font-medium">تكلفة التسجيل:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                        0.00 ج.م (مجاناً بالكامل)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleFreeEnrollment}
                      disabled={isEnrollingFree || isEnrolled}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base h-13 rounded-xl gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      {isEnrollingFree ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>جاري تأكيد تسجيلك في الدورة...</span>
                        </>
                      ) : isEnrolled ? (
                        <>
                          <CheckCircle2 size={20} />
                          <span>أنت مسجل بالفعل في هذه الدورة 🎉</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={20} />
                          <span>نعم، هذا هو الكورس المطلوب وتأكيد اشتراكي مجاناً 🚀</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-border/60 text-center">
                    <button
                      type="button"
                      onClick={() => setShowCodeCornerForFreeCourse(!showCodeCornerForFreeCourse)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
                    >
                      {showCodeCornerForFreeCourse
                        ? "إخفاء ركن كود التفعيل"
                        : "هل لديك كود تفعيل خاص من السنتر لهذه الدورة؟ (اضغط هنا)"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2. Promo Code / Coupon Section (Only if course is not free) */}
            {!isCourseFree && (
              <Card className="border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-xs rounded-2xl">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <div className="relative flex-1 w-full">
                      <Ticket className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3.5" />
                      <Input
                        placeholder="هل لديك كود خصم؟ (أدخله هنا)"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        disabled={Boolean(appliedCoupon) || isValidatingCoupon}
                        className="pe-10 text-sm font-mono uppercase rounded-xl h-11"
                      />
                    </div>

                    {appliedCoupon ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs py-1.5 px-3 h-11 rounded-xl flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          تم تفعيل ({appliedCoupon})
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveCoupon}
                          className="text-xs text-destructive hover:bg-destructive/10 h-11"
                        >
                          إلغاء
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleApplyCoupon}
                        disabled={!couponInput.trim() || isValidatingCoupon}
                        className="shrink-0 text-sm font-bold h-11 px-5 rounded-xl w-full sm:w-auto"
                      >
                        {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "تطبيق الخصم"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Dedicated Activation Code & PIN Corner (ركن كود التفعيل المخصص) */}
            {(!isCourseFree || showCodeCornerForFreeCourse) && (
              <Card
                id="activation-box"
                className="border-2 border-primary/30 dark:border-primary/40 bg-gradient-to-br from-primary/5 via-card to-background shadow-sm rounded-2xl overflow-hidden relative"
              >
              <div className="absolute top-0 right-0 w-2 h-full bg-primary" />
              <CardHeader className="p-5 sm:p-6 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <KeyRound size={22} />
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl font-black text-foreground">
                        ركن كود التفعيل والرقم السري (PIN)
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        معاك كرت مطبوع من السنتر أو كود مخصص للدورة؟ فَعّل دورتك فوراً بضغطة زر
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-primary text-primary-foreground text-[10px] hidden sm:inline-flex">
                    تفعيل فوري
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 pt-2 space-y-4">
                {/* Cross-Course Error Prompt */}
                {codeWrongCourse && (
                  <Alert variant="destructive" className="rounded-xl animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>كود مخصص لدورة أخرى!</AlertTitle>
                    <AlertDescription className="text-xs mt-1 space-y-2">
                      <p>
                        هذا الكود صالح، ولكنه مخصص لدورة:{" "}
                        <strong className="underline">{codeWrongCourse.title}</strong> وليس هذه الدورة.
                      </p>
                      <Link to={`/course/${codeWrongCourse.id}/checkout?code=${encodeURIComponent(activationCode)}`}>
                        <Button size="sm" variant="outline" className="mt-2 text-xs gap-1.5 bg-white dark:bg-card">
                          الانتقال إلى صفحة تلك الدورة لتفعيله هناك <ExternalLink size={12} />
                        </Button>
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Validation Error */}
                {codeValidationError && !codeWrongCourse && (
                  <Alert variant="destructive" className="rounded-xl animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {codeValidationError}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Validation Success Banner */}
                {codeValidationSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{codeValidationSuccess}</span>
                  </div>
                )}

                {/* Code & PIN Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-code" className="text-xs font-bold text-foreground">
                      كود التفعيل
                    </Label>
                    <div className="relative">
                      <Input
                        id="checkout-code"
                        placeholder="ES-XXXXXXXX"
                        value={activationCode}
                        onChange={(e) => {
                          setActivationCode(e.target.value.toUpperCase());
                          setCodeValidationError(null);
                          setCodeWrongCourse(null);
                          setCodeValidationSuccess(null);
                        }}
                        className="font-mono text-base tracking-widest uppercase rounded-xl h-12 bg-white dark:bg-card border-border/80 text-center"
                      />
                      {initialCodeFromUrl && (
                        <span className="absolute left-3 top-3 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                          من الرابط
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-pin" className="text-xs font-bold text-foreground">
                      الرقم السري / الـ PIN (المحمي بطبقة الخدش)
                    </Label>
                    <div className="relative">
                      <Input
                        id="checkout-pin"
                        ref={pinInputRef}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••"
                        value={activationPassword}
                        onChange={(e) => {
                          setActivationPassword(normalizeActivationPin(e.target.value));
                          setCodeValidationError(null);
                        }}
                        className="font-mono text-lg tracking-[0.3em] rounded-xl h-12 bg-white dark:bg-card border-border/80 text-center pe-10"
                        maxLength={12}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        tabIndex={-1}
                        aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions & Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleValidateCode}
                    disabled={isValidatingCode || isRedeemingCode || !activationCode || !activationPassword}
                    className="text-xs font-bold h-11 rounded-xl sm:w-1/3"
                  >
                    {isValidatingCode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "فحص الكود"
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={handleRedeemCode}
                    disabled={isValidatingCode || isRedeemingCode || !activationCode || !activationPassword}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-11 rounded-xl gap-2 shadow-sm"
                  >
                    {isRedeemingCode ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري تفعيل الدورة...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>تأكيد وتفعيل الدورة فوراً</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* ════════════════ Column 2: Sticky Summary & Payments (4 cols) ════════════════ */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
            {/* Billing Summary Box */}
            <Card className="border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-bold text-foreground">
                  ملخص الفاتورة والحساب
                </CardTitle>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="space-y-2.5 text-sm">
                  {isCourseFree ? (
                    <>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>سعر الدورة الأساسي:</span>
                        <span className="line-through text-muted-foreground">
                          {basePrice > 0 ? `${basePrice.toLocaleString()} ج.م` : "0 ج.م"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>نوع الاشتراك:</span>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-bold">
                          مجانية 100% 🎁
                        </Badge>
                      </div>
                      <div className="pt-3 border-t border-border/70 flex justify-between items-baseline">
                        <span className="font-bold text-foreground text-base">المبلغ المطلوب:</span>
                        <div className="text-left">
                          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                            0
                          </span>
                          <span className="text-xs text-muted-foreground ms-1">ج.م</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>سعر الدورة الأساسي:</span>
                        <span className="font-semibold text-foreground">
                          {basePrice.toLocaleString()} ج.م
                        </span>
                      </div>

                      {discountAmount > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                          <span>خصم الكوبون:</span>
                          <span className="font-semibold">
                            -{discountAmount.toLocaleString()} ج.م
                          </span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-border/70 flex justify-between items-baseline">
                        <span className="font-bold text-foreground text-base">الإجمالي المطلوب:</span>
                        <div className="text-left">
                          <span className="text-3xl font-black text-primary">
                            {finalPrice.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground ms-1">ج.م</span>
                          {discountAmount > 0 && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              {basePrice.toLocaleString()} ج.م
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Payment Methods Selector */}
                {isCourseFree ? (
                  <div className="pt-3 border-t border-border/70 space-y-2">
                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                      <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold">تسجيل فوري مباشر</p>
                        <p className="text-[11px] text-muted-foreground">لا يتطلب إدخال بيانات بطاقة دفع أو محفظة.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-border/70 space-y-2.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      طريقة الدفع والتفعيل:
                    </Label>

                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(val: any) => setPaymentMethod(val)}
                      className="grid gap-2.5"
                    >
                      {/* Method 1: Activation Code */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          paymentMethod === "activation_code"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/70 hover:border-border"
                        }`}
                        onClick={() => {
                          setPaymentMethod("activation_code");
                          document.getElementById("activation-box")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <RadioGroupItem value="activation_code" id="method-activation" />
                          <div className="flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-primary" />
                            <span className="text-xs sm:text-sm font-semibold">كود التفعيل والرقم السري</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/30">
                          مباشر
                        </Badge>
                      </div>

                      {/* Method 2: Internal Student Wallet Balance */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          paymentMethod === "wallet_balance"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/70 hover:border-border"
                        }`}
                        onClick={() => setPaymentMethod("wallet_balance")}
                      >
                        <div className="flex items-center gap-2.5">
                          <RadioGroupItem value="wallet_balance" id="method-wallet" />
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                            <div>
                              <p className="text-xs sm:text-sm font-semibold">رصيد محفظتي</p>
                              <p className="text-[11px] text-muted-foreground">
                                المتاح: <span className="font-bold text-emerald-600">{availableBalance} ج.م</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        {!isWalletSufficient && (
                          <Badge variant="destructive" className="text-[9px]">
                            غير كافٍ
                          </Badge>
                        )}
                      </div>

                      {/* Method 3: Cards via Kashier (Coming Soon) */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          paymentMethod === "kashier_card"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/70 hover:border-border"
                        }`}
                        onClick={() => setPaymentMethod("kashier_card")}
                      >
                        <div className="flex items-center gap-2.5">
                          <RadioGroupItem value="kashier_card" id="method-card" />
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-xs sm:text-sm font-semibold">البطاقات البنكية وميزة</p>
                              <p className="text-[10px] text-muted-foreground">Visa, Mastercard, Meeza</p>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-500/30">
                          قريباً
                        </Badge>
                      </div>

                      {/* Method 4: Mobile Wallets & InstaPay (Coming Soon) */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          paymentMethod === "kashier_wallet"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/70 hover:border-border"
                        }`}
                        onClick={() => setPaymentMethod("kashier_wallet")}
                      >
                        <div className="flex items-center gap-2.5">
                          <RadioGroupItem value="kashier_wallet" id="method-wallets-kashier" />
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-rose-600" />
                            <div>
                              <p className="text-xs sm:text-sm font-semibold">المحافظ وإنستاباي</p>
                              <p className="text-[10px] text-muted-foreground">فودافون كاش، إنستاباي</p>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-500/30">
                          قريباً
                        </Badge>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="pt-2">
                  {isCourseFree ? (
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleFreeEnrollment}
                      disabled={isEnrollingFree || isEnrolled}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-12 rounded-xl gap-2 shadow-sm disabled:opacity-50"
                    >
                      {isEnrollingFree ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري تأكيد التسجيل...</span>
                        </>
                      ) : isEnrolled ? (
                        <>
                          <CheckCircle2 size={16} />
                          <span>أنت مسجل بالفعل</span>
                        </>
                      ) : (
                        <>
                          <Gift size={18} />
                          <span>تأكيد التسجيل المجاني (0 ج.م)</span>
                        </>
                      )}
                    </Button>
                  ) : paymentMethod === "activation_code" ? (
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => {
                        document.getElementById("activation-box")?.scrollIntoView({ behavior: "smooth" });
                        pinInputRef.current?.focus();
                      }}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm h-12 rounded-xl gap-2 shadow-sm"
                    >
                      <KeyRound size={18} />
                      إدخال وتفعيل الكود
                    </Button>
                  ) : paymentMethod === "wallet_balance" ? (
                    <Button
                      type="button"
                      size="lg"
                      onClick={handlePayWithWallet}
                      disabled={isPayingWithBalance || !isWalletSufficient || isEnrolled}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-12 rounded-xl gap-2 shadow-sm disabled:opacity-50"
                    >
                      {isPayingWithBalance ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الخصم والتسجيل...</span>
                        </>
                      ) : (
                        <>
                          <Wallet size={18} />
                          <span>تأكيد والدفع ({finalPrice.toLocaleString()} ج.م)</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      onClick={handlePayWithKashier}
                      disabled={!isGatewayActive || isCreatingKashierSession || isEnrolled}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-sm h-12 rounded-xl gap-2 shadow-sm disabled:opacity-60"
                    >
                      {isCreatingKashierSession ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isGatewayActive ? (
                        `الدفع عبر كاشيير (${finalPrice.toLocaleString()} ج.م)`
                      ) : (
                        "الدفع الإلكتروني (متاح قريباً)"
                      )}
                    </Button>
                  )}
                </div>

                {/* Trust and Assurance Footer */}
                <div className="p-3 bg-muted/50 rounded-xl space-y-1.5 text-center text-[11px] text-muted-foreground border border-border/40">
                  <div className="flex items-center justify-center gap-1.5 font-medium text-foreground">
                    <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>ضمان الجودة وأمان الحساب 100%</span>
                  </div>
                  <p>تفعيل مباشر للمحاضرات فور إتمام الدفع أو إدخال الكود.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
