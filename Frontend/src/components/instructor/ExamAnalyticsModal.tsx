import React, { useState, useEffect } from "react";
import {
  Award,
  Users,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  FileQuestion,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/http";

export interface MissedQuestion {
  question_id: number;
  question_text: string;
  question_type: string;
  total_answers: number;
  incorrect_count: number;
  error_rate_percent: number;
  explanation: string;
}

export interface ExamAnalyticsData {
  exam_id: number;
  exam_title: string;
  total_attempts: number;
  students_attempted: number;
  graded_attempts_count: number;
  average_score: number;
  max_score: number;
  average_tab_switches: number;
  most_missed_questions?: MissedQuestion[];
}

interface ExamAnalyticsModalProps {
  examId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExamAnalyticsModal({ examId, isOpen, onClose }: ExamAnalyticsModalProps) {
  const [analytics, setAnalytics] = useState<ExamAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    if (!examId || !isOpen) return;
    setIsLoading(true);
    setIsError(false);
    apiGet<ExamAnalyticsData>(`/exams/${examId}/analytics/`)
      .then((res) => {
        setAnalytics(res ?? null);
      })
      .catch(() => {
        setIsError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [examId, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent size="xl" className="dir-rtl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            تحليلات نتائج الطلاب والأسئلة الأكثر خطأً
          </DialogTitle>
          <DialogDescription>
            {analytics?.exam_title || "مؤشرات تقييم أداء الطلاب وأكثر 20 سؤالاً أخطأ فيها الطلاب"}
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 space-y-4">
            <div className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
            <div className="h-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold">تعذر تحميل تحليلات هذا الاختبار حالياً</p>
            <Button size="sm" onClick={() => onClose()} variant="outline">
              إغلاق
            </Button>
          </div>
        )}

        {/* Main Analytics Content */}
        {!isLoading && !isError && analytics && (
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 py-2 custom-scrollbar">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <Card className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900">
                <CardContent className="p-0">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1">
                    <Users className="w-4 h-4" /> عدد الطلاب الممتحنين
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                    {analytics.students_attempted || analytics.total_attempts} طالب
                  </h3>
                </CardContent>
              </Card>

              <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900">
                <CardContent className="p-0">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <Award className="w-4 h-4" /> متوسط تقييم ودرجات الطلاب
                  </p>
                  <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {analytics.average_score} / {analytics.max_score}
                  </h3>
                </CardContent>
              </Card>

              <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                <CardContent className="p-0">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                    <ShieldAlert className="w-4 h-4" /> متوسط مخالفات الشاشة
                  </p>
                  <h3 className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                    {analytics.average_tab_switches} مرات
                  </h3>
                </CardContent>
              </Card>
            </div>

            {/* Top 20 Most Missed Questions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-base font-extrabold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <FileQuestion className="w-5 h-5 text-indigo-600" />
                  أكثر الأسئلة التي أخطأ فيها الطلاب (أعلى 20 سؤال)
                </h4>
                <Badge variant="outline" className="text-xs font-bold">
                  {analytics.most_missed_questions?.length || 0} سؤال
                </Badge>
              </div>

              {!analytics.most_missed_questions || analytics.most_missed_questions.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl text-center text-xs text-muted-foreground">
                  لا توجد سجلات أخطاء مسجلة للأسئلة في هذا الاختبار حتى الآن.
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.most_missed_questions.map((item, idx) => (
                    <div
                      key={item.question_id || idx}
                      className="p-4 rounded-xl border bg-slate-50/60 dark:bg-slate-900/60 space-y-2 border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-indigo-600 text-sm">{idx + 1}.</span>
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {item.question_text}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs whitespace-nowrap">
                          نسبة الخطأ: {item.error_rate_percent}%
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-4 pt-1">
                        <span>إجمالي الإجابات: {item.total_answers}</span>
                        <span className="text-rose-600 font-bold">الإجابات الخاطئة: {item.incorrect_count}</span>
                      </div>

                      {/* Scientific Proof / Explanation */}
                      <div className="mt-2 p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900 text-xs">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> البرهان والتفسير العلمي للإجابة:
                        </span>
                        <p className="text-emerald-900 dark:text-emerald-200 leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
