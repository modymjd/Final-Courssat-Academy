import React from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileFormValues } from "@/hooks/useProfileForm";

interface CenterProfileFieldsProps {
  form: UseFormReturn<ProfileFormValues>;
}

export const CenterProfileFields: React.FC<CenterProfileFieldsProps> = ({ form }) => {
  const { t } = useTranslation();
  const {
    control,
    register,
    formState: { errors },
  } = form;

  return (
    <Card className="rounded-3xl border border-border/80 shadow-md bg-card">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Building2 className="text-primary" size={20} />
          {t("auth.centerProfile.title", "بيانات السنتر / المؤسسة التعليمية")}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t(
            "auth.centerProfile.description",
            "أدخل بيانات المؤسسة التعليمية الأساسية لإكمال حساب السنتر.",
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="complete-inst-name" className="text-xs font-bold text-foreground">
              {t("auth.centerProfile.institutionName", "اسم السنتر / المؤسسة التعليمية")} {" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="complete-inst-name"
              placeholder={t("auth.centerProfile.institutionNamePlaceholder", "مثال: سنتر الأوائل التعليمي")}
              className="h-11 text-sm rounded-xl border-border/80"
              {...register("institutionName")}
            />
            {errors.institutionName && (
              <p className="text-xs text-destructive font-medium" role="alert">
                {errors.institutionName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="complete-inst-type" className="text-xs font-bold text-foreground">
              {t("auth.centerProfile.institutionType", "نوع المؤسسة التعليمية")} {" "}
              <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="institutionType"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <SelectTrigger id="complete-inst-type" className="h-11 text-sm rounded-xl border-border/80">
                    <SelectValue placeholder={t("auth.centerProfile.institutionTypePlaceholder", "اختر نوع المؤسسة")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">{t("auth.centerProfile.typeCenter", "سنتر تعليمي")}</SelectItem>
                    <SelectItem value="academy">{t("auth.centerProfile.typeAcademy", "أكاديمية تعليمية")}</SelectItem>
                    <SelectItem value="institute">{t("auth.centerProfile.typeInstitute", "معهد تعليمي")}</SelectItem>
                    <SelectItem value="college">{t("auth.centerProfile.typeCollege", "كلية")}</SelectItem>
                    <SelectItem value="university">{t("auth.centerProfile.typeUniversity", "جامعة")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.institutionType && (
              <p className="text-xs text-destructive font-medium" role="alert">
                {errors.institutionType.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="complete-inst-address" className="text-xs font-bold text-foreground">
              {t("auth.centerProfile.address", "مقر وعنوان السنتر")}
            </Label>
            <Input
              id="complete-inst-address"
              placeholder={t("auth.centerProfile.addressPlaceholder", "مثال: شارع الجامعة، بجوار المحطة، الدور الثاني")}
              className="h-11 text-sm rounded-xl border-border/80"
              {...register("address")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="complete-inst-license" className="text-xs font-bold text-foreground">
              {t("auth.centerProfile.licenseNumber", "رقم السجل / الترخيص (إن وجد)")}
            </Label>
            <Input
              id="complete-inst-license"
              placeholder={t("auth.centerProfile.licensePlaceholder", "مثال: LIC-2024-8849")}
              className="h-11 text-sm rounded-xl border-border/80"
              {...register("licenseNumber")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="complete-inst-website" className="text-xs font-bold text-foreground">
            {t("auth.centerProfile.website", "الموقع الإلكتروني / رابط الصفحة")}
          </Label>
          <Input
            id="complete-inst-website"
            type="url"
            placeholder="https://example.com"
            className="h-11 text-sm rounded-xl border-border/80 text-left"
            {...register("website")}
          />
          {errors.website && (
            <p className="text-xs text-destructive font-medium" role="alert">
              {errors.website.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
