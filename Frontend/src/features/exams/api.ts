import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/http";
import { normalizeExamQuestions, type ImportedExamQuestion } from "./jsonImport";

export interface ExamQuestion {
  id: number;
  text: string;
  imageUrl?: string;
  image_url?: string;
  type: "multiple_choice" | "true_false" | "essay" | "matching" | "fill_blank";
  options?: Array<{ id: number; text: string; isCorrect?: boolean } | string>;
  explanation?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  points?: number;
  order?: number;
  correctAnswerJson?: unknown;
  correct_answer_json?: unknown;
}

export interface Exam {
  id: number;
  title: string;
  description: string;
  durationMinutes?: number;
  duration_minutes?: number;
  totalQuestions?: number;
  total_questions?: number;
  examType?: string;
  exam_type?: string;
  startTime?: string | null;
  start_time?: string | null;
  endTime?: string | null;
  end_time?: string | null;
  maxScore?: number;
  max_score?: number;
  passThreshold?: number;
  pass_threshold?: number;
  isPublished?: boolean;
  is_published?: boolean;
  questions?: ExamQuestion[];
  course?: number | null;
  lesson?: number | null;
  unit?: number | null;
  shuffleQuestions?: boolean;
  shuffle_questions?: boolean;
  tabSwitchLimit?: number;
  tab_switch_limit?: number;
  requireCamera?: boolean;
  require_camera?: boolean;
  quizQuestionCount?: number;
  quiz_question_count?: number;
  maxAttempts?: number;
  max_attempts?: number;
  attemptsAllowed?: number;
  attempts_allowed?: number;
  attemptsUsed?: number;
  attempts_used?: number;
  lockedUntil?: string | null;
  locked_until?: string | null;
  cooldownSecondsRemaining?: number;
  cooldown_seconds_remaining?: number;
  kind?: string;
  educationalStage?: string;
  educational_stage?: string;
  educationalGrade?: string;
  educational_grade?: string;
  educationalTrack?: string;
  educational_track?: string;
  subject?: string;
  subjectBranch?: string;
  subject_branch?: string;
}

export interface ExamSubmission {
  examId: number;
  answers: Record<number, unknown>;
  cheatLogs: string[];
  forcedSubmission: boolean;
}

interface PaginatedResponse<T> {
  data?: T[];
  results?: T[];
}

function normalizeQuestion(question: Record<string, unknown>): ExamQuestion {
  const rawType = String(question.questionType ?? question.question_type ?? question.type ?? "multiple_choice").toLowerCase();
  const type = rawType === "multiple_choice" || rawType === "true_false" || rawType === "essay" || rawType === "matching" || rawType === "fill_blank"
    ? rawType
    : "multiple_choice";

  const rawCorrect = question.correctAnswerJson ?? question.correct_answer_json;
  const correctVal = rawCorrect && typeof rawCorrect === "object"
    ? String(
        (rawCorrect as Record<string, unknown>).correct_option ??
        (rawCorrect as Record<string, unknown>).value ??
        (rawCorrect as Record<string, unknown>).answer ??
        ""
      ).trim().toLowerCase()
    : "";

  const rawOptions = question.optionsJson ?? question.options_json ?? question.options;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((option, index) => {
        if (typeof option === "string") return option;
        if (option && typeof option === "object") {
          const item = option as Record<string, unknown>;
          const text = String(item.text ?? item.label ?? "");
          const isExplicitCorrect = Boolean(item.isCorrect ?? item.is_correct);
          const isMatchCorrect = correctVal && text.trim().toLowerCase() === correctVal;
          return {
            id: Number(item.id ?? index),
            text,
            isCorrect: isExplicitCorrect || Boolean(isMatchCorrect),
          };
        }
        return { id: index, text: String(option ?? ""), isCorrect: false };
      })
    : undefined;

  return {
    id: Number(question.id),
    text: String(question.questionText ?? question.question_text ?? question.text ?? ""),
    imageUrl: String(question.imageUrl ?? question.image_url ?? ""),
    image_url: String(question.image_url ?? question.imageUrl ?? ""),
    type,
    options,
    explanation: typeof question.explanation === "string" ? question.explanation : undefined,
    difficulty: ["EASY", "MEDIUM", "HARD"].includes(String(question.difficulty).toUpperCase())
      ? String(question.difficulty).toUpperCase() as "EASY" | "MEDIUM" | "HARD"
      : "MEDIUM",
    points: question.points == null ? undefined : Number(question.points),
    order: question.order == null ? undefined : Number(question.order),
    correctAnswerJson: rawCorrect,
    correct_answer_json: rawCorrect,
  };
}

