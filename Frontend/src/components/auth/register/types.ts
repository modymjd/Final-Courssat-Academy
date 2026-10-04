import * as z from "zod";
import { EGYPTIAN_PHONE_REGEX, validateEgyptianNationalId, calculateAgeFromDob } from "./egyptianValidation";

export const buildRegisterSchema = (t: (key: string) => string) =>
  z
    .object({
      role: z.enum(["student", "instructor", "guardian", "center"]),
      fullName: z
        .string()
        .min(3, t("auth.validation.fullNameMin"))
        .refine((val) => val.trim().split(/\s+/).length >= 2, {
          message: t("auth.validation.fullNameMin"),
        }),
      email: z.string().email(t("auth.validation.emailInvalid")),
      phone: z.string().regex(EGYPTIAN_PHONE_REGEX, t("auth.validation.phoneInvalid")),
      nationalId: z.string().refine((val) => validateEgyptianNationalId(val).valid, {
        message: t("auth.validation.nationalIdInvalid"),
      }),
      dateOfBirth: z.string().optional(),
      gender: z.enum(["male", "female"]).optional(),
      governorate: z.string().optional(),
      city: z.string().optional(),
      password: z.string().min(8, t("auth.validation.passwordMin")),
      confirmPassword: z.string(),
      terms: z.boolean().refine((val) => val === true, t("auth.validation.termsRequired")),

      // Student fields
      educationLevel: z.enum(["primary", "prep", "secondary", "baccalaureate", "university"]).optional(),
      schoolName: z.string().optional(),
      gradeLevel: z.string().optional(),
      educationalTrack: z.string().optional(),
      secondLanguage: z.enum(["french", "german", "italian", "spanish", ""]).optional(),
      religion: z.enum(["islamic", "christian", ""]).optional(),
      universityName: z.string().optional(),
      facultyName: z.string().optional(),

      // Guardian fields (When registering as student)
      guardianFullName: z.string().optional(),
      guardianRelationship: z.enum(["father", "mother", "guardian"]).optional(),
      guardianPhone: z.string().optional(),
      guardianNationalId: z.string().optional(),

      // Guardian Role fields (When registering as guardian)
      studentNationalId: z.string().optional(),

      // Instructor fields
      qualification: z.string().optional(),
      specialization: z.string().optional(),
      teachingSubject: z.string().optional(),
      teachingStages: z.array(z.string()).optional(),
      teachingGrades: z.array(z.string()).optional(),
      yearsOfExperience: z.number().optional(),
      bio: z.string().optional(),

      // Center fields
      institutionName: z.string().optional(),
      institutionType: z.enum(["center", "college", "university", "institute", "academy"]).optional(),
      address: z.string().optional(),
      licenseNumber: z.string().optional(),
      website: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: t("auth.validation.passwordMatch"),
        });
      }

      if (data.role === "center") {
        if (!data.institutionName || data.institutionName.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["institutionName"],
            message: "اسم السنتر أو المؤسسة التعليمية مطلوب (حرفين على الأقل).",
          });
        }
      }

      if (data.role === "guardian") {
        if (!data.studentNationalId || !validateEgyptianNationalId(data.studentNationalId).valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["studentNationalId"],
            message: "الرقم القومي الخاص بالطالب مطلوب وصحيح (14 رقم) لربط حساب ولي الأمر.",
          });
        }
      }

      if (data.role === "student") {
        if (["primary", "prep", "secondary", "baccalaureate"].includes(data.educationLevel || "")) {
          if (!data.schoolName || data.schoolName.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["schoolName"],
              message: t("auth.validation.schoolRequired"),
            });
          }
        } else if (data.educationLevel === "university") {
          if (!data.universityName || data.universityName.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["universityName"],
              message: t("auth.validation.universityRequired"),
            });
          }
        }

        // Age check for guardian phone
        const nidResult = validateEgyptianNationalId(data.nationalId);
        const age = calculateAgeFromDob(nidResult.dob || data.dateOfBirth);

        if (age !== null && age < 18) {
          if (!data.guardianPhone || !EGYPTIAN_PHONE_REGEX.test(data.guardianPhone)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["guardianPhone"],
              message: t("auth.validation.guardianPhoneRequired"),
            });
          }
          if (!data.guardianFullName || data.guardianFullName.trim().length < 3) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["guardianFullName"],
              message: t("auth.validation.guardianNameRequired"),
            });
          }
        }

        if (data.guardianPhone && data.guardianPhone.length > 0 && !EGYPTIAN_PHONE_REGEX.test(data.guardianPhone)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["guardianPhone"],
            message: t("auth.validation.phoneInvalid"),
          });
        }
      }
    });

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>;
