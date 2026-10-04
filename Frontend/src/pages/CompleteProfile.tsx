import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, ArrowLeft, Loader2, UserCheck, GraduationCap, Presentation, Users, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth";
import { SharedProfileFields } from "@/components/auth/SharedProfileFields";
import { CenterProfileFields } from "@/components/auth/CenterProfileFields";
import { useProfileFormSchema, ProfileFormValues } from "@/hooks/useProfileForm";
import { apiPost } from "@/lib/http";
import type { User } from "@/types/auth";

const ROLE_OPTIONS: Array<{
  value: ProfileFormValues["role"];
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}> = [
  { value: "student", icon: GraduationCap, label: "طالب", description: "تعلّم واكتسب مهارات" },
  { value: "instructor", icon: Presentation, label: "محاضر / معلم", description: "قدّم كورساتك وتفاعل مع الطلاب" },
  { value: "center", icon: Building2, label: "سنتر تعليمي", description: "أدر مؤسستك التعليمية وفريقك" },
  { value: "guardian", icon: Users, label: "ولي أمر", description: "تابع مستوى الطالب" },
];

interface CompleteProfileResponse {
  user: User;
  profile_completed: boolean;
  message: string;
}

const CompleteProfile: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAuthenticated, setUserData } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = useProfileFormSchema("complete_profile");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "student",
      phone: "",
      nationalId: "",
      governorate: "القاهرة",
      city: "",
      educationLevel: "secondary",
      guardianRelationship: "father",
      institutionType: "center",
      institutionName: "",
      address: "",
      licenseNumber: "",
      website: "",
    },
  });

  const selectedRole = form.watch("role");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else if (user?.profileCompleted) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  const redirectByRole = (role: ProfileFormValues["role"]) => {
    const pendingRedirect = sessionStorage.getItem("pendingActivationRedirect");
    if (pendingRedirect) {
      sessionStorage.removeItem("pendingActivationRedirect");
      navigate(pendingRedirect, { replace: true });
      return;
    }

    const routes: Record<ProfileFormValues["role"], string> = {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      center: "/center/dashboard",
      guardian: "/student/dashboard",
    };
    navigate(routes[role] || "/dashboard", { replace: true });
  };

  const onInvalid = (errors: FieldErrors<ProfileFormValues>) => {
    const firstError = Object.values(errors)[0];
    const message = typeof firstError?.message === "string" ? firstError.message : undefined;

    toast({
      variant: "destructive",
      title: t("auth.validationRequiredTitle", "يرجى مراجعة البيانات المطلوبة"),
      description: message || t("auth.validationRequiredDesc", "يوجد حقل مطلوب أو غير صحيح لم يتم استكماله."),
    });
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        role: values.role,
        phone: values.phone,
        national_id: values.nationalId,
        date_of_birth: values.dateOfBirth || null,
        gender: values.gender || null,
        governorate: values.governorate || null,
        city: values.city || null,
      };

      if (values.role === "student") {
        payload.education_level = values.educationLevel || "secondary";
        if (values.educationLevel === "university") {
          payload.university_name = values.universityName || "";
          payload.faculty_name = values.facultyName || "";
        } else {
          payload.school_name = values.schoolName || "";
          payload.grade_level = values.gradeLevel || "";
          if (values.educationalTrack) {
            payload.educational_track = values.educationalTrack;
          }
          if (values.secondLanguage) {
            payload.second_language = values.secondLanguage;
          }
          if (values.religion) {
            payload.religion = values.religion;
          }
        }

        if (values.guardianPhone || values.guardianName) {
          payload.guardian = {
            full_name: values.guardianName || "",
            relationship: values.guardianRelationship || "father",
            phone: values.guardianPhone || "",
          };
        }
      } else if (values.role === "instructor") {
        payload.qualification = values.qualification || "";
        payload.specialization = values.specialization || values.teachingSubject || "";
        payload.teaching_subject = values.teachingSubject || values.specialization || "";
        if (values.teachingStages && values.teachingStages.length > 0) {
          payload.teaching_stages = values.teachingStages;
        }
        if (values.teachingGrades && values.teachingGrades.length > 0) {
          payload.teaching_grades = values.teachingGrades;
        }
        if (values.yearsOfExperience !== undefined) {
          payload.years_of_experience = values.yearsOfExperience;
        }
        payload.bio = values.bio || "";
      } else if (values.role === "center") {
        payload.institution_name = values.institutionName?.trim() || "";
        payload.institution_type = values.institutionType || "center";
        payload.address = values.address?.trim() || "";
        payload.license_number = values.licenseNumber?.trim() || "";
        payload.website = values.website?.trim() || "";
      } else if (values.role === "guardian") {
        payload.student_national_id = values.studentNationalId || "";
        payload.guardian_relationship = values.guardianRelationship || "father";
      }

      const response = await apiPost<CompleteProfileResponse>("/auth/complete-profile/", payload);
      setUserData(response.user);

      toast({
        title: t("auth.profileCompletedTitle", "تم إكمال حسابك بنجاح! 🎉"),
        description: t("auth.profileCompletedDesc", "تم حفظ بيانات حسابك بنجاح ويمكنك الآن استخدام المنصة."),
      });

      redirectByRole(values.role);
    } catch (err: unknown) {
      const error = err as {
        message?: string;
        response?: { data?: { error?: { message?: string }; message?: string } };
      };
      const errMsg =
        error.message ||
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        t("auth.profileCompleteFailed", "حدث خطأ أثناء إكمال البيانات. يرجى التحقق من صحة المدخلات.");

      toast({
        variant: "destructive",
        title: t("auth.errorTitle", "تعذر حفظ البيانات"),
        description: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-border/60 shadow-xl backdrop-blur-xl bg-card/80 dark:bg-card/40 rounded-2xl overflow-hidden">
            <CardHeader className="text-center pb-6 border-b border-border/40">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 shadow-inner">
                <UserCheck className="w-7 h-7" />
              </div>
              <CardTitle className="text-2xl font-black text-foreground tracking-tight">
                {t("auth.completeProfileTitle", "خطوة واحدة فقط لإكمال حسابك")} ✨
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                {t("auth.completeProfileSub", "مرحباً بك")} <span className="font-bold text-foreground">{user?.fullName || user?.email}</span>! {t("auth.completeProfileSubDetail", "اختر نوع حسابك واستكمل البيانات المطلوبة للمتابعة.")}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Sparkles className="w-4 h-4 text-teal-500" />
                    اختر نوع حسابك
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROLE_OPTIONS.map(({ value, icon: Icon, label, description }) => {
                      const selected = selectedRole === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => form.setValue("role", value, { shouldValidate: true, shouldDirty: true })}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-right transition-all ${
                            selected
                              ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20"
                              : "border-border bg-card/50 hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-6 h-6 shrink-0 text-teal-500" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-foreground">{label}</span>
                            <span className="block text-xs mt-0.5 text-muted-foreground">{description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <SharedProfileFields form={form} mode="complete_profile" showRoleSelector={false} />

                {selectedRole === "center" && <CenterProfileFields form={form} />}

                <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>{t("auth.privacyGuaranteed", "بياناتك الرسمية مشفرة ومحمية بأعلى معايير الأمان")}</span>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-w-[200px] bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold rounded-xl h-11 shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("auth.savingProfile", "جاري حفظ البيانات...")}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {t("auth.finishRegistration", "إكمال التسجيل والدخول")}
                        <ArrowLeft className="w-4 h-4 text-white" />
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default CompleteProfile;
