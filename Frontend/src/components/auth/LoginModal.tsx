import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, Lock, Mail, Eye, EyeOff, Sparkles, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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

interface LoginModalProps {
  children?: React.ReactNode;
  defaultOpen?: boolean;
}

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

type LoginInput = z.infer<typeof loginSchema>;

export const LoginModal: React.FC<LoginModalProps> = ({ children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const redirectByRole = (role: UserRole) => {
    const routes: Record<UserRole, string> = {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      center: "/center/dashboard",
      guardian: "/student/dashboard",
      admin: "/admin/dashboard",
      super_admin: "/super-admin/dashboard",
    };
    navigate(routes[role] || "/");
  };

  const onLoginSubmit = async (data: LoginInput) => {
    try {
      const user = await login(data as import("@/types/auth").LoginCredentials);
      setOpen(false);
      toast({
        title: "مرحباً بك مجدداً! 👋",
        description: `تم تسجيل الدخول بنجاح بحساب ${user.fullName}`,
      });
      redirectByRole(user.role);
    } catch (e) {
      const err = e as ApiError;
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: err.message || "تأكد من صحة البريد الإلكتروني وكلمة المرور.",
      });
    }
  };

  const handleNavigateRegister = () => {
    setOpen(false);
    navigate("/register");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="default" size="sm" className="flex items-center gap-2 rounded-xl shadow-md">
            <LogIn size={16} />
            <span>تسجيل الدخول</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent size="sm" className="p-6 sm:p-7 overflow-hidden flex flex-col">
        {/* Header: Clean, modern, crisp */}
        <div className="text-center pb-1">
          <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <LogIn size={20} />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            تسجيل الدخول
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            مرحباً بك مجدداً! أدخل بياناتك للمتابعة والوصول لدوراتك
          </p>
        </div>

        {/* Login Form Content */}
        <div className="space-y-4 pt-2">
          <GoogleAuthButton onSuccessCallback={() => setOpen(false)} />

          <div className="relative flex items-center my-1">
            <div className="flex-grow border-t border-border/60"></div>
            <span className="flex-shrink mx-3 text-[11px] text-muted-foreground font-medium bg-background px-2">
              أو بالبريد الإلكتروني
            </span>
            <div className="flex-grow border-t border-border/60"></div>
          </div>

          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="login-modal-email" className="text-xs font-semibold text-foreground">
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
                <Input
                  id="login-modal-email"
                  type="email"
                  placeholder="name@example.com"
                  aria-describedby="login-modal-email-err"
                  className="ps-9.5 h-10 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                  {...loginForm.register("email")}
                />
              </div>
              {loginForm.formState.errors.email && (
                <p id="login-modal-email-err" className="text-xs text-destructive font-medium">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="login-modal-password" className="text-xs font-semibold text-foreground">
                  كلمة المرور
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    toast({
                      title: "إعادة تعيين كلمة المرور",
                      description: "يرجى التواصل مع فريق الدعم الفني لإستعادة حسابك.",
                    })
                  }
                  className="text-xs text-primary font-medium hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
                <Input
                  id="login-modal-password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="••••••••"
                  aria-describedby="login-modal-pass-err"
                  className="ps-9.5 pe-10 h-10 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                  {...loginForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p id="login-modal-pass-err" className="text-xs text-destructive font-medium">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <Checkbox id="remember-me" className="rounded-md" />
              <Label htmlFor="remember-me" className="text-xs text-muted-foreground cursor-pointer">
                تذكر بياناتي في هذا الجهاز
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-xl font-bold text-sm shadow-sm hover:shadow transition-all"
              disabled={loginForm.formState.isSubmitting}
            >
              {loginForm.formState.isSubmitting ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

          {/* Footer Action */}
          <div className="pt-2 text-center border-t border-border/50 space-y-1.5">
            <p className="text-xs text-muted-foreground">
              ليس لديك حساب حتى الآن؟{" "}
              <button
                type="button"
                onClick={handleNavigateRegister}
                className="text-primary font-bold hover:underline inline-flex items-center gap-1"
              >
                أنشئ حسابك الآن <ArrowLeft size={12} />
              </button>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;