function normalizeExam(raw: Record<string, unknown>): Exam {
  const rawQuestions = raw.questions;
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    durationMinutes: raw.durationMinutes == null && raw.duration_minutes == null ? undefined : Number(raw.durationMinutes ?? raw.duration_minutes),
    duration_minutes: raw.duration_minutes == null && raw.durationMinutes == null ? undefined : Number(raw.duration_minutes ?? raw.durationMinutes),
    totalQuestions: raw.totalQuestions == null && raw.total_questions == null ? undefined : Number(raw.totalQuestions ?? raw.total_questions),
    total_questions: raw.total_questions == null && raw.totalQuestions == null ? undefined : Number(raw.total_questions ?? raw.totalQuestions),
    examType: String(raw.examType ?? raw.exam_type ?? ""),
    exam_type: String(raw.exam_type ?? raw.examType ?? ""),
    startTime: (raw.startTime ?? raw.start_time) ? String(raw.startTime ?? raw.start_time) : null,
    start_time: (raw.start_time ?? raw.startTime) ? String(raw.start_time ?? raw.startTime) : null,
    endTime: (raw.endTime ?? raw.end_time) ? String(raw.endTime ?? raw.end_time) : null,
    end_time: (raw.end_time ?? raw.endTime) ? String(raw.end_time ?? raw.endTime) : null,
    maxScore: raw.maxScore == null && raw.max_score == null ? undefined : Number(raw.maxScore ?? raw.max_score),
    max_score: raw.max_score == null && raw.maxScore == null ? undefined : Number(raw.max_score ?? raw.maxScore),
    passThreshold: raw.passThreshold == null && raw.pass_threshold == null ? undefined : Number(raw.passThreshold ?? raw.pass_threshold),
    pass_threshold: raw.pass_threshold == null && raw.passThreshold == null ? undefined : Number(raw.pass_threshold ?? raw.passThreshold),
    isPublished: raw.isPublished == null && raw.is_published == null ? undefined : Boolean(raw.isPublished ?? raw.is_published),
    is_published: raw.is_published == null && raw.isPublished == null ? undefined : Boolean(raw.is_published ?? raw.isPublished),
    course: raw.course == null ? null : Number(raw.course),
    lesson: raw.lesson == null ? null : Number(raw.lesson),
    unit: raw.unit == null ? null : Number(raw.unit),
    shuffleQuestions: Boolean(raw.shuffleQuestions ?? raw.shuffle_questions),
    shuffle_questions: Boolean(raw.shuffle_questions ?? raw.shuffleQuestions),
    tabSwitchLimit: raw.tabSwitchLimit != null || raw.tab_switch_limit != null
      ? Number(raw.tabSwitchLimit ?? raw.tab_switch_limit)
      : undefined,
    tab_switch_limit: raw.tab_switch_limit != null || raw.tabSwitchLimit != null
      ? Number(raw.tab_switch_limit ?? raw.tabSwitchLimit)
      : undefined,
    requireCamera: Boolean(raw.requireCamera ?? raw.require_camera),
    require_camera: Boolean(raw.require_camera ?? raw.requireCamera),
    quizQuestionCount: raw.quizQuestionCount != null || raw.quiz_question_count != null
      ? Number(raw.quizQuestionCount ?? raw.quiz_question_count)
      : undefined,
    quiz_question_count: raw.quiz_question_count != null || raw.quizQuestionCount != null
      ? Number(raw.quiz_question_count ?? raw.quizQuestionCount)
      : undefined,
    kind: String(raw.kind ?? raw.examType ?? raw.exam_type ?? ""),
    attemptsAllowed: raw.attemptsAllowed != null || raw.attempts_allowed != null ? Number(raw.attemptsAllowed ?? raw.attempts_allowed) : undefined,
    attempts_allowed: raw.attempts_allowed != null || raw.attemptsAllowed != null ? Number(raw.attempts_allowed ?? raw.attemptsAllowed) : undefined,
    attemptsUsed: raw.attemptsUsed != null || raw.attempts_used != null ? Number(raw.attemptsUsed ?? raw.attempts_used) : undefined,
    attempts_used: raw.attempts_used != null || raw.attemptsUsed != null ? Number(raw.attempts_used ?? raw.attemptsUsed) : undefined,
    lockedUntil: (raw.lockedUntil ?? raw.locked_until) ? String(raw.lockedUntil ?? raw.locked_until) : null,
    locked_until: (raw.locked_until ?? raw.lockedUntil) ? String(raw.locked_until ?? raw.lockedUntil) : null,
    cooldownSecondsRemaining: raw.cooldownSecondsRemaining != null || raw.cooldown_seconds_remaining != null ? Number(raw.cooldownSecondsRemaining ?? raw.cooldown_seconds_remaining) : 0,
    cooldown_seconds_remaining: raw.cooldown_seconds_remaining != null || raw.cooldownSecondsRemaining != null ? Number(raw.cooldown_seconds_remaining ?? raw.cooldownSecondsRemaining) : 0,
    questions: Array.isArray(rawQuestions)
      ? rawQuestions.filter((q): q is Record<string, unknown> => Boolean(q && typeof q === "object")).map(normalizeQuestion)
      : undefined,
  };
}

