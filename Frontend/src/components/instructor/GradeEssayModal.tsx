import React, { useEffect, useMemo, useState } from "react";
import { Award, FileCheck2, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/http";
import { useToast } from "@/components/ui/use-toast";

interface AttemptAnswer {
  id: number;
  question_id?: number;
  questionId?: number;
  question_text?: string;
  questionText?: string;
  question_type?: string;
  questionType?: string;
  student_answer?: unknown;
  studentAnswer?: unknown;
  points_earned?: number;
  pointsEarned?: number;
  max_points?: number;
  maxPoints?: number;
  image_url?: string;
  imageUrl?: string;
}

interface ExamAttempt {
  id: number;
  student_name?: string;
  student_email?: string;
  attempt_number?: number;
  attemptNumber?: number;
  score?: number | string | null;
  status?: string;
  max_score?: number;
  maxScore?: number;
  instructor_feedback?: string;
  instructorFeedback?: string;
  answers?: AttemptAnswer[];
}

interface GradeEssayModalProps {
  examId: number | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GradeEssayModal({ examId, open, onClose, onSuccess }: GradeEssayModalProps) {
  const { toast } = useToast();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === selectedAttemptId) || null,
    [attempts, selectedAttemptId],
  );
  const maxScore = Number(selectedAttempt?.maxScore ?? selectedAttempt?.max_score ?? 100);

  const loadAttempts = async () => {
    if (!examId) return;
    setIsLoading(true);
    try {
      const response = await apiGet<{ results?: ExamAttempt[]; data?: ExamAttempt[] } | ExamAttempt[]>(
        `/exams/${examId}/attempts/`,
      );
      const rows = Array.isArray(response) ? response : response.results || response.data || [];
      setAttempts(rows);
      const firstPending =
        rows.find((attempt) => String(attempt.status || "").toUpperCase() === "SUBMITTED") ||
        rows[0] ||
        null;
      setSelectedAttemptId(firstPending?.id ?? null);
    } catch {
      setAttempts([]);
      toast({
        title: "تعذر تحميل محاولات الطلاب",
        description: "أعد المحاولة بعد التأكد من اتصال الخادم.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && examId) void loadAttempts();
    if (!open) {
      setAttempts([]);
      setSelectedAttemptId(null);
      setScore("");
      setFeedback("");
    }
  }, [open, examId]);

  useEffect(() => {
    if (!selectedAttempt) {
      setScore("");
      setFeedback("");
      return;
    }
    setScore(String(selectedAttempt.score ?? ""));
    setFeedback(selectedAttempt.instructorFeedback ?? selectedAttempt.instructor_feedback ?? "");
  }, [selectedAttempt]);

  const handleSubmitGrade = async () => {
    if (!examId || !selectedAttemptId) return;
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > maxScore) {
      toast({
        title: "درجة غير صالحة",
        description: `أدخل درجة بين 0 و${maxScore}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost(`/exams/${examId}/grade-essay/`, {
        student_exam_id: selectedAttemptId,
        score: numericScore,
        feedback: feedback.trim(),
      });
      toast({
        title: "تم رصد الدرجة",
        description: "حُفظت الدرجة والملاحظات وحُدثت حالة النجاح.",
      });
      onSuccess?.();
      await loadAttempts();
    } catch {
      toast({
        title: "تعذر حفظ الدرجة",
        description: "راجع الدرجة وحالة المحاولة ثم أعد المحاولة.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent size="lg" className="dir-rtl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileCheck2 className="h-6 w-6 text-indigo-600" />
            تصحيح الإجابات المقالية
          </DialogTitle>
          <DialogDescription>
            اختر محاولة الطالب، راجع إجاباته، ثم أدخل الدرجة النهائية للاختبار.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ تحميل المحاولات...
          </div>
        ) : attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            لا توجد محاولات طلاب لهذا الاختبار حتى الآن.
          </div>
        ) : (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">محاولة الطالب</label>
              <select
                value={selectedAttemptId ?? ""}
                onChange={(event) => setSelectedAttemptId(Number(event.target.value))}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {attempts.map((attempt) => (
                  <option key={attempt.id} value={attempt.id}>
                    {attempt.student_name || attempt.student_email || "طالب"} — محاولة{" "}
                    {attempt.attemptNumber ?? attempt.attempt_number ?? 1} —{" "}
                    {String(attempt.status || "").toUpperCase() === "SUBMITTED"
                      ? "بانتظار التصحيح"
                      : "تم التصحيح"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {(selectedAttempt?.answers || []).map((answer, index) => {
                const questionType = String(answer.questionType ?? answer.question_type ?? "").toUpperCase();
                const studentAnswer = answer.studentAnswer ?? answer.student_answer ?? "";
                return (
                  <div key={answer.id} className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="font-bold">
                        {index + 1}. {answer.questionText ?? answer.question_text}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {questionType === "ESSAY" ? "مقالي" : "تصحيح آلي"} —{" "}
                        {answer.pointsEarned ?? answer.points_earned ?? 0}/
                        {answer.maxPoints ?? answer.max_points ?? 0}
                      </span>
                    </div>
                    {(answer.imageUrl || answer.image_url) && (
                      <img
                        src={answer.imageUrl || answer.image_url}
                        alt={`صورة السؤال ${index + 1}`}
                        className="mb-3 max-h-52 rounded-lg border object-contain"
                      />
                    )}
                    <div className="whitespace-pre-wrap rounded-lg bg-background p-3 text-sm">
                      {String(studentAnswer || "لم يكتب الطالب إجابة.")}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-sm font-semibold">
                <span>الدرجة النهائية</span>
                <span className="text-xs font-normal text-muted-foreground">من {maxScore}</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={maxScore}
                  step="0.01"
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  className="pl-12 text-lg font-bold"
                />
                <Award className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">ملاحظات المدرس (اختياري)</label>
              <Textarea
                placeholder="اكتب ملاحظاتك للطالب..."
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button
            onClick={handleSubmitGrade}
            disabled={!selectedAttempt || isSubmitting}
            className="gap-2 bg-indigo-600 font-bold text-white hover:bg-indigo-700"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? "جارٍ الحفظ..." : "حفظ ورصد الدرجة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
