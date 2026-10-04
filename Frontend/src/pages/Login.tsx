import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, BookOpen, Quote, ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/features/auth";
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { ApiError } from "@/lib/apiError";
import type { UserRole } from "@/types/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

type LoginInput = z.infer<typeof loginSchema>;

const EINSTEIN_IMAGE_URL = "https://st-takla.org/Gallery/var/resizes/People/Celebs/Scientists-Researchers/www-St-Takla-org--Einstein.jpg?m=1419425257";

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return typeof window !== "undefined" && localStorage.getItem("edusmart_remember_me") === "true";
  });
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: typeof window !== "undefined" ? (localStorage.getItem("edusmart_remembered_email") || "") : "",
      password: "",
    },
  });

  const emailValue = watch("email");

  useEffect(() => {
    const savedEmail = localStorage.getItem("edusmart_remembered_email");
    if (savedEmail) {
      setValue("email", savedEmail);
      setRememberMe(true);
    }
  }, [setValue]);

  const handleRememberMeToggle = (checked: boolean) => {
    setRememberMe(checked);
    if (typeof window !== "undefined") {
      localStorage.setItem("edusmart_remember_me", String(checked));
      if (checked && emailValue) localStorage.setItem("edusmart_remembered_email", emailValue);
      else if (!checked) localStorage.removeItem("edusmart_remembered_email");
    }
  };

  const redirectByRole = (role: UserRole) => {
    const routes: Record<UserRole, string> = {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      center: "/center/dashboard",
      guardian: "/student/dashboard",
      admin: "/admin/dashboard",
      super_admin: "/super-admin/dashboard",
    };
    navigate(routes[role] || "/dashboard", { replace: true });
  };

  const onSubmit = async (data: LoginInput) => {
    try {
      const user = await login(data);
      if (rememberMe) localStorage.setItem("edusmart_remembered_email", data.email);
      else localStorage.removeItem("edusmart_remembered_email");
      toast({ title: "مرحباً بك مجدداً! 👋", description: `تم تسجيل الدخول بنجاح بحساب ${user.fullName}` });
      redirectByRole(user.role);
    } catch (e) {
      const err = e as ApiError;
      const message = err?.status === 401 || err?.status === 403
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : err?.message || "تعذر تسجيل الدخول حالياً. حاول مرة أخرى.";
      toast({ variant: "destructive", title: "تعذر تسجيل الدخول", description: message });
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-background">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-[32px] border border-slate-200 dark:border-border/80 bg-white dark:bg-card shadow-2xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden">
          <div className="p-8 sm:p-10 lg:p-12 bg-white dark:bg-card flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <Link to="/" className="inline-flex items-center gap-2.5 text-[#0A3832] dark:text-primary text-xl font-black tracking-tight"><div className="p-2 rounded-xl bg-[#0A3832]/10 dark:bg-primary/10 text-[#0A3832] dark:text-primary"><BookOpen size={22} /></div><span>كورسات</span></Link>
              <div className="space-y-1.5 pt-1"><h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-foreground tracking-tight">مرحباً بك مجدداً!</h1><p className="text-xs sm:text-sm text-slate-600 dark:text-muted-foreground leading-relaxed font-medium">سجل الدخول للوصول إلى لوحة التحكم الخاصة بك ومتابعة تحصيلك الأكاديمي.</p></div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-bold text-slate-800 dark:text-foreground">البريد الإلكتروني</Label>
                  <div className="relative"><Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-muted-foreground pointer-events-none" size={18} /><Input id="login-email" type="email" placeholder="ادخل بريدك الإلكتروني" aria-describedby="login-email-err" className="ps-10 h-11 text-xs sm:text-sm rounded-xl bg-slate-50/60 dark:bg-background border-slate-200 dark:border-border/80 focus-visible:ring-[#0A3832] dark:focus-visible:ring-primary focus-visible:bg-white dark:focus-visible:bg-background" {...register("email")} /></div>
                  {errors.email && <p id="login-email-err" className="text-xs text-destructive font-medium">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs font-bold text-slate-800 dark:text-foreground">كلمة المرور</Label>
                  <div className="relative"><Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-muted-foreground pointer-events-none" size={18} /><Input id="login-password" type={showPassword ? "text" : "password"} placeholder="ادخل كلمة المرور" aria-describedby="login-password-err" className="ps-10 pe-10 h-11 text-xs sm:text-sm rounded-xl bg-slate-50/60 dark:bg-background border-slate-200 dark:border-border/80 focus-visible:ring-[#0A3832] dark:focus-visible:ring-primary focus-visible:bg-white dark:focus-visible:bg-background" {...register("password")} /><button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                  {errors.password && <p id="login-password-err" className="text-xs text-destructive font-medium">{errors.password.message}</p>}
                  <div className="flex justify-end pt-0.5"><button type="button" onClick={() => toast({ title: "إعادة تعيين كلمة المرور", description: "يمكنك التواصل مع فريق الدعم الفني لإعادة ضبط كلمة المرور." })} className="text-xs text-[#0A3832] dark:text-primary font-bold hover:underline">نسيت كلمة المرور؟</button></div>
                </div>

                <div className="flex items-center gap-2"><Checkbox id="login-remember" checked={rememberMe} onCheckedChange={(checked) => handleRememberMeToggle(checked === true)} className="rounded-md border-slate-300 dark:border-border cursor-pointer data-[state=checked]:bg-[#0A3832] data-[state=checked]:border-[#0A3832] data-[state=checked]:text-white" /><Label htmlFor="login-remember" className="text-xs text-slate-600 dark:text-muted-foreground cursor-pointer select-none font-medium">تذكر بيانات الدخول في هذا الجهاز</Label></div>
                <Button type="submit" className="w-full h-11 bg-[#0A3832] hover:bg-[#0E4941] text-white rounded-xl font-bold text-sm shadow-md shadow-[#0A3832]/20 hover:shadow-lg transition-all" disabled={isSubmitting}>{isSubmitting ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}</Button>
              </form>

              <div className="relative flex items-center my-4"><div className="flex-grow border-t border-slate-200 dark:border-border/60" /><span className="flex-shrink mx-3 text-xs text-slate-400 dark:text-muted-foreground font-bold uppercase tracking-wider bg-white dark:bg-card px-2">أو</span><div className="flex-grow border-t border-slate-200 dark:border-border/60" /></div>
              <div className="space-y-2.5"><GoogleAuthButton /></div>
            </div>

            <div className="pt-4 text-center border-t border-slate-200 dark:border-border/40"><p className="text-xs sm:text-sm text-slate-600 dark:text-muted-foreground font-medium">ليس لديك حساب حتى الآن؟{" "}<Link to="/register" className="text-[#0A3832] dark:text-primary font-black hover:underline inline-flex items-center gap-1">أنشئ حسابك الجديد <ArrowRight size={13} className="rotate-180" /></Link></p></div>
          </div>

          <div className="p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-[#062925] via-[#0C413A] to-[#072F2A] text-white flex flex-col justify-between relative overflow-hidden min-h-[520px]">
            <div className="absolute -top-16 -left-16 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" /><div className="absolute -bottom-16 -right-16 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 pt-4"><h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-snug tracking-tight mb-6">ارتقِ بتجربتك الأكاديمية مع المنصة التعليمية الأحدث</h2></div>
            <div className="relative z-10 my-auto py-4 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/15 shadow-xl"><Quote size={36} className="text-teal-300/60 mb-2" /><blockquote className="text-base sm:text-lg font-medium text-white/95 leading-relaxed mb-6 font-serif">"التعليم ليس تعلم الحقائق، بل تدريب العقل على التفكير."</blockquote><div className="flex items-center gap-3.5"><div className="w-12 h-12 rounded-full overflow-hidden border-2 border-teal-300/40 bg-teal-900/80 flex items-center justify-center shrink-0 shadow-md">{!imgError ? <img src={EINSTEIN_IMAGE_URL} alt="ألبرت أينشتاين" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgError(true)} /> : <span className="font-extrabold text-teal-100 text-sm">AE</span>}</div><div><h3 className="font-bold text-sm text-white">ألبرت أينشتاين</h3><p className="text-xs text-teal-200/80 font-medium">عالم فيزياء نوبل صاحب نظرية النسبية</p></div></div></div>
            <div className="relative z-10 pt-6 border-t border-white/15"><p className="text-[11px] font-bold tracking-widest text-teal-200/70 uppercase mb-3">انضم لأكثر من +15,000 طالب ومحاضر معتمد</p><div className="grid grid-cols-4 gap-3 items-center opacity-85"><div className="flex items-center justify-center text-xs font-bold font-mono tracking-wider text-white/90"><span className="border border-white/30 rounded-lg px-2 py-1 bg-white/5">CAIRO UNIV</span></div><div className="flex items-center justify-center text-xs font-bold font-mono tracking-wider text-white/90"><span className="border border-white/30 rounded-lg px-2 py-1 bg-white/5">STEM EGYPT</span></div><div className="flex items-center justify-center text-xs font-bold font-mono tracking-wider text-white/90"><span className="border border-white/30 rounded-lg px-2 py-1 bg-white/5">AL-AZHAR</span></div><div className="flex items-center justify-center text-xs font-bold font-mono tracking-wider text-white/90"><span className="border border-white/30 rounded-lg px-2 py-1 bg-white/5">IEEE ED</span></div></div></div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Login;