function getItems<T>(response: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export async function getExamDetails(examId: number) {
  const response = await apiGet<Record<string, unknown>>(`/exams/${examId}/`);
  return normalizeExam(response);
}

export async function startExam(examId: number) {
  const response = await apiPost<{ sessionToken?: string; session_token?: string; exam?: Record<string, unknown>; attempt?: Record<string, unknown> }>(
    `/exams/${examId}/start/`,
  );
  return {
    sessionToken: response.sessionToken ?? response.session_token ?? "",
    exam: response.exam ? normalizeExam(response.exam) : undefined,
    attempt: response.attempt,
  };
}

export async function submitExam(submission: ExamSubmission) {
  return apiPost<{ score?: number | string; isPassed?: boolean; is_passed?: boolean; passed?: boolean; status?: string }>(
    `/exams/${submission.examId}/submit/`,
    {
      answers: submission.answers,
      tab_switches_count: submission.cheatLogs.length,
      forced_submission: submission.forcedSubmission,
    },
  );
}

export interface ExamFilterParams {
  course?: number | string;
  lesson?: number | string;
  educational_stage?: string;
  educational_grade?: string;
  educational_track?: string;
  subject?: string;
  subject_branch?: string;
  exam_type?: string;
  is_published?: boolean;
  search?: string;
}

export async function getInstructorExams(params?: ExamFilterParams) {
  const query = params
    ? "?" +
      new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : "";
  const response = await apiGet<PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]>(`/exams/${query}`);
  return getItems(response).map(normalizeExam);
}

export async function createExam(examData: Record<string, unknown>) {
  const response = await apiPost<Record<string, unknown>>("/exams/", examData);
  return normalizeExam(response);
}

export async function updateExam(examId: number, examData: Record<string, unknown>) {
  const response = await apiPatch<Record<string, unknown>>(`/exams/${examId}/`, examData);
  return normalizeExam(response);
}

export async function deleteExam(examId: number) {
  return apiDelete(`/exams/${examId}/`);
}

export async function getExamAnalytics(examId: number) {
  return apiGet(`/exams/${examId}/analytics/`);
}

export async function getStudentExams() {
  const response = await apiGet<PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]>("/exams/student/");
  return getItems(response);
}

