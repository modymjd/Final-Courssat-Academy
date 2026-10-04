import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth";
import { apiPost } from "@/lib/http";
import type { UserRole, User } from "@/types/auth";

interface GoogleAuthButtonProps {
  onSuccessCallback?: () => void;
  className?: string;
}

interface GoogleAuthResponse {
  user: User;
  access: string;
  refresh: string;
  profileCompleted?: boolean;
  profile_completed?: boolean;
}

const getGoogleButtonWidth = () => {
  if (typeof window === "undefined") return 400;
  return Math.min(400, Math.max(240, window.innerWidth - 32));
};

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccessCallback,
  className = "",
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [buttonWidth, setButtonWidth] = useState(getGoogleButtonWidth);

  useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    const handleResize = () => setButtonWidth(getGoogleButtonWidth());

    window.addEventListener("edusmart:theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("edusmart:theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast({
        variant: "destructive",
        title: t("auth.googleErrorTitle", "فشل تسجيل الدخول بـ Google"),
        description: t("auth.googleTokenMissing", "لم يتم استلام رمز التحقق من Google"),
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiPost<GoogleAuthResponse>("/auth/google/", {
        credential: credentialResponse.credential,
      });

      const { user, access, refresh } = response;
      const profileCompleted =
        response.profileCompleted ??
        response.profile_completed ??
        user.profileCompleted ??
        user.profile_completed ??
        false;

      await loginWithGoogle({ user, access, refresh });

      if (!profileCompleted) {
        toast({
          title: t("auth.profileIncompleteTitle", "مرحباً بك! 👋"),
          description: t(
            "auth.profileIncompleteSub",
            "أكمل بيانات حسابك الأساسية وحدد نوع حسابك للمتابعة.",
          ),
        });
        onSuccessCallback?.();
        navigate("/complete-profile", { replace: true });
      } else {
        toast({
          title: t("auth.welcomeBackTitle", "تم تسجيل الدخول بنجاح 🎉"),
          description: `${t("auth.welcomeBack", "أهلاً بك مجدداً")} ${user.fullName || user.firstName}`,
        });
        onSuccessCallback?.();
        redirectByRole(user.role);
      }
    } catch (err: unknown) {
      const error = err as {
        message?: string;
        response?: { data?: { error?: { message?: string }; message?: string } };
      };
      const errMsg =
        error.message ||
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        t("auth.googleAuthFailed", "حدث خطأ أثناء تسجيل الدخول بحساب Google.");

      toast({
        variant: "destructive",
        title: t("auth.loginFailed", "تعذر تسجيل الدخول"),
        description: errMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full flex flex-col items-center gap-2 ${className}`}>
      {isLoading ? (
        <div className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 text-sm font-medium text-muted-foreground animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
          <span>{t("auth.verifyingGoogle", "جاري التحقق من حساب Google...")}</span>
        </div>
      ) : (
        <div className="w-full max-w-[400px] flex justify-center overflow-hidden">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
              toast({
                variant: "destructive",
                title: t("auth.googleErrorTitle", "فشل الاتصال بـ Google"),
                description: t(
                  "auth.googleCancelled",
                  `تعذر إكمال المصادقة مع Google. تحقق من إضافة ${currentOrigin} إلى Authorized JavaScript Origins في Google Cloud Console.`
                ),
              });
            }}
            shape="rectangular"
            theme={isDark ? "filled_black" : "outline"}
            size="large"
            text="continue_with"
            logo_alignment="left"
            width={buttonWidth}
          />
        </div>
      )}
    </div>
  );
};

export default GoogleAuthButton;
