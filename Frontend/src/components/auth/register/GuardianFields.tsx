import React from "react";
import { Users, User, Phone, CreditCard, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Controller, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";
import type { RegisterFormValues } from "./types";

interface GuardianFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control: Control<RegisterFormValues>;
  errors: FieldErrors<RegisterFormValues>;
  computedAge: number | null;
}

export const GuardianFields: React.FC<GuardianFieldsProps> = ({
  register,
  control,
  errors,
  computedAge,
}) => {
  const isUnder18 = computedAge !== null && computedAge < 18;

  return (
    <Card className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-md">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Users className="text-primary" size={20} /> بيانات ولي الأمر (خاصة بالطلاب)
          </CardTitle>
          {isUnder18 && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[11px] font-bold border border-amber-500/20">
              طالب أقل من 18 سنة (مطلوب إجبارياً)
            </span>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          تستعمل بيانات ولي الأمر لإرسال التقارير الدورية وإشعارات الحضور والامتحانات
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {isUnder18 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>
              نظراً لأن عمر الطالب أقل من 18 عاماً (<strong>{computedAge} سنة</strong>)، فإن رقم هاتف ولي الأمر إلزامي بصرامة لاستكمال عملية التسجيل وفقاً لسياسة المنصة لحماية الطلاب.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-guardianFullName" className="text-xs font-bold text-foreground">
              اسم ولي الأمر الكامل {isUnder18 && <span className="text-destructive">*</span>}
            </Label>
            <div className="relative">
              <User className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-guardianFullName"
                placeholder="مثال: علي سليمان"
                aria-describedby="reg-guardianFullName-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("guardianFullName")}
              />
            </div>
            {errors.guardianFullName && (
              <p id="reg-guardianFullName-err" className="text-xs text-destructive font-medium">
                {errors.guardianFullName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-guardianRelationship" className="text-xs font-bold text-foreground">
              صلة القرابة
            </Label>
            <Controller
              name="guardianRelationship"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="reg-guardianRelationship" className="h-11 rounded-xl border-border/80 text-sm">
                    <SelectValue placeholder="صلة القرابة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="father">الأب</SelectItem>
                    <SelectItem value="mother">الأم</SelectItem>
                    <SelectItem value="guardian">ولي أمر / وصي قانوني</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-guardianPhone" className="text-xs font-bold text-foreground">
              رقم هاتف ولي الأمر {isUnder18 && <span className="text-destructive">*</span>}
            </Label>
            <div className="relative">
              <Phone className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-guardianPhone"
                type="tel"
                placeholder="01198765432"
                aria-describedby="reg-guardianPhone-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("guardianPhone")}
              />
            </div>
            {errors.guardianPhone && (
              <p id="reg-guardianPhone-err" className="text-xs text-destructive font-medium">
                {errors.guardianPhone.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-guardianNationalId" className="text-xs font-bold text-foreground">
              الرقم القومي لولي الأمر (اختياري)
            </Label>
            <div className="relative">
              <CreditCard className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-guardianNationalId"
                type="text"
                maxLength={14}
                placeholder="27001011234567"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 font-mono"
                {...register("guardianNationalId")}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
