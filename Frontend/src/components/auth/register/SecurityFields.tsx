import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Controller, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";
import type { RegisterFormValues } from "./types";

interface SecurityFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control: Control<RegisterFormValues>;
  errors: FieldErrors<RegisterFormValues>;
  isSubmitting: boolean;
}

export const SecurityFields: React.FC<SecurityFieldsProps> = ({
  register,
  control,
  errors,
  isSubmitting,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <>
      <Card className="rounded-3xl border border-border/80 shadow-md bg-card">
        <CardHeader className="pb-4 border-b border-border/40">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Lock className="text-primary" size={20} /> كلمة المرور والأمان
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-password" className="text-xs font-bold text-foreground">
                كلمة المرور <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  aria-describedby="reg-password-err"
                  className="ps-10 pe-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p id="reg-password-err" className="text-xs text-destructive font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-confirmPassword" className="text-xs font-bold text-foreground">
                تأكيد كلمة المرور <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                <Input
                  id="reg-confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  aria-describedby="reg-confirmPassword-err"
                  className="ps-10 pe-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  aria-label={showConfirmPassword ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="reg-confirmPassword-err" className="text-xs text-destructive font-medium">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          {/* Terms and Conditions Checkbox */}
          <div className="space-y-2 pt-2">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-muted/20 border border-border/60 hover:bg-muted/30 transition-colors">
              <Controller
                name="terms"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="reg-terms"
                    ref={field.ref}
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    aria-describedby="reg-terms-err"
                    className="mt-0.5 rounded-md border-slate-300 dark:border-border cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground shrink-0"
                  />
                )}
              />
              <Label htmlFor="reg-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                أقر بصحة البيانات أدناه وأوافق على{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary font-bold hover:underline"
                >
                  شروط الاستخدام
                </Link>{" "}
                و{" "}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary font-bold hover:underline"
                >
                  سياسة الخصوصية
                </Link>{" "}
                الخاصة بمنصة كورسات الأكاديمية.
              </Label>
            </div>
            {errors.terms && (
              <p id="reg-terms-err" className="text-xs text-destructive font-medium">
                {errors.terms.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Action Button */}
      <div className="space-y-4">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full h-12 rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition-all"
        >
          {isSubmitting ? (
            "جاري إنشاء الحساب الأكاديمي..."
          ) : (
            <span className="flex items-center justify-center gap-2">
              إنشاء الحساب وتأكيد التسجيل <ArrowRight size={18} className="rotate-180" />
            </span>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          لديك حساب بالفعل على المنصة؟{" "}
          <Link to="/login" className="text-primary font-bold hover:underline">
            تسجيل الدخول هنا
          </Link>
        </p>
      </div>
    </>
  );
};
