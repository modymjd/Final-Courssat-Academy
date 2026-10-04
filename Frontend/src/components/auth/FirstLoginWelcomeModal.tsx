import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, UserCheck, Key, ArrowLeft, CheckCircle2 } from "lucide-react";
import http from "@/lib/http";

function getWelcomeDismissedKey(userId: number | string) {
  return `courssat:first-login-welcome-dismissed:${userId}`;
}

function isWelcomeDismissed(userId: number | string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getWelcomeDismissedKey(userId)) === "1";
}

function dismissWelcome(userId: number | string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getWelcomeDismissedKey(userId), "1");
}

export default function FirstLoginWelcomeModal() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const requiresPasswordChange = Boolean(
    user && (user.must_change_password === true || user.mustChangePassword === true)
  );
  const userId = user?.id;
  const shouldShow = Boolean(user && userId != null && requiresPasswordChange && !isWelcomeDismissed(userId));

  const [open, setOpen] = useState(shouldShow);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    setOpen(shouldShow);
  }, [shouldShow]);

  if (!user || userId == null || !open) return null;

  const closeForThisUser = () => {
    dismissWelcome(userId);
    setOpen(false);
  };

  const handleDismiss = () => {
    closeForThisUser();
  };

  const handleGoToProfile = () => {
    closeForThisUser();
    navigate("/profile");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast({
        title: "كلمة المرور قصيرة",
        description: "يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "عدم تطابق",
        description: "كلمتا المرور غير متطابقتين.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await http.post("/accounts/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      });

      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث كلمة المرور الخاصة بك وتأمين حسابك.",
      });

      updateUser?.({
        must_change_password: false,
        mustChangePassword: false,
        is_first_login: false,
        isFirstLogin: false,
      });

      closeForThisUser();
    } catch (err: unknown) {
      const candidate = err as { response?: { data?: { detail?: string } } };
      const msg = candidate?.response?.data?.detail || "حدث خطأ أثناء تغيير كلمة المرور. تأكد من كلمة المرور المؤقتة.";
      toast({
        title: "خطأ في التحديث",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) closeForThisUser();
      else setOpen(true);
    }}>
      <DialogContent className="max-w-md dir-rtl text-right p-6 rounded-3xl" dir="rtl">
        <DialogHeader className="text-right space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <ShieldCheck size={28} />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            مرحباً بك، {user.fullName || user.firstName || "عزيزي المعلم"}! 👋
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            تم تسجيل دخولك بنجاح. لضمان أمان حسابك وخصوصية بياناتك، يمكنك الآن مراجعة بياناتك وتعيين كلمة مرور دائمة.
          </DialogDescription>
        </DialogHeader>

        {showPasswordForm ? (
          <form onSubmit={handlePasswordChange} className="space-y-3.5 my-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">كلمة المرور المؤقتة / الحالية</Label>
              <Input
                type="password"
                placeholder="أدخل كلمة المرور الحالية"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className="rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">كلمة المرور الجديدة</Label>
              <Input
                type="password"
                placeholder="8 أحرف أو أكثر"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">تأكيد كلمة المرور الجديدة</Label>
              <Input
                type="password"
                placeholder="أعد إدخال كلمة المرور"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-xl font-mono text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 gradient-cta text-white font-bold rounded-xl gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>{isSubmitting ? "جاري الحفظ..." : "حفظ كلمة المرور"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordForm(false)}
                className="rounded-xl text-xs"
              >
                رجوع
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 my-3">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
              <Key size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                هذه الرسالة تظهر مرة واحدة فقط لهذا الحساب على هذا الجهاز. ويمكنك تغيير كلمة المرور أو مراجعة بيانات الملف الشخصي متى شئت من الإعدادات.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <Button
                onClick={() => setShowPasswordForm(true)}
                className="w-full gradient-cta text-white font-bold rounded-xl gap-2 justify-center py-2.5"
              >
                <Key size={16} />
                <span>تغيير كلمة المرور الآن</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleGoToProfile}
                className="w-full rounded-xl gap-2 justify-center py-2.5 text-foreground font-semibold hover:bg-muted/70"
              >
                <UserCheck size={16} />
                <span>مراجعة وتعديل بيانات الملف الشخصي</span>
                <ArrowLeft size={14} className="mr-auto" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-start pt-1">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            الدخول للوحة التحكم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
