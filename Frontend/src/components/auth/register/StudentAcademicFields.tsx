import React from "react";
import { School, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Controller, type Control, type UseFormRegister, type UseFormSetValue, type FieldErrors } from "react-hook-form";
import type { RegisterFormValues } from "./types";
import {
  STAGE_LABELS,
  getGradesForStage,
  getTracksForGrade,
} from "@/lib/curriculumData";
import type { EducationalStage } from "@/types/curriculum";

interface StudentAcademicFieldsProps {
  register: UseFormRegister<RegisterFormValues>;
  control: Control<RegisterFormValues>;
  errors: FieldErrors<RegisterFormValues>;
  selectedEduLevel?: string;
  setValue: UseFormSetValue<RegisterFormValues>;
}

export const StudentAcademicFields: React.FC<StudentAcademicFieldsProps> = ({
  register,
  control,
  errors,
  selectedEduLevel,
  setValue,
}) => {
  const grades = getGradesForStage(selectedEduLevel as EducationalStage);

  return (
    <Card className="rounded-3xl border border-border/80 shadow-md bg-card">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <School className="text-primary" size={20} /> بيانات الدراسة والمرحلة الأكاديمية
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          حدد مرحلتك الدراسية ليتم تخصيص الدورات والمحتوى المناسب لصفك
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Row 1: Education Level (Stage) + Grade Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-eduLevel" className="text-xs font-bold text-foreground">
              المرحلة الدراسية
            </Label>
            <Controller
              name="educationLevel"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    // Reset downstream fields when stage changes
                    setValue("gradeLevel", "");
                    setValue("educationalTrack", "");
                  }}
                  value={field.value}
                >
                  <SelectTrigger id="reg-eduLevel" className="h-11 rounded-xl border-border/80 text-sm">
                    <SelectValue placeholder="اختر المرحلة الدراسية" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(STAGE_LABELS) as [EducationalStage, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Grade Level: Dynamic Dropdown */}
          {selectedEduLevel && selectedEduLevel !== "university" && grades.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="reg-gradeLevel" className="text-xs font-bold text-foreground">
                الصف الدراسي
              </Label>
              <Controller
                name="gradeLevel"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("educationalTrack", "");
                    }}
                    value={field.value || ""}
                  >
                    <SelectTrigger id="reg-gradeLevel" className="h-11 rounded-xl border-border/80 text-sm">
                      <SelectValue placeholder="اختر الصف الدراسي" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
        </div>

        {/* Row 2: Track (Conditional) */}
        <Controller
          name="gradeLevel"
          control={control}
          render={({ field: gradeField }) => {
            const tracks = getTracksForGrade(selectedEduLevel as EducationalStage, gradeField.value);
            if (tracks.length === 0) return <></>;
            return (
              <div className="space-y-1.5">
                <Label htmlFor="reg-track" className="text-xs font-bold text-foreground">
                  الشعبة / المسار التخصصي <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="educationalTrack"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger id="reg-track" className="h-11 rounded-xl border-border/80 text-sm">
                        <SelectValue placeholder="اختر الشعبة / المسار" />
                      </SelectTrigger>
                      <SelectContent>
                        {tracks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            );
          }}
        />

        {/* Row 3: Second Language (for prep, secondary, baccalaureate) */}
        {["prep", "secondary", "baccalaureate"].includes(selectedEduLevel || "") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-secondLang" className="text-xs font-bold text-foreground">
                اللغة الأجنبية الثانية
              </Label>
              <Controller
                name="secondLanguage"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger id="reg-secondLang" className="h-11 rounded-xl border-border/80 text-sm">
                      <SelectValue placeholder="اختر اللغة الثانية (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="french">اللغة الفرنسية</SelectItem>
                      <SelectItem value="german">اللغة الألمانية</SelectItem>
                      <SelectItem value="italian">اللغة الإيطالية</SelectItem>
                      <SelectItem value="spanish">اللغة الإسبانية</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-religion" className="text-xs font-bold text-foreground">
                التربية الدينية
              </Label>
              <Controller
                name="religion"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger id="reg-religion" className="h-11 rounded-xl border-border/80 text-sm">
                      <SelectValue placeholder="اختر (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="islamic">تربية دينية إسلامية</SelectItem>
                      <SelectItem value="christian">تربية دينية مسيحية</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        )}

        {/* School Name (for primary, prep, secondary, baccalaureate) */}
        {["primary", "prep", "secondary", "baccalaureate"].includes(selectedEduLevel || "") && (
          <div className="space-y-1.5">
            <Label htmlFor="reg-schoolName" className="text-xs font-bold text-foreground">
              اسم المدرسة <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                id="reg-schoolName"
                placeholder="اسم مدرستك (مثال: مدرسة المتفوقين الثانوية)"
                aria-describedby="reg-schoolName-err"
                className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("schoolName")}
              />
            </div>
            {errors.schoolName && (
              <p id="reg-schoolName-err" className="text-xs text-destructive font-medium">
                {errors.schoolName.message}
              </p>
            )}
          </div>
        )}

        {/* University fields */}
        {selectedEduLevel === "university" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-universityName" className="text-xs font-bold text-foreground">
                اسم الجامعة <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                <Input
                  id="reg-universityName"
                  placeholder="مثال: جامعة القاهرة"
                  aria-describedby="reg-universityName-err"
                  className="ps-10 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                  {...register("universityName")}
                />
              </div>
              {errors.universityName && (
                <p id="reg-universityName-err" className="text-xs text-destructive font-medium">
                  {errors.universityName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-facultyName" className="text-xs font-bold text-foreground">
                الكلية
              </Label>
              <Input
                id="reg-facultyName"
                placeholder="مثال: كلية الهندسة"
                className="h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary"
                {...register("facultyName")}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
