import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  User,
  GraduationCap,
  Award,
  Building2,
  Users,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useToast } from "@/components/ui/use-toast";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ApiError } from "@/lib/apiError";
import type { UserRole, RegisterData, EducationLevel } from "@/types/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { validateEgyptianNationalId, calculateAgeFromDob } from "@/components/auth/register/egyptianValidation";
import { buildRegisterSchema, type RegisterFormValues } from "@/components/auth/register/types";
import { RoleSelector } from "@/components/auth/register/RoleSelector";
import { PersonalInfoFields } from "@/components/auth/register/PersonalInfoFields";
import { StudentAcademicFields } from "@/components/auth/register/StudentAcademicFields";
import { GuardianFields } from "@/components/auth/register/GuardianFields";
import { GuardianRoleFields } from "@/components/auth/register/GuardianRoleFields";
import { InstructorFields } from "@/components/auth/register/InstructorFields";
import { CenterFields } from "@/components/auth/register/CenterFields";
import { SecurityFields } from "@/components/auth/register/SecurityFields";
import { STAGE_LABELS } from "@/lib/curriculumData";
import type { EducationalStage } from "@/types/curriculum";

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerAuth } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const registerSchema = useMemo(() => buildRegisterSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "student",
      fullName: "",
      email: "",
      phone: "",
      nationalId: "",
      dateOfBirth: "",
      gender: "male",
      governorate: "القاهرة",
      city: "",
      password: "",
      confirmPassword: "",
      terms: false,
      educationLevel: "secondary",
      schoolName: "",
      gradeLevel: "الصف الثالث الثانوي",
      educationalTrack: "scientific_science",
      secondLanguage: "",
      religion: "",
      universityName: "",
      facultyName: "",
      guardianFullName: "",
      guardianRelationship: "father",
      guardianPhone: "",
      guardianNationalId: "",
      qualification: "",
      specialization: "",
      teachingSubject: "",
      teachingStages: ["secondary"],
      teachingGrades: [],
      yearsOfExperience: 3,
      bio: "",
      institutionName: "",
      institutionType: "center",
      address: "",
      licenseNumber: "",
      website: "",
    },
  });

  // Progressive Accordion State: which sections are open
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
  });

  const toggleSection = (step: number) => {
    setOpenSections((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const goToSection = (nextStep: number) => {
    setOpenSections({
      1: nextStep === 1,
      2: nextStep === 2,
      3: nextStep === 3,
      4: nextStep === 4,
    });
  };

  const selectedRole = watch("role");
  const selectedEduLevel = watch("educationLevel");
  const watchedFullName = watch("fullName");
  const watchedPhone = watch("phone");
  const watchedGovernorate = watch("governorate");
  const watchedGrade = watch("gradeLevel");
  const watchedSubject = watch("teachingSubject");
  const watchedSpecialization = watch("specialization");
  const watchedStages = watch("teachingStages") || [];
  const watchedInstitutionName = watch("institutionName");
  const watchedStudentNid = watch("studentNationalId");
  const watchedNationalId = watch("nationalId");
  const watchedDob = watch("dateOfBirth");

  // Real-time extraction of DOB, gender, and age from National ID
  const nidAnalysis = useMemo(() => {
    return validateEgyptianNationalId(watchedNationalId);
  }, [watchedNationalId]);

  const computedAge = useMemo(() => {
    const dob = nidAnalysis.dob || watchedDob;
    return calculateAgeFromDob(dob);
  }, [nidAnalysis.dob, watchedDob]);

  // Update form values if NID becomes valid (DOB, Gender, Governorate)
  useEffect(() => {
    if (nidAnalysis.valid) {
      if (nidAnalysis.dob) {
        setValue("dateOfBirth", nidAnalysis.dob);
      }
      if (nidAnalysis.gender) {
        setValue("gender", nidAnalysis.gender);
      }
      if (nidAnalysis.governorate) {
        setValue("governorate", nidAnalysis.governorate);
      }
    }
  }, [nidAnalysis, setValue]);

  const redirectByRole = (role: UserRole) => {
    const routes: Record<UserRole, string> = {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      guardian: "/student/dashboard",
      center: "/dashboard",
      admin: "/admin/dashboard",
      super_admin: "/super-admin/dashboard",
    };
    navigate(routes[role] || "/");
  };

  const onInvalid = (formErrors: FieldErrors<RegisterFormValues>) => {
    const personalKeys = ["fullName", "email", "phone", "nationalId"];
    const academicKeys = [
      "educationLevel",
      "schoolName",
      "gradeLevel",
      "teachingSubject",
      "teachingStages",
      "institutionName",
      "studentNationalId",
    ];
    const securityKeys = ["password", "confirmPassword", "terms"];

    const hasPersonalError = personalKeys.some((k) => k in formErrors);
    const hasAcademicError = academicKeys.some((k) => k in formErrors);
    const hasSecurityError = securityKeys.some((k) => k in formErrors);

    if (hasPersonalError) {
      setOpenSections({ 1: false, 2: true, 3: false, 4: false });
    } else if (hasAcademicError) {
      setOpenSections({ 1: false, 2: false, 3: true, 4: false });
    } else if (hasSecurityError) {
      setOpenSections({ 1: false, 2: false, 3: false, 4: true });
    }

    const firstMsg = Object.values(formErrors)[0]?.message;
    toast({
      variant: "destructive",
      title: "يرجى استكمال البيانات المطلوبة",
      description: typeof firstMsg === "string" ? firstMsg : "يوجد حقول مطلوبة لم يتم استكمالها.",
    });
  };

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const parts = data.fullName.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");

      const payload: RegisterData = {
        role: data.role,
        fullName: data.fullName.trim(),
        firstName,
        lastName,
        email: data.email.trim(),
        phone: data.phone.trim(),
        nationalId: data.nationalId.trim(),
        dateOfBirth: data.dateOfBirth || nidAnalysis.dob,
        gender: data.gender || nidAnalysis.gender || "male",
        governorate: data.governorate,
        city: data.city,
        password: data.password,
      };

      if (data.role === "student") {
        payload.educationLevel = data.educationLevel as EducationLevel;
        payload.schoolName = data.schoolName;
        payload.gradeLevel = data.gradeLevel;
        payload.educationalTrack = data.educationalTrack;
        payload.secondLanguage = data.secondLanguage;
        payload.religion = data.religion;

        payload.student = {
          educationLevel: data.educationLevel as EducationLevel,
          schoolName: data.schoolName,
          gradeLevel: data.gradeLevel,
          educationalTrack: data.educationalTrack,
          secondLanguage: data.secondLanguage,
          religion: data.religion,
          universityName: data.universityName,
          facultyName: data.facultyName,
        };

        if (data.guardianFullName || data.guardianPhone) {
          payload.guardian = {
            fullName: data.guardianFullName || "",
            relationship: data.guardianRelationship || "father",
            phone: data.guardianPhone || "",
            nationalId: data.guardianNationalId,
          };
        }
      } else if (data.role === "instructor") {
        payload.instructor = {
          qualification: data.qualification,
          specialization: data.specialization || data.teachingSubject,
          teachingSubject: data.teachingSubject,
          teachingStages: data.teachingStages,
          teachingGrades: data.teachingGrades,
          yearsOfExperience: data.yearsOfExperience,
          bio: data.bio,
        };
        payload.qualification = data.qualification;
        payload.specialization = data.specialization || data.teachingSubject;
        payload.teachingSubject = data.teachingSubject;
        payload.teachingStages = data.teachingStages;
        payload.teachingGrades = data.teachingGrades;
        payload.yearsOfExperience = data.yearsOfExperience;
        payload.bio = data.bio;
      } else if (data.role === "center") {
        payload.institutionName = data.institutionName;
        payload.institutionType = data.institutionType;
        payload.address = data.address;
        payload.licenseNumber = data.licenseNumber;
        payload.website = data.website;
      } else if (data.role === "guardian") {
        payload.studentNationalId = data.studentNationalId;
        payload.guardianRelationship = data.guardianRelationship || "father";
      }

      const user = await registerAuth(payload);
      const roleName =
        data.role === "instructor"
          ? "محاضر معتمد"
          : data.role === "center"
          ? "سنتر تعليمي"
          : data.role === "guardian"
          ? "ولي أمر"
          : "طالب";
      toast({
        title: "تم إنشاء الحساب بنجاح! 🎉",
        description: `أهلاً بك في منصة كورسات كـ ${roleName}.`,
      });
      redirectByRole(user.role || data.role);
    } catch (e) {
      const err = e as ApiError;

      if (err.fields) {
        const fieldMapping: Record<string, keyof RegisterFormValues> = {
          email: "email",
          phone: "phone",
          national_id: "nationalId",
          nationalId: "nationalId",
          password: "password",
          school_name: "schoolName",
          schoolName: "schoolName",
          grade_level: "gradeLevel",
          gradeLevel: "gradeLevel",
          university_name: "universityName",
          universityName: "universityName",
          guardian: "guardianPhone",
          guardian_phone: "guardianPhone",
          guardianPhone: "guardianPhone",
          guardian_full_name: "guardianFullName",
          student_national_id: "studentNationalId",
          studentNationalId: "studentNationalId",
          institution_name: "institutionName",
          institutionName: "institutionName",
          teaching_subject: "teachingSubject",
          teachingSubject: "teachingSubject",
          specialization: "specialization",
        };

        for (const [serverField, msgs] of Object.entries(err.fields)) {
          const formField = fieldMapping[serverField];
          const msg = Array.isArray(msgs) ? msgs[0] : msgs;
          if (formField && msg) {
            setError(formField, { type: "server", message: msg });
          }
        }
      }

      toast({
        variant: "destructive",
        title: "تعذر إنشاء الحساب",
        description: err.message || "يرجى مراجعة البيانات والإعادة.",
      });
    }
  };

  // Check section completion
  const isStep1Done = Boolean(selectedRole);
  const isStep2Done = Boolean(watchedFullName?.trim() && watchedPhone?.trim() && watchedNationalId?.length === 14);
  const isStep3Done = useMemo(() => {
    if (selectedRole === "student") return Boolean(selectedEduLevel);
    if (selectedRole === "instructor") return Boolean(watchedSubject || watchedSpecialization);
    if (selectedRole === "center") return Boolean(watchedInstitutionName);
    if (selectedRole === "guardian") return Boolean(watchedStudentNid);
    return false;
  }, [selectedRole, selectedEduLevel, watchedSubject, watchedSpecialization, watchedInstitutionName, watchedStudentNid]);

  // Role summary label
  const roleSummaryLabel = useMemo(() => {
    switch (selectedRole) {
      case "student":
        return "حساب طالب";
      case "instructor":
        return "حساب محاضر / معلم";
      case "center":
        return "سنتر تعليمي";
      case "guardian":
        return "حساب ولي أمر";
      default:
        return "";
    }
  }, [selectedRole]);

  // Academic summary label
  const academicSummaryLabel = useMemo(() => {
    if (selectedRole === "student" && selectedEduLevel) {
      return `${STAGE_LABELS[selectedEduLevel as EducationalStage] || selectedEduLevel} • ${watchedGrade || ""}`;
    }
    if (selectedRole === "instructor") {
      const subjectName = watchedSpecialization || watchedSubject || "تخصص معتمد";
      const stagesCount = watchedStages.length > 0 ? `${watchedStages.length} مراحل` : "";
      return `${subjectName} ${stagesCount ? `• ${stagesCount}` : ""}`;
    }
    if (selectedRole === "center") {
      return watchedInstitutionName || "بيانات السنتر";
    }
    if (selectedRole === "guardian") {
      return watchedStudentNid ? `طالب: ${watchedStudentNid}` : "ربط الطالب";
    }
    return "";
  }, [selectedRole, selectedEduLevel, watchedGrade, watchedSpecialization, watchedSubject, watchedStages, watchedInstitutionName, watchedStudentNid]);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] py-10 px-4 bg-gradient-to-b from-background via-muted/20 to-background flex items-center justify-center">
        <div className="w-full max-w-3xl space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">
              <Sparkles size={14} /> بوابة التسجيل الذكية الموحدة
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              إنشاء حساب أكاديمي جديد
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              سجل الآن بتدفق سلس وسريع وفق الهيكل المعتمد للمناهج والمقررات
            </p>
          </div>

          {/* Quick Progress Bar Indicator */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { step: 1, title: "نوع الحساب", icon: User, isDone: isStep1Done },
                { step: 2, title: "البيانات الشخصية", icon: ShieldCheck, isDone: isStep2Done },
                { step: 3, title: "المسار الأكاديمي", icon: GraduationCap, isDone: isStep3Done },
                { step: 4, title: "الأمان والتأكيد", icon: CheckCircle2, isDone: false },
              ].map((item) => {
                const isOpen = openSections[item.step];
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => goToSection(item.step)}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer ${
                      isOpen
                        ? "bg-primary/10 text-primary font-bold shadow-2xs ring-1 ring-primary/30"
                        : item.isDone
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        item.isDone
                          ? "bg-emerald-500 text-white"
                          : isOpen
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.isDone ? <Check size={12} /> : item.step}
                    </div>
                    <span className="truncate hidden sm:inline">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Registration Form Wrapped in Progressive Accordion Boxes */}
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            {/* BOX 1: Account Role Selection */}
            <div
              className={`rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden ${
                openSections[1]
                  ? "border-primary/60 bg-card ring-2 ring-primary/10 shadow-md"
                  : "border-border/80 bg-card/70 hover:border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(1)}
                className="w-full p-5 sm:p-6 flex items-center justify-between text-start cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                      isStep1Done
                        ? "bg-emerald-500 text-white shadow-xs"
                        : openSections[1]
                        ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isStep1Done ? <Check size={18} /> : 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">تحديد نوع الحساب في المنصة</h3>
                      {roleSummaryLabel && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-bold">
                          {roleSummaryLabel}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      اختر صفة حسابك (طالب، محاضر/معلم، سنتر تعليمي، ولي أمر)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ms-2 text-muted-foreground">
                  {!openSections[1] && <span className="text-xs text-primary font-medium hidden sm:inline">تعديل</span>}
                  {openSections[1] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openSections[1] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-border/50"
                  >
                    <div className="p-5 sm:p-6 pt-5 space-y-6">
                      <RoleSelector
                        selectedRole={selectedRole}
                        onSelectRole={(role) => {
                          setValue("role", role);
                        }}
                      />

                      {/* Quick Google Sign Up */}
                      <Card className="rounded-2xl border border-border/70 shadow-xs bg-muted/10">
                        <CardContent className="p-4 sm:p-5 space-y-3">
                          <div className="text-center space-y-1">
                            <h4 className="text-xs font-bold text-foreground">تسجيل سريع ومباشر</h4>
                            <p className="text-[11px] text-muted-foreground">أنشئ حسابك فوراً بخطوة واحدة عبر حساب Google</p>
                          </div>
                          <GoogleAuthButton />
                        </CardContent>
                      </Card>

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={() => goToSection(2)}
                          className="font-bold text-xs gap-2 rounded-xl h-10 px-5 shadow-xs"
                        >
                          الانتقال للبيانات الشخصية
                          <ArrowLeft size={16} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BOX 2: Personal Identity & Egyptian National ID */}
            <div
              className={`rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden ${
                openSections[2]
                  ? "border-primary/60 bg-card ring-2 ring-primary/10 shadow-md"
                  : "border-border/80 bg-card/70 hover:border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(2)}
                className="w-full p-5 sm:p-6 flex items-center justify-between text-start cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                      isStep2Done
                        ? "bg-emerald-500 text-white shadow-xs"
                        : openSections[2]
                        ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isStep2Done ? <Check size={18} /> : 2}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">الهوية والبيانات الشخصية</h3>
                      {watchedFullName && (
                        <Badge variant="outline" className="bg-muted text-foreground text-xs font-medium">
                          {watchedFullName} • {watchedGovernorate}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الاسم الرسمي، رقم الهاتف، الرقم القومي، المحافظة والمدينة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ms-2 text-muted-foreground">
                  {!openSections[2] && <span className="text-xs text-primary font-medium hidden sm:inline">تعديل</span>}
                  {openSections[2] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openSections[2] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-border/50"
                  >
                    <div className="p-5 sm:p-6 pt-5 space-y-6">
                      <PersonalInfoFields
                        register={register}
                        control={control}
                        setValue={setValue}
                        errors={errors}
                        nidAnalysis={nidAnalysis}
                        computedAge={computedAge}
                      />

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goToSection(1)}
                          className="text-xs gap-1.5 rounded-xl h-10"
                        >
                          <ArrowRight size={16} />
                          السابق (نوع الحساب)
                        </Button>
                        <Button
                          type="button"
                          onClick={() => goToSection(3)}
                          className="font-bold text-xs gap-2 rounded-xl h-10 px-5 shadow-xs"
                        >
                          الانتقال للمسار الأكاديمي
                          <ArrowLeft size={16} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BOX 3: Role-Specific Specialized Academic Details */}
            <div
              className={`rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden ${
                openSections[3]
                  ? "border-primary/60 bg-card ring-2 ring-primary/10 shadow-md"
                  : "border-border/80 bg-card/70 hover:border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(3)}
                className="w-full p-5 sm:p-6 flex items-center justify-between text-start cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                      isStep3Done
                        ? "bg-emerald-500 text-white shadow-xs"
                        : openSections[3]
                        ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isStep3Done ? <Check size={18} /> : 3}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">
                        {selectedRole === "instructor"
                          ? "التخصص التدريسي والمراحل المستهدفة"
                          : selectedRole === "student"
                          ? "المرحلة والصف الدراسي الأكاديمي"
                          : selectedRole === "center"
                          ? "بيانات المؤسسة والسنتر التعليمي"
                          : "بيانات الطالب المراد متابعته"}
                      </h3>
                      {academicSummaryLabel && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-bold">
                          {academicSummaryLabel}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedRole === "instructor"
                        ? "اختر مادتك التدريسية وحدد المراحل والصفوف المعتمدة"
                        : selectedRole === "student"
                        ? "حدد مرحلتك وصفك الدراسي واللغات والمدرسة"
                        : selectedRole === "center"
                        ? "أدخل بيانات السنتر والترخيص والعنوان"
                        : "أدخل الرقم القومي للطالب وصلة القرابة"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ms-2 text-muted-foreground">
                  {!openSections[3] && <span className="text-xs text-primary font-medium hidden sm:inline">تعديل</span>}
                  {openSections[3] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openSections[3] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-border/50"
                  >
                    <div className="p-5 sm:p-6 pt-5 space-y-6">
                      {/* Student Academic Fields */}
                      {selectedRole === "student" && (
                        <div className="space-y-6">
                          <StudentAcademicFields
                            register={register}
                            control={control}
                            errors={errors}
                            selectedEduLevel={selectedEduLevel}
                            setValue={setValue}
                          />

                          <GuardianFields
                            register={register}
                            control={control}
                            errors={errors}
                            computedAge={computedAge}
                          />
                        </div>
                      )}

                      {/* Instructor Academic Fields */}
                      {selectedRole === "instructor" && (
                        <InstructorFields
                          register={register}
                          control={control}
                          setValue={setValue}
                          watch={watch}
                          errors={errors}
                        />
                      )}

                      {/* Center Fields */}
                      {selectedRole === "center" && (
                        <CenterFields register={register} control={control} errors={errors} />
                      )}

                      {/* Guardian Fields */}
                      {selectedRole === "guardian" && (
                        <GuardianRoleFields register={register} control={control} errors={errors} />
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goToSection(2)}
                          className="text-xs gap-1.5 rounded-xl h-10"
                        >
                          <ArrowRight size={16} />
                          السابق (البيانات الشخصية)
                        </Button>
                        <Button
                          type="button"
                          onClick={() => goToSection(4)}
                          className="font-bold text-xs gap-2 rounded-xl h-10 px-5 shadow-xs"
                        >
                          الانتقال للأمان وتأكيد الحساب
                          <ArrowLeft size={16} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BOX 4: Security & Confirmation */}
            <div
              className={`rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden ${
                openSections[4]
                  ? "border-primary/60 bg-card ring-2 ring-primary/10 shadow-md"
                  : "border-border/80 bg-card/70 hover:border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(4)}
                className="w-full p-5 sm:p-6 flex items-center justify-between text-start cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                      openSections[4]
                        ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    4
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">الأمان وكلمة المرور وتأكيد الحساب</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      حدد كلمة مرور قوية لحماية حسابك والموافقة على شروط الاستخدام
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ms-2 text-muted-foreground">
                  {openSections[4] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openSections[4] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-border/50"
                  >
                    <div className="p-5 sm:p-6 pt-5 space-y-6">
                      <SecurityFields
                        register={register}
                        control={control}
                        errors={errors}
                        isSubmitting={isSubmitting}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Register;
