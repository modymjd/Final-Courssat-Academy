import { useMemo } from "react";
import * as z from "zod";
import { useTranslation } from "react-i18next";

import {
  EGYPTIAN_GOVERNORATES,
  EGYPTIAN_PHONE_REGEX,
  validateEgyptianNationalId,
  calculateAgeFromDob,
  type NationalIdAnalysis,
} from "@/components/auth/register/egyptianValidation";

export {
  EGYPTIAN_GOVERNORATES,
  EGYPTIAN_PHONE_REGEX,
  validateEgyptianNationalId,
  calculateAgeFromDob,
  type NationalIdAnalysis,
};

export type ProfileFormValues = {
  role: "student" | "instructor" | "center" | "guardian";
  fullName?: string;
  email?: string;
  password?: string;
  phone: string;
  nationalId: string;
  dateOfBirth?: string;
  gender?: "male" | "female";
  governorate?: string;
  city?: string;
  educationLevel?: "primary" | "prep" | "secondary" | "baccalaureate" | "university";
  schoolName?: string;
  gradeLevel?: string;
  educationalTrack?: string;
  secondLanguage?: string;
  religion?: string;
  universityName?: string;
  facultyName?: string;
  guardianName?: string;
  guardianRelationship?: "father" | "mother" | "guardian";
  guardianPhone?: string;
  qualification?: string;
  specialization?: string;
  teachingSubject?: string;
  teachingStages?: string[];
  teachingGrades?: string[];
  yearsOfExperience?: number;
  bio?: string;
  studentNationalId?: string;
  institutionName?: string;
  institutionType?: "center" | "college" | "university" | "institute" | "academy";
  address?: string;
  licenseNumber?: string;
  website?: string;
  termsAccepted?: boolean;
};

export function useProfileFormSchema(mode: "register" | "complete_profile") {
  const { t } = useTranslation();

  return useMemo(() => {
    const base = z.object({
        role: z.enum(["student", "instructor", "center", "guardian"]),
        phone: z.string().regex(
          EGYPTIAN_PHONE_REGEX,
          t("auth.validation.phoneInvalid", "رقم الهاتف غير صالح (يجب أن يكون رقم مصري من 11 رقم)"),
        ),
        nationalId: z.string().refine((val) => validateEgyptianNationalId(val).valid, {
          message: t("auth.validation.nationalIdInvalid", "الرقم القومي غير صالح (يتكون من 14 رقم مصري)"),
        }),
        dateOfBirth: z.string().optional(),
        gender: z.enum(["male", "female"]).optional(),
        governorate: z.string().optional(),
        city: z.string().optional(),
        educationLevel: z.enum(["primary", "prep", "secondary", "baccalaureate", "university"]).optional(),
        schoolName: z.string().optional(),
        gradeLevel: z.string().optional(),
        educationalTrack: z.string().optional(),
        secondLanguage: z.string().optional(),
        religion: z.string().optional(),
        universityName: z.string().optional(),
        facultyName: z.string().optional(),
        guardianName: z.string().optional(),
        guardianRelationship: z.enum(["father", "mother", "guardian"]).optional(),
        guardianPhone: z.string().optional(),
        qualification: z.string().optional(),
        specialization: z.string().optional(),
        teachingSubject: z.string().optional(),
        teachingStages: z.array(z.string()).optional(),
        teachingGrades: z.array(z.string()).optional(),
        yearsOfExperience: z.number().optional(),
        bio: z.string().optional(),
        studentNationalId: z.string().optional(),
        institutionName: z.string().optional(),
        institutionType: z.enum(["center", "college", "university", "institute", "academy"]).optional(),
        address: z.string().optional(),
        licenseNumber: z.string().optional(),
        website: z.string().url("رابط الموقع غير صالح").or(z.literal("")).optional(),
        termsAccepted:
          mode === "register"
            ? z.literal(true, {
                errorMap: () => ({
                  message: t("auth.validation.termsRequired", "يجب الموافقة على الشروط والأحكام"),
                }),
              })
            : z.boolean().optional(),
      });

    const schema = mode === "register"
      ? base.extend({
          fullName: z
            .string()
            .min(3, t("auth.validation.fullNameMin", "الاسم الكامل يجب أن يتكون من اسمين على الأقل"))
            .refine((val) => val.trim().split(/\s+/).length >= 2, {
              message: t("auth.validation.fullNameMin", "الاسم الكامل يجب أن يتكون من اسمين على الأقل"),
            }),
          email: z.string().email(t("auth.validation.emailInvalid", "البريد الإلكتروني غير صالح")),
          password: z.string().min(8, t("auth.validation.passwordMin", "كلمة المرور يجب أن لا تقل عن 8 أحرف")),
        })
      : base;

    return schema.superRefine((data, ctx) => {
        if (data.role === "guardian") {
          if (!data.studentNationalId || !validateEgyptianNationalId(data.studentNationalId).valid) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["studentNationalId"],
              message: "الرقم القومي للطالب المراد متابعته مطلوب وصحيح (14 رقم مصري).",
            });
          }
        }

        if (data.role === "center") {
          if (!data.institutionName?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["institutionName"],
              message: "اسم السنتر التعليمي مطلوب.",
            });
          }
          if (!data.institutionType) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["institutionType"],
              message: "نوع المؤسسة التعليمية مطلوب.",
            });
          }
        }
      });
  }, [mode, t]);
}
