import React from "react";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type UseFormRegister, type Control, Controller, type FieldErrors } from "react-hook-form";
import type { RegisterFormValues } from "./types";

interface CenterFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control: Control<RegisterFormValues>;
  errors: FieldErrors<RegisterFormValues>;
}

export const CenterFields: React.FC<CenterFieldsProps> = ({ register, control, errors }) => {
  return (
    <Card className="rounded-3xl border border-border/80 shadow-md bg-card">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Building2 className="text-primary" size={20} /> بيانات السنتر / المؤسسة التعليمية
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          بيانات الهوية للمركز التعليمي لإدارة المعلمين والطلاب وتوليد مجموعات الأكواد
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-inst-name" className="text-xs font-bold text-foreground">
              اسم السنتر / المركز التعليمي <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-inst-name"
              placeholder="مثال: سنتر الأوائل التعليمي"
              className="h-11 text-sm rounded-xl border-border/80"
              {...register("institutionName")}
            />
            {errors.institutionName && (
              <p className="text-xs text-destructive font-medium">{errors.institutionName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">نوع المؤسسة التعليمية</Label>
            <Controller
              name="institutionType"
              control={control}
              defaultValue="center"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-11 text-sm rounded-xl border-border/80">
                    <SelectValue placeholder="اختر نوع المؤسسة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">سنتر تعليمي (دروس / مجموعات)</SelectItem>
                    <SelectItem value="academy">أكاديمية تعليمية متخصصة</SelectItem>
                    <SelectItem value="institute">معهد تعليمي</SelectItem>
                    <SelectItem value="college">كلية</SelectItem>
                    <SelectItem value="university">جامعة</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-inst-address" className="text-xs font-bold text-foreground">
              مقر وعنوان السنتر
            </Label>
            <Input
              id="reg-inst-address"
              placeholder="مثال: شارع الجامعة، بجوار المحطة، الدور الثاني"
              className="h-11 text-sm rounded-xl border-border/80"
              {...register("address")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-inst-license" className="text-xs font-bold text-foreground">
              رقم السجل / الترخيص (إن وجد)
            </Label>
            <Input
              id="reg-inst-license"
              placeholder="مثال: LIC-2024-8849"
              className="h-11 text-sm rounded-xl border-border/80"
              {...register("licenseNumber")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-inst-website" className="text-xs font-bold text-foreground">
            الموقع الإلكتروني / رابط صفحة الفيسبوك
          </Label>
          <Input
            id="reg-inst-website"
            type="url"
            placeholder="https://facebook.com/your-center"
            className="h-11 text-sm rounded-xl border-border/80 text-left dir-ltr"
            {...register("website")}
          />
        </div>
      </CardContent>
    </Card>
  );
};
