import { z } from "zod";

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "نعم", "صح", "صواب"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "لا", "خطأ", "خطا"].includes(normalized)) return false;
  }
  return false;
}

const optionSchema = z.object({
  text: z.string().trim().min(1, "نص الاختيار مطلوب."),
  isCorrect: z.boolean().optional().default(false),
});

const questionSchema = z
  .object({
    text: z.string().trim().min(1, "نص السؤال مطلوب."),
    imageUrl: z.string().optional().default(""),
    type: z.enum(["multiple_choice", "true_false", "essay"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    points: z.coerce.number().positive("درجة السؤال يجب أن تكون أكبر من صفر."),
    explanation: z.string().optional().default(""),
    options: z.array(optionSchema).default([]),
    videoTimestampStart: z.coerce.number().int().nonnegative().optional(),
    videoTimestampEnd: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "multiple_choice") {
      if (question.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "الاختيار من متعدد يحتاج إلى خيارين على الأقل.",
        });
      }

      const correctCount = question.options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "يجب تحديد إجابة صحيحة واحدة فقط.",
        });
      }
    }

    if (question.type === "true_false") {
      if (question.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "سؤال الصواب والخطأ يجب أن يحتوي على خيارين فقط.",
        });
      }

      const correctCount = question.options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "يجب تحديد إجابة صحيحة واحدة.",
        });
      }
    }
  });

const examEnvelopeSchema = z.object({
  title: z.string().trim().min(2, "عنوان الاختبار مطلوب."),
  description: z.string().optional().default(""),
  examType: z.enum(["EXAM", "PRACTICE", "ASSIGNMENT"]).default("EXAM"),
  durationMinutes: z.coerce.number().positive().default(45),
  questions: z.array(questionSchema).min(1, "يجب أن يحتوي الاختبار على سؤال واحد على الأقل."),
});

export type ImportedExamJson = z.infer<typeof examEnvelopeSchema>;
export type ImportedExamQuestion = z.infer<typeof questionSchema>;

export function normalizeExamQuestions(rawQuestions: unknown): ImportedExamQuestion[] {
  if (!Array.isArray(rawQuestions)) {
    throw new Error("الحقل questions يجب أن يكون مصفوفة.");
  }

  const normalized = rawQuestions.map(normalizeQuestion);
  const result = z.array(questionSchema).min(1, "يجب أن يحتوي الاستيراد على سؤال واحد على الأقل.").safeParse(normalized);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.length ? ` [${firstIssue.path.join(".")}]` : "";
    throw new Error(firstIssue.message + path);
  }

  return result.data;
}

export function normalizeQuestion(raw: unknown, index: number): Record<string, unknown> {
  if (!raw || typeof raw !== "object") {
    throw new Error(`السؤال رقم ${index + 1} ليس كائناً JSON صالحاً.`);
  }

  const item = raw as Record<string, unknown>;
  const rawType = String(
    item.type ?? item.question_type ?? item.questionType ?? "multiple_choice",
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  const type =
    rawType === "true_false" || rawType === "truefalse" || rawType === "tf"
      ? "true_false"
      : rawType === "essay" || rawType === "essay_question"
        ? "essay"
        : "multiple_choice";

  const rawOptionsValue = item.options ?? item.options_json;
  const rawOptions: unknown[] = Array.isArray(rawOptionsValue)
    ? rawOptionsValue
    : [];

  const options = rawOptions.map((option) => {
    if (typeof option === "string") {
      return { text: option, isCorrect: false };
    }

    if (option && typeof option === "object") {
      const source = option as Record<string, unknown>;
      return {
        text: String(source.text ?? source.label ?? "").trim(),
        isCorrect: parseBooleanFlag(source.isCorrect ?? source.is_correct),
      };
    }

    return { text: "", isCorrect: false };
  });

  const rawCorrect =
    item.correct_answer ??
    item.correctAnswer ??
    item.correct_answer_json ??
    item.correctAnswerJson;
  if (rawCorrect != null && options.length > 0 && !options.some((option) => option.isCorrect)) {
    const correctText =
      typeof rawCorrect === "object" && rawCorrect !== null
        ? String(
            (rawCorrect as Record<string, unknown>).correct_option ??
              (rawCorrect as Record<string, unknown>).answer ??
              (rawCorrect as Record<string, unknown>).value ??
              "",
          ).trim().toLowerCase()
        : String(rawCorrect).trim().toLowerCase();

    for (const option of options) {
      if (option.text.toLowerCase() === correctText) {
        option.isCorrect = true;
        break;
      }
    }
  }

  if (type === "true_false" && options.length === 0) {
    const correctText = String(rawCorrect ?? "صواب").trim().toLowerCase();
    options.push(
      { text: "صواب", isCorrect: ["صواب", "صح", "true", "1"].includes(correctText) },
      { text: "خطأ", isCorrect: ["خطأ", "false", "0"].includes(correctText) },
    );
  }

  return {
    text: String(item.text ?? item.question_text ?? item.question ?? "").trim(),
    imageUrl: String(item.imageUrl ?? item.image_url ?? "").trim(),
    type,
    difficulty: String(item.difficulty ?? "MEDIUM").toUpperCase(),
    points: Number(item.points ?? 5),
    explanation: String(item.explanation ?? item.proof ?? "").trim(),
    options,
    videoTimestampStart:
      item.video_timestamp_start == null && item.videoTimestampStart == null
        ? undefined
        : Number(item.video_timestamp_start ?? item.videoTimestampStart),
    videoTimestampEnd:
      item.video_timestamp_end == null && item.videoTimestampEnd == null
        ? undefined
        : Number(item.video_timestamp_end ?? item.videoTimestampEnd),
  };
}

export function parseExamJson(rawText: string): ImportedExamJson {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof SyntaxError ? error.message : "صيغة JSON غير صالحة.";
    throw new Error(`خطأ في صياغة JSON: ${message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("الـ JSON يجب أن يكون كائناً يحتوي على title وquestions.");
  }

  const source = parsed as Record<string, unknown>;
  const questions = normalizeExamQuestions(source.questions);

  const normalized = {
    title: String(source.title ?? "").trim(),
    description: String(source.description ?? "").trim(),
    examType: String(source.examType ?? source.exam_type ?? "EXAM").toUpperCase(),
    durationMinutes: Number(source.durationMinutes ?? source.duration_minutes ?? 45),
    questions,
  };

  const result = examEnvelopeSchema.safeParse(normalized);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.length ? ` [${firstIssue.path.join(".")}]` : "";
    throw new Error(`${firstIssue.message}${path}`);
  }

  return result.data;
}