export async function togglePublishExam(examId: number, isPublished?: boolean) {
  return apiPost<{ id: number; isPublished: boolean; is_published?: boolean }>(
    `/exams/${examId}/publish/`,
    isPublished !== undefined ? { isPublished } : {},
  );
}

export interface QuestionImportRowError {
  row: number;
  field: string;
  message: string;
  question_text?: string;
}

export interface QuestionImportResult {
  is_valid: boolean;
  total_scanned: number;
  valid_count: number;
  error_count: number;
  error_question_count?: number;
  errors: QuestionImportRowError[];
  questions?: any[];
}

export const SAMPLE_QUESTION_BANK_TEMPLATE = [
  {
    question_text: "ما هي وحدة قياس القوة في النظام الدولي للوحدات؟",
    question_type: "multiple_choice",
    difficulty: "MEDIUM",
    points: 5,
    explanation: "وحدة قياس القوة هي النيوتن تكريماً للعالم إسحاق نيوتن.",
    options: [
      { text: "نيوتن", is_correct: true },
      { text: "جول", is_correct: false },
      { text: "باسكال", is_correct: false },
      { text: "واط", is_correct: false },
    ],
    correct_answer: "نيوتن",
    video_timestamp_start: 120,
    video_timestamp_end: 180,
  },
  {
    question_text: "السرعة المتجهة كمية قياسية لا يلزم لتحديدها اتجاه.",
    question_type: "true_false",
    difficulty: "EASY",
    points: 3,
    explanation: "السرعة المتجهة كمية متجهة يلزم لمعرفتها المقدار والاتجاه معاً.",
    options: [
      { text: "صواب", is_correct: false },
      { text: "خطأ", is_correct: true },
    ],
    correct_answer: "خطأ",
  },
  {
    question_text: "اذكر باختصار نص القانون الأول لنيوتن في الحركة.",
    question_type: "essay",
    difficulty: "HARD",
    points: 10,
    explanation: "يبقى الجسم الساكن ساكناً والجسم المتحرك في خط مستقيم بسرعة ثابتة ما لم تؤثر عليه قوة محصلة تغير من حالته.",
    options: [],
    correct_answer: "",
  },
];

export async function downloadQuestionBankTemplate(): Promise<void> {
  try {
    const res = await apiGet<any>("/assessments/questions/template/");
    if (res) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "questions_template.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      return;
    }
  } catch {
    // Fallback: Use client-generated canonical template
  }

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(SAMPLE_QUESTION_BANK_TEMPLATE, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "questions_template.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function validateQuestionsLocally(items: any[]): QuestionImportResult {
  const errors: QuestionImportRowError[] = [];
  let validCount = 0;

  if (!Array.isArray(items)) {
    return {
      is_valid: false,
      total_scanned: 0,
      valid_count: 0,
      error_count: 1,
      errors: [
        {
          row: 1,
          field: "root",
          message: "الملف يجب أن يحتوي على مصفوفة JSON صالحة من الأسئلة (Array).",
        },
      ],
    };
  }

  items.forEach((q, idx) => {
    const row = idx + 1;
    let hasRowError = false;

    if (!q || typeof q !== "object") {
      errors.push({
        row,
        field: "item",
        message: "بيانات السؤال غير صالحة.",
      });
      return;
    }

    const qText = String(q.question_text || q.text || "").trim();
    if (!qText) {
      errors.push({
        row,
        field: "question_text",
        message: "نص السؤال مطلوب ولا يمكن تركه فارغاً.",
        question_text: "سؤال بدون نص",
      });
      hasRowError = true;
    }

    const qType = String(q.question_type || q.type || "multiple_choice").toLowerCase();
    if (!["multiple_choice", "true_false", "essay"].includes(qType)) {
      errors.push({
        row,
        field: "question_type",
        message: `نوع السؤال '${qType}' غير مدعوم (المتاح: multiple_choice, true_false, essay).`,
        question_text: qText,
      });
      hasRowError = true;
    }

    const points = Number(q.points ?? 5);
    if (!Number.isFinite(points) || points <= 0) {
      errors.push({
        row,
        field: "points",
        message: "درجة السؤال يجب أن تكون أكبر من صفر.",
        question_text: qText,
      });
      hasRowError = true;
    }

    if (qType === "multiple_choice") {
      const options = Array.isArray(q.options) ? q.options : [];
      if (options.length < 2) {
        errors.push({
          row,
          field: "options",
          message: "سؤال الاختيار من متعدد يتطلب خيارين على الأقل.",
          question_text: qText,
        });
        hasRowError = true;
      } else {
        const hasCorrect =
          options.some((o: any) => Boolean(o?.is_correct || o?.isCorrect)) ||
          Boolean(q.correct_answer && options.some((o: any) => String(o?.text || o).trim() === String(q.correct_answer).trim()));
        if (!hasCorrect) {
          errors.push({
            row,
            field: "correct_answer",
            message: "الإجابة الصحيحة غير محددة أو غير مطابقة لأي من الاختيارات المتاحة.",
            question_text: qText,
          });
            hasRowError = true;
        }
      }
    } else if (qType === "true_false") {
      const options = Array.isArray(q.options) ? q.options : [];
      const hasCorrect =
        options.some((o: any) => Boolean(o?.is_correct || o?.isCorrect)) ||
        Boolean(q.correct_answer);
      if (!hasCorrect) {
        errors.push({
          row,
          field: "correct_answer",
          message: "يرجى تحديد ما إذا كانت الإجابة صواب أم خطأ.",
          question_text: qText,
        });
        hasRowError = true;
      }
    }

    if (!hasRowError) {
      validCount++;
    }
  });

  return {
    is_valid: errors.length === 0,
    total_scanned: items.length,
    valid_count: validCount,
    error_count: errors.length,
    errors,
    questions: items,
  };
}

