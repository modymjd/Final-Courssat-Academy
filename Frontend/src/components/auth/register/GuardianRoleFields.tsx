import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Controller, type UseFormRegister, type Control, type FieldErrors } from "react-hook-form";
import { Users, Info } from "lucide-react";
import type { RegisterFormValues } from "./types";

interface GuardianRoleFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control: Control<RegisterFormValues>;
  errors: FieldErrors<RegisterFormValues>;
}

export const GuardianRoleFields: React.FC<GuardianRoleFieldsProps> = ({
  register,
  control,
  errors,
}) => {
  return (
    <Card className="rounded-3xl border border-border/80 shadow-md overflow-hidden bg-card">
      <div className="bg-primary/5 px-6 py-4 border-b border-border/60 flex items-center gap-2.5">
        <Users size={18} className="text-primary" />
        <h2 className="text-base font-bold text-foreground">بيانات الطالب المراد متابعته</h2>
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-4 rounded-2xl flex items-start gap-3">
          <Info className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
          <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
            لربط حساب ولي الأمر بالطالب، يرجى إدخال الرقم القومي المكون من 14 رقماً والمسجل به الطالب في المنصة مسبقاً.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="studentNationalId" className="text-xs font-bold text-foreground">
              الرقم القومي للطالب (14 رقم) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="studentNationalId"
              placeholder="مثال: 30501010101234"
              maxLength={14}
              {...register("studentNationalId")}
              className={`rounded-xl border-border/60 ${errors.studentNationalId ? "border-destructive ring-destructive/20 ring-1" : ""}`}
            />
            {errors.studentNationalId && (
              <p className="text-[11px] text-destructive font-medium">{errors.studentNationalId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              صلة القرابة بالطالب <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="guardianRelationship"
              control={control}
              defaultValue="father"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl border-border/60">
                    <SelectValue placeholder="اختر صلة القرابة" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="father">أب</SelectItem>
                    <SelectItem value="mother">أم</SelectItem>
                    <SelectItem value="guardian">وصي قانوني</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
