import React, { useMemo } from "react";
import { UseFormReturn, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  GraduationCap,
  Presentation,
  Phone,
  CreditCard,
  Calendar,
  MapPin,
  Building2,
  School,
  Award,
  BookOpen,
  Users,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  EGYPTIAN_GOVERNORATES,
  validateEgyptianNationalId,
  calculateAgeFromDob,
  ProfileFormValues,
} from "@/hooks/useProfileForm";
import { getCitiesByGovernorate } from "@/data/egyptLocations";
import {
  STAGE_LABELS,
  getGradesForStage,
  getTracksForGrade,
} from "@/lib/curriculumData";
import type { EducationalStage } from "@/types/curriculum";
import { TEACHING_SUBJECTS } from "@/components/auth/register/InstructorFields";

interface SharedProfileFieldsProps {
  form: UseFormReturn<ProfileFormValues>;
  mode: "register" | "complete_profile";
  showRoleSelector?: boolean;
}

export const SharedProfileFields: React.FC<SharedProfileFieldsProps> = ({
  form,
  mode,
  showRoleSelector = true,
}) => {
  const { t } = useTranslation();
  const { control, watch, setValue, formState: { errors } } = form;

  const role = watch("role");
  const nationalId = watch("nationalId");
  const educationLevel = watch("educationLevel");
  const watchedGovernorate = watch("governorate");

  const availableCities = useMemo(() => {
    return getCitiesByGovernorate(watchedGovernorate);
  }, [watchedGovernorate]);

  const nationalIdInfo = useMemo(() => {
    if (nationalId && nationalId.length === 14) {
      return validateEgyptianNationalId(nationalId);
    }
    return { valid: false };
  }, [nationalId]);

  const calculatedAge = useMemo(() => {
    if (nationalIdInfo.valid && nationalIdInfo.dob) {
      return calculateAgeFromDob(nationalIdInfo.dob);
    }
    return null;
  }, [nationalIdInfo]);

  const isUnder18 = calculatedAge !== null && calculatedAge < 18;

  const handleNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue("nationalId", val, { shouldValidate: true });
    if (val.length === 14) {
      const res = validateEgyptianNationalId(val);
      if (res.valid) {
        if (res.dob) setValue("dateOfBirth", res.dob, { shouldValidate: true });
        if (res.gender) setValue("gender", res.gender, { shouldValidate: true });
        if (res.governorate) {
          setValue("governorate", res.governorate, { shouldValidate: true });
          setValue("city", "", { shouldValidate: true });
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Role Selection (Rendered First for complete_profile) */}
      {showRoleSelector && (
        <div className="space-y-2">
          <Label className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-500" />
            {t("auth.selectRoleLabel", "حدد نوع حسابك في المنصة")} <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <button
              type="button"
              onClick={() => setValue("role", "student", { shouldValidate: true })}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                role === "student"
                  ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold shadow-sm ring-2 ring-teal-500/20"
                  : "border-border bg-card/50 hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <GraduationCap className="w-7 h-7 mb-2 text-teal-500" />
              <span className="text-sm font-semibold">{t("auth.roleStudent", "طالب")}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t("auth.roleStudentSub", "تعلّم واكتسب مهارات")}</span>
            </button>

            <button
              type="button"
              onClick={() => setValue("role", "instructor", { shouldValidate: true })}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                role === "instructor"
                  ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold shadow-sm ring-2 ring-teal-500/20"
                  : "border-border bg-card/50 hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <Presentation className="w-7 h-7 mb-2 text-teal-500" />
              <span className="text-sm font-semibold">{t("auth.roleInstructor", "محاضر / معلم")}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t("auth.roleInstructorSub", "قدّم كورسك وتفاعل")}</span>
            </button>

            <button
              type="button"
              onClick={() => setValue("role", "guardian", { shouldValidate: true })}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                role === "guardian"
                  ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold shadow-sm ring-2 ring-teal-500/20"
                  : "border-border bg-card/50 hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <Users className="w-7 h-7 mb-2 text-teal-500" />
              <span className="text-sm font-semibold">{t("auth.roleGuardian", "ولي أمر")}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t("auth.roleGuardianSub", "متابعة مستوى الطالب")}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Personal Information Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t("auth.fields.phone", "رقم الموبايل (مصري)")} <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  dir="ltr"
                  placeholder="01012345678"
                  className="ps-10 font-mono"
                />
              )}
            />
          </div>
          {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
        </div>

        {/* National ID */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t("auth.fields.nationalId", "الرقم القومي (14 رقم)")} <span className="text-destructive">*</span></Label>
          <div className="relative">
            <CreditCard className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Controller
              name="nationalId"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    handleNationalIdChange(e);
                  }}
                  dir="ltr"
                  maxLength={14}
                  placeholder="29805150101234"
                  className="ps-10 font-mono"
                />
              )}
            />
          </div>
          {nationalIdInfo.valid && (
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1 font-medium">
              <span>
                تاريخ الميلاد: {nationalIdInfo.dob} ({calculatedAge} سنة) • النوع: {nationalIdInfo.gender === "male" ? "ذكر" : "أنثى"}
                {nationalIdInfo.governorate ? ` • المحافظة: ${nationalIdInfo.governorate}` : ""}
              </span>
            </p>
          )}
          {errors.nationalId && <p className="text-xs text-destructive mt-1">{errors.nationalId.message}</p>}
        </div>
      </div>

      {/* 3. Location Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Governorate */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t("auth.fields.governorate", "المحافظة")}</Label>
          <div className="relative">
            <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
            <Controller
              name="governorate"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("city", "", { shouldValidate: true });
                  }}
                  value={field.value || ""}
                >
                  <SelectTrigger className="ps-10">
                    <SelectValue placeholder={t("auth.selectGovernorate", "اختر المحافظة")} />
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
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t("auth.fields.city", "المدينة / المركز / الحي")}</Label>
          <div className="relative">
            <Building2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
            {availableCities.length > 0 ? (
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <SelectTrigger className="ps-10">
                      <SelectValue placeholder={t("auth.selectCity", "اختر المدينة أو الحي")} />
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
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder={t("auth.cityPlaceholder", "أدخل اسم المدينة أو الإقامة")}
                    className="ps-10"
                  />
                )}
              />
            )}
          </div>
        </div>
      </div>

      {/* 4. Student Specific Fields */}
      {role === "student" && (
        <div className="space-y-4 pt-2 border-t border-border/50">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <School className="w-4 h-4 text-teal-500" />
            {t("auth.studentAcademicTitle", "البيانات الأكاديمية للطالب")}
          </h4>

          {/* Education Level - powered by curriculumData */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t("auth.fields.educationLevel", "المرحلة الدراسية")}</Label>
            <Controller
              name="educationLevel"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("gradeLevel", "", { shouldValidate: false });
                    setValue("educationalTrack", "", { shouldValidate: false });
                  }}
                  value={field.value || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("auth.selectEducationLevel", "اختر المرحلة الدراسية")} />
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

          {/* Grade Level Dropdown (non-university) */}
          {educationLevel && educationLevel !== "university" && getGradesForStage(educationLevel as EducationalStage).length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("auth.fields.gradeLevel", "الصف الدراسي")}</Label>
              <Controller
                name="gradeLevel"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("educationalTrack", "", { shouldValidate: false });
                    }}
                    value={field.value || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الصف الدراسي" />
                    </SelectTrigger>
                    <SelectContent>
                      {getGradesForStage(educationLevel as EducationalStage).map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Track Dropdown (conditional) */}
          <Controller
            name="gradeLevel"
            control={control}
            render={({ field: gradeField }) => {
              const tracks = getTracksForGrade(educationLevel as EducationalStage, gradeField.value);
              if (tracks.length === 0) return <></>;
              return (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">الشعبة / المسار التخصصي</Label>
                  <Controller
                    name="educationalTrack"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger>
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

          {/* Second Language + Religion (prep, secondary, baccalaureate) */}
          {["prep", "secondary", "baccalaureate"].includes(educationLevel || "") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">اللغة الأجنبية الثانية</Label>
                <Controller
                  name="secondLanguage"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger>
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
                <Label className="text-sm font-medium">التربية الدينية</Label>
                <Controller
                  name="religion"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger>
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

          {/* School Name (primary, prep, secondary, baccalaureate) */}
          {["primary", "prep", "secondary", "baccalaureate"].includes(educationLevel || "") && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("auth.fields.schoolName", "اسم المدرسة")}</Label>
              <Controller
                name="schoolName"
                control={control}
                render={({ field }) => <Input {...field} placeholder="مثال: مدرسة الأورمان الثانوية" />}
              />
            </div>
          )}

          {/* University Details */}
          {educationLevel === "university" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t("auth.fields.universityName", "اسم الجامعة")}</Label>
                <Controller
                  name="universityName"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="مثال: جامعة القاهرة" />}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t("auth.fields.facultyName", "الكلية")}</Label>
                <Controller
                  name="facultyName"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="مثال: كلية الهندسة" />}
                />
              </div>
            </div>
          )}

          {/* Guardian Info for Minors */}
          {isUnder18 && (
            <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{t("auth.guardianNotice", "بما أن عمرك أقل من 18 سنة، يلزم تسجيل بيانات ولي الأمر لحماية حسابك")}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("auth.guardianName", "اسم ولي الأمر")} <span className="text-destructive">*</span></Label>
                    <Controller
                      name="guardianName"
                      control={control}
                      render={({ field }) => <Input {...field} placeholder="اسم ولي الأمر الخماسي" className="h-9 text-xs" />}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t("auth.guardianRelation", "صلة القرابة")}</Label>
                    <Controller
                      name="guardianRelationship"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || "father"}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="father">{t("auth.relFather", "الأب")}</SelectItem>
                            <SelectItem value="mother">{t("auth.relMother", "الأم")}</SelectItem>
                            <SelectItem value="guardian">{t("auth.relOther", "ولي أمر / وصي")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t("auth.guardianPhone", "موبايل ولي الأمر")} <span className="text-destructive">*</span></Label>
                    <Controller
                      name="guardianPhone"
                      control={control}
                      render={({ field }) => <Input {...field} dir="ltr" placeholder="01234567890" className="h-9 text-xs font-mono" />}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 5. Instructor Specific Fields */}
      {role === "instructor" && (
        <div className="space-y-4 pt-2 border-t border-border/50">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-500" />
            {t("auth.instructorAcademicTitle", "البيانات الأكاديمية والمهنية للمحاضر")}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("auth.fields.specialization", "المادة العلمية التخصصية")} <span className="text-destructive">*</span></Label>
              <Controller
                name="specialization"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("teachingSubject", val);
                    }}
                    value={field.value || watch("teachingSubject") || ""}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="اختر المادة العلمية التخصصية..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TEACHING_SUBJECTS.map((subj) => (
                        <SelectItem key={subj.id} value={subj.id}>
                          <span className="flex items-center gap-2">
                            <span>{subj.icon}</span>
                            <span className="font-medium">{subj.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("auth.fields.qualification", "المؤهل العلمي / الشهادة")}</Label>
              <div className="relative">
                <Award className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Controller
                  name="qualification"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="مثال: بكالوريوس التربية / ليسانس الآداب" className="ps-10" />}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">سنوات الخبرة التدريسية</Label>
              <Controller
                name="yearsOfExperience"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => field.onChange(parseInt(val, 10))}
                    value={field.value !== undefined ? String(field.value) : "0"}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="اختر سنوات الخبرة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">معلم حديث التخرج / مبتدئ</SelectItem>
                      <SelectItem value="1">سنة إلى سنتين</SelectItem>
                      <SelectItem value="3">3 - 5 سنوات</SelectItem>
                      <SelectItem value="6">6 - 9 سنوات</SelectItem>
                      <SelectItem value="10">10 سنوات فأكثر</SelectItem>
                      <SelectItem value="15">أكثر من 15 سنة خبرة</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">المراحل التي يدرسها المعلم</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {(["primary", "prep", "secondary", "baccalaureate"] as const).map((stageKey) => {
                  const currentStages: string[] = (watch("teachingStages") as string[]) || [];
                  const isSelected = currentStages.includes(stageKey);
                  return (
                    <button
                      key={stageKey}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? currentStages.filter((s) => s !== stageKey)
                          : [...currentStages, stageKey];
                        setValue("teachingStages", updated);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {STAGE_LABELS[stageKey]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t("auth.fields.bio", "نبذة تعريفية للمحاضر (Bio)")}</Label>
            <Controller
              name="bio"
              control={control}
              render={({ field }) => <Textarea {...field} rows={3} placeholder="اكتب نبذة مختصرة تعرّف بها الطلاب بخبراتك وأسلوبك الشيق في الشرح..." />}
            />
          </div>
        </div>
      )}

      {/* 6. Guardian Specific Fields */}
      {role === "guardian" && (
        <div className="space-y-4 pt-2 border-t border-border/50">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-500" />
            بيانات الطالب المراد متابعته
          </h4>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
              لربط حساب ولي الأمر بالطالب، يرجى إدخال الرقم القومي المكون من 14 رقماً والمسجل به الطالب في المنصة مسبقاً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">الرقم القومي للطالب (14 رقم) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <CreditCard className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Controller
                  name="studentNationalId"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      dir="ltr"
                      maxLength={14}
                      placeholder="30501010101234"
                      className="ps-10 font-mono"
                    />
                  )}
                />
              </div>
              {errors.studentNationalId && <p className="text-xs text-destructive mt-1">{errors.studentNationalId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">صلة القرابة بالطالب <span className="text-destructive">*</span></Label>
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
        </div>
      )}
    </div>
  );
};