function toBackendQuestionPayload(question: ImportedExamQuestion) {
  const correctOption = question.options.find((option) => option.isCorrect)?.text ?? "";

  return {
    question_text: question.text,
    question_type: question.type.toUpperCase(),
    options: question.options.map((option) => option.text),
    correct_answer: correctOption,
    points: Number(question.points),
    difficulty: question.difficulty,
    explanation: question.explanation ?? "",
    ...(question.videoTimestampStart !== undefined
      ? { video_timestamp_start: question.videoTimestampStart }
      : {}),
    ...(question.videoTimestampEnd !== undefined
      ? { video_timestamp_end: question.videoTimestampEnd }
      : {}),
  };
}

async function readAndNormalizeQuestionFile(file: File): Promise<ImportedExamQuestion[]> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    const message = error instanceof SyntaxError ? error.message : "صيغة JSON غير صالحة.";
    throw new Error(`خطأ في صياغة JSON: ${message}`);
  }

  const rawQuestions =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>).questions
        : null;

  return normalizeExamQuestions(rawQuestions);
}

async function normalizeImportInput(
  fileOrQuestions: File | ImportedExamQuestion[],
): Promise<ImportedExamQuestion[]> {
  if (typeof File !== "undefined" && fileOrQuestions instanceof File) {
    return readAndNormalizeQuestionFile(fileOrQuestions);
  }

  return normalizeExamQuestions(fileOrQuestions);
}

export async function dryRunQuestionImport(
  fileOrQuestions: File | any[]
): Promise<QuestionImportResult> {
  const questions = await normalizeImportInput(fileOrQuestions as File | ImportedExamQuestion[]);
  const payload = questions.map(toBackendQuestionPayload);

  return apiPost<QuestionImportResult>("/assessments/questions/import/dry-run/", {
    questions: payload,
  });
}

export async function importQuestions(
  fileOrQuestions: File | any[],
  examId?: number
): Promise<{ success: boolean; count: number; message?: string }> {
  const questions = await normalizeImportInput(fileOrQuestions as File | ImportedExamQuestion[]);
  const payload = questions.map(toBackendQuestionPayload);

  return apiPost("/assessments/questions/import/", {
    questions: payload,
    exam_id: examId,
    dry_run: false,
  });
}
