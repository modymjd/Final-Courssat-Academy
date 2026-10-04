import React, { useMemo } from "react";
import { User, Mail, Phone, CreditCard, Calendar, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Controller, useWatch, type Control, type UseFormRegister, type UseFormSetValue, type FieldErrors } from "react-hook-form";
import type { RegisterFormValues } from "./types";
import { EGYPTIAN_GOVERNORATES, type NationalIdAnalysis } from "./egyptianValidation";
import { getCitiesByGovernorate } from "@/data/egyptLocations";

interface PersonalInfoFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control: Control<RegisterFormValues>;
  setValue?: UseFormSetValue<RegisterFormValues>;
  errors: FieldErrors<RegisterFormValues>;
  nidAnalysis: NationalIdAnalysis;
  computedAge: number | null;
}

export const PersonalInfoFields: React.FC<PersonalInfoFieldsProps> = ({
  register,
  control,
  setValue,
  errors,
  nidAnalysis,
  computedAge,
}) => {
  const watchedGovernorate = useWatch({
    control,
    name: "governorate",
    defaultValue: "القاهرة",
  });

  const availableCities = useMemo(() => {
    return getCitiesByGovernorate(watchedGovernorate);
  }, [watchedGovernorate]);
  return (
    <Card className="rounded-3xl border border-border/80 shadow-md bg-card">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <User className="text-primary" size={20} /> البيانات الشخصية والحساب
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          أدخل بيانات الاسم الرسمي والاتصال لتسهيل التوثيق واستعادة الحساب
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-fullName" className="text-xs font-bold text-foreground">
            الاسم الكامل (الاسم الرباعي أو الثلاثي) <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
            <Input
              id="reg-fullName"
              placeholder="مثال: أحمد محمد علي سليمان"
              aria-describedby="reg-fullName-err"
              className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
              {...register("fullName")}
            />
          </div>
          {errors.fullName && (
            <p id="reg-fullName-err" className="text-xs text-destructive font-medium">
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-email" className="text-xs font-bold text-foreground">
              البريد الإلكتروني <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-email"
                type="email"
                placeholder="student@example.com"
                aria-describedby="reg-email-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p id="reg-email-err" className="text-xs text-destructive font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-phone" className="text-xs font-bold text-foreground">
              رقم الهاتف المصري <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-phone"
                type="tel"
                placeholder="01012345678"
                aria-describedby="reg-phone-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("phone")}
              />
            </div>
            {errors.phone && (
              <p id="reg-phone-err" className="text-xs text-destructive font-medium">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>

        {/* National ID & Auto-detected DOB */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-nationalId" className="text-xs font-bold text-foreground">
              الرقم القومي (14 رقماً) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <CreditCard className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-nationalId"
                type="text"
                maxLength={14}
                placeholder="29901011234567"
                aria-describedby="reg-nationalId-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary font-mono"
                {...register("nationalId")}
              />
            </div>
            {errors.nationalId ? (
              <p id="reg-nationalId-err" className="text-xs text-destructive font-medium">
                {errors.nationalId.message}
              </p>
            ) : nidAnalysis.valid ? (
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                ✓ رقم قومي صحيح (تاريخ الميلاد: {nidAnalysis.dob} — {nidAnalysis.governorate ? `المحافظة: ${nidAnalysis.governorate} — ` : ""}العمر: {computedAge} سنة)
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-dateOfBirth" className="text-xs font-bold text-foreground">
              تاريخ الميلاد
            </Label>
            <div className="relative">
              <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-dateOfBirth"
                type="date"
                aria-describedby="reg-dateOfBirth-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("dateOfBirth")}
              />
            </div>
          </div>
        </div>

        {/* Gender, Governorate, City */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-gender" className="text-xs font-bold text-foreground">
              الجنس
            </Label>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="reg-gender" className="h-11 rounded-xl border-border/80 text-sm">
                    <SelectValue placeholder="اختر الجنس" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر ♂</SelectItem>
                    <SelectItem value="female">أنثى ♀</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-governorate" className="text-xs font-bold text-foreground">
              المحافظة
            </Label>
            <Controller
              name="governorate"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    if (setValue) {
                      setValue("city", "");
                    }
                  }}
                  value={field.value}
                >
                  <SelectTrigger id="reg-governorate" className="h-11 rounded-xl border-border/80 text-sm">
                    <SelectValue placeholder="اختر المحافظة" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {EGYPTIAN_GOVERNORATES.map((gov) => (
                      <SelectItem key={gov} value={gov}>
                        {gov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-city" className="text-xs font-bold text-foreground">
              المدينة / المركز / الحي
            </Label>
            {availableCities.length > 0 ? (
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <SelectTrigger id="reg-city" className="h-11 rounded-xl border-border/80 text-sm">
                      <SelectValue placeholder="اختر المدينة أو الحي" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {availableCities.map((c) => (
                        <SelectItem key={c.id} value={c.nameAr}>
                          {c.nameAr} ({c.nameEn})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <div className="relative">
                <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                <Input
                  id="reg-city"
                  placeholder="أدخل اسم المدينة أو الإقامة"
                  className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                  {...register("city")}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
