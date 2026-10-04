import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Building2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  GraduationCap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import ThemeToggle from "@/components/theme/ThemeToggle";

import { useAuth } from "@/features/auth";
import { useValidateCode, useRedeemCode } from "@/features/activation-codes";
import { useQueryClient } from "@tanstack/react-query";
import { STAGE_LABELS, GRADE_LABELS, TRACK_LABELS } from "@/lib/curriculumData";

export default function CenterActivationPage() {
  const { centerSlug } = useParams<{ centerSlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { user, isAuthenticated } = useAuth();
  const initialCodeFromUrl = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCodeFromUrl);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);

  const pinRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: validateCodeMutation, isPending: isValidating } = useValidateCode();
  const { mutateAsync: redeemCodeMutation, isPending: isRedeeming } = useRedeemCode();

  useEffect(() => {
    if (initialCodeFromUrl && pinRef.current) {
      pinRef.current.focus();
    }
  }, [initialCodeFromUrl]);

  // Check if student profile has education level and grade configured
  const studentProfile = (user as any)?.student_profile || (user as any)?.studentProfile;
  const educationLevel = (user as any)?.education_level || studentProfile?.education_level;
  const gradeLevel = (user as any)?.grade_level || studentProfile?.grade_level;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !password.trim()) {
      setErrorMessage("يرجى إدخال كود التفعيل والرقم السري.");
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem("pendingActivationCode", code);
      sessionStorage.setItem("pendingActivationPassword", password);
      navigate(
        `/login?redirect=/center/${centerSlug || "main"}/activate?code=${encodeURIComponent(code)}`,
        { state: { message: "يرجى تسجيل الدخول أو إنشاء حساب لتفعيل باقة السنتر." } }
      );
      return;
    }

    // If educational stage is missing, redirect to complete-profile
    if (!educationLevel || !gradeLevel) {
      sessionStorage.setItem("pendingActivationCode", code);
      sessionStorage.setItem("pendingActivationPassword", password);
      sessionStorage.setItem("pendingActivationRedirect", `/center/${centerSlug || "main"}/activate?code=${encodeURIComponent(code)}`);
      toast({
        title: "يرجى تحديد مرحلتك الدراسية",
        description: "لتفعيل باقة السنتر المطابقة لصفك وشعبتك، يرجى تحديد مرحلتك الدراسية أولاً.",
      });
      navigate("/complete-profile");
      return;
    }

    setErrorMessage(null);

    try {
      const res = await redeemCodeMutation({
        code: code.trim().toUpperCase(),
        password: password.trim(),
      });

      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#0d9488", "#10b981", "#f59e0b", "#3b82f6"],
        });
      } catch {
        // noop
      }

      setActivationSuccess(true);
      setEnrolledCourses(res.enrolledCourses || []);

      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["activation-codes"] });

      toast({
        title: "تم تفعيل باقة السنتر بنجاح! 🎉",
        description: `تم تسجيلك في كورسات مرحلتك الدراسية بنجاح.`,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "الكود أو كلمة المرور غير صحيحة.";
      setErrorMessage(msg);
      toast({
        variant: "destructive",
        title: "فشل التفعيل",
        description: msg,
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/25 dark:bg-background text-foreground transition-colors duration-200" dir="rtl">
      {/* ── Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-card/90 backdrop-blur-md border-b border-border/70 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-muted"
            >
              <ArrowRight size={16} />
              <span>الرئيسية</span>
            </Link>
            <span className="text-muted-foreground/40">|</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>تفعيل باقة السنتر</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800">
              <ShieldCheck size={14} />
              <span>تفعيل آمن معتمد</span>
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main Activation Container ── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-xs">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            تفعيل باقة السنتر التعليمية
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            أدخل كود الباقة والرقم السري لتفعيل كورسات جميع مدرسي السنتر لمرحلتك وصفك الدراسي فوراً.
          </p>
        </div>

        {/* ── Student Profile Indicator ── */}
        {isAuthenticated && (
          <Card className="mb-6 border border-border/80 bg-white dark:bg-card shadow-xs rounded-2xl">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="text-muted-foreground">حساب الطالب: </span>
                  <strong className="text-foreground">{user?.email}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {educationLevel ? (
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    {STAGE_LABELS[educationLevel as keyof typeof STAGE_LABELS] || educationLevel}
                    {gradeLevel ? ` - ${GRADE_LABELS[gradeLevel as keyof typeof GRADE_LABELS] || gradeLevel}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    لم تحدد مرحلتك الدراسية بعد
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Success Celebration Screen ── */}
        <AnimatePresence>
          {activationSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 sm:p-8 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-2 border-emerald-500/30 rounded-3xl text-center shadow-md space-y-6"
            >
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg ring-8 ring-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                  تم تفعيل باقة السنتر بنجاح! 🎉
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  تم تسجيلك تلقائياً في كورسات مدرسي السنتر المخصصة لصفك ومرحلتك الدراسية.
                </p>
              </div>

              {/* List of Enrolled Courses */}
              {enrolledCourses.length > 0 && (
                <div className="space-y-2.5 max-w-lg mx-auto text-right">
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    الكورسات المشمولة في باقتك:
                  </p>
                  <div className="space-y-2">
                    {enrolledCourses.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-3 bg-white dark:bg-card border border-border/80 rounded-xl flex items-center gap-3 shadow-xs"
                      >
                        <BookOpen size={18} className="text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-foreground line-clamp-1">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.instructor_name || c.instructorName}</p>
                        </div>
                        <Link to={`/course/${c.id}`}>
                          <Button size="sm" variant="ghost" className="text-xs text-primary font-bold">
                            عرض الكورس
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-center gap-3">
                <Link to="/student/dashboard">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base px-8 h-12 gap-2 shadow-md">
                    <BookOpen size={20} />
                    الانتقال إلى لوحة تحكم الطالب
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <Card className="border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="p-6 pb-2 border-b border-border/50">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <KeyRound className="text-primary" size={20} />
                  بيانات كرت التفعيل
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  أدخل الكود والرقم السري المطبوعين على كرت السنتر
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-5">
                {errorMessage && (
                  <Alert variant="destructive" className="rounded-xl animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleRedeem} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="center-code" className="text-xs font-bold">
                      كود التفعيل (Code)
                    </Label>
                    <Input
                      id="center-code"
                      placeholder="CTR-XXXXXXXX"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        setErrorMessage(null);
                      }}
                      className="font-mono text-base tracking-widest uppercase rounded-xl h-12 text-center"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="center-pin" className="text-xs font-bold">
                      الرقم السري / PIN
                    </Label>
                    <div className="relative">
                      <Input
                        id="center-pin"
                        ref={pinRef}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrorMessage(null);
                        }}
                        className="font-mono text-lg tracking-[0.3em] rounded-xl h-12 text-center pe-10"
                        maxLength={12}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isRedeeming || !code || !password}
                    className="w-full h-12 text-base font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm gap-2 mt-4"
                  >
                    {isRedeeming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري تفعيل باقة السنتر...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>تأكيد وتفعيل الباقة الآن</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
