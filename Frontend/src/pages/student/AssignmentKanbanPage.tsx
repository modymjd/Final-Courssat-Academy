import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, BookOpen, CheckCircle2, Clock, FileQuestion, Loader2, Search } from "lucide-react";

import { FeatureGate } from "@/components/FeatureGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/http";

type ColumnId = "todo" | "inProgress" | "submitted" | "graded";

interface AssignmentCard {
  id: number;
  title: string;
  description: string;
  courseName: string;
  dueDate: string | null;
  column: ColumnId;
  score: number | null;
  maxScore: number;
  isPassed: boolean;
}

interface ApiPage<T> {
  results?: T[];
  data?: T[];
}

const getItems = <T,>(response: ApiPage<T> | T[]): T[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

const normalizeStatus = (value: unknown): ColumnId => {
  const status = String(value ?? "").toUpperCase();
  if (status === "IN_PROGRESS") return "inProgress";
  if (status === "SUBMITTED") return "submitted";
  if (status === "GRADED") return "graded";
  return "todo";
};

const COLUMNS: { id: ColumnId; title: string; color: string; countColor: string }[] = [
  { id: "todo", title: "مطلوب تنفيذها", color: "border-amber-500/40 bg-amber-500/5", countColor: "bg-amber-500/20 text-amber-700" },
  { id: "inProgress", title: "جاري الحل", color: "border-primary/40 bg-primary/5", countColor: "bg-primary/20 text-primary" },
  { id: "submitted", title: "بانتظار التصحيح", color: "border-blue-500/40 bg-blue-500/5", countColor: "bg-blue-500/20 text-blue-700" },
  { id: "graded", title: "تم التقييم", color: "border-emerald-500/40 bg-emerald-500/5", countColor: "bg-emerald-500/20 text-emerald-700" },
];

export const AssignmentKanbanPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: assignments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["student-question-assignments"],
    queryFn: async (): Promise<AssignmentCard[]> => {
      const [examResponse, attemptResponse] = await Promise.all([
        apiGet<ApiPage<Record<string, unknown>> | Record<string, unknown>[]>(
          "/exams/?exam_type=ASSIGNMENT&is_published=true",
        ),
        apiGet<ApiPage<Record<string, unknown>> | Record<string, unknown>[]>(
          "/exams/student/?latest=true",
        ),
      ]);
      const exams = getItems(examResponse);
      const attempts = getItems(attemptResponse);
      const latestByExam = new Map<number, Record<string, unknown>>();

      attempts.forEach((attempt) => {
        const examId = Number(attempt.exam_id ?? attempt.examId ?? attempt.exam);
        if (!Number.isFinite(examId)) return;
        const current = latestByExam.get(examId);
        const attemptNumber = Number(attempt.attempt_number ?? attempt.attemptNumber ?? 0);
        const currentNumber = Number(current?.attempt_number ?? current?.attemptNumber ?? -1);
        if (!current || attemptNumber > currentNumber) latestByExam.set(examId, attempt);
      });

      return exams.map((exam) => {
        const id = Number(exam.id);
        const attempt = latestByExam.get(id);
        return {
          id,
          title: String(exam.title ?? "واجب"),
          description: String(exam.description ?? ""),
          courseName: String(exam.course_title ?? "واجب عام"),
          dueDate: exam.end_time || exam.endTime ? String(exam.end_time ?? exam.endTime) : null,
          column: attempt ? normalizeStatus(attempt.status) : "todo",
          score: attempt?.score == null ? null : Number(attempt.score),
          maxScore: Number(attempt?.max_score ?? attempt?.maxScore ?? exam.max_score ?? exam.maxScore ?? 100),
          isPassed: Boolean(attempt?.is_passed ?? attempt?.isPassed),
        };
      });
    },
    staleTime: 30_000,
  });

  const filteredAssignments = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ar");
    if (!query) return assignments;
    return assignments.filter(
      (assignment) =>
        assignment.title.toLocaleLowerCase("ar").includes(query) ||
        assignment.courseName.toLocaleLowerCase("ar").includes(query),
    );
  }, [assignments, searchQuery]);

  const actionFor = (assignment: AssignmentCard) => {
    if (assignment.column === "graded") return { label: "عرض النتيجة", to: `/exam/${assignment.id}/result` };
    if (assignment.column === "submitted") return null;
    if (assignment.column === "inProgress") return { label: "متابعة الحل", to: `/exam/${assignment.id}/session` };
    return { label: "بدء الواجب", to: `/exam/${assignment.id}` };
  };

  return (
    <FeatureGate feature="study_planner">
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-primary" />
              الواجبات بنظام الأسئلة
            </h1>
            <p className="text-xs text-muted-foreground mt-1">الواجبات المنشورة وحالة الحل والتصحيح الفعلية.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-2.5" />
              <input
                type="search"
                placeholder="ابحث عن واجب أو دورة..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-muted/50 border border-border/60 rounded-xl py-2 pr-9 pl-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/dashboard")}>العودة</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="min-h-[320px] grid place-items-center text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : isError ? (
          <Card className="p-8 text-center space-y-3">
            <p className="font-bold">تعذر تحميل الواجبات.</p>
            <Button type="button" onClick={() => refetch()}>إعادة المحاولة</Button>
          </Card>
        ) : assignments.length === 0 ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-bold">لا توجد واجبات منشورة حاليًا.</p>
            <p className="text-xs text-muted-foreground mt-1">ستظهر هنا تلقائيًا عند نشر المدرس واجبًا جديدًا.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((column) => {
              const columnAssignments = filteredAssignments.filter((assignment) => assignment.column === column.id);
              return (
                <section key={column.id} className={`p-4 rounded-2xl border ${column.color} space-y-3 min-h-[320px]`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm">{column.title}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${column.countColor}`}>
                      {columnAssignments.length}
                    </span>
                  </div>
                  {columnAssignments.map((assignment) => {
                    const action = actionFor(assignment);
                    return (
                      <Card key={assignment.id} className="p-4 border-border/70 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm leading-snug">{assignment.title}</h3>
                          {assignment.column === "graded" && (
                            <Badge variant={assignment.isPassed ? "secondary" : "destructive"}>
                              {assignment.isPassed ? "ناجح" : "لم يجتز"}
                            </Badge>
                          )}
                        </div>
                        {assignment.description && <p className="text-xs text-muted-foreground line-clamp-2">{assignment.description}</p>}
                        <div className="space-y-1 text-[11px] text-muted-foreground">
                          <p className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-primary" />{assignment.courseName}</p>
                          <p className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {assignment.dueDate
                              ? `آخر موعد: ${new Date(assignment.dueDate).toLocaleString("ar-EG")}`
                              : "بدون موعد تسليم محدد"}
                          </p>
                        </div>
                        {assignment.score !== null && (
                          <div className="flex items-center gap-1.5 text-xs font-bold bg-muted/60 p-2 rounded-lg">
                            <Award className="w-4 h-4 text-primary" />
                            الدرجة: {assignment.score} / {assignment.maxScore}
                          </div>
                        )}
                        {action ? (
                          <Button asChild size="sm" className="w-full rounded-xl">
                            <Link to={action.to}>{action.label}</Link>
                          </Button>
                        ) : (
                          <p className="text-center text-xs text-amber-700 bg-amber-500/10 rounded-lg p-2">
                            تم التسليم وينتظر تصحيح المدرس.
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </FeatureGate>
  );
};

export default AssignmentKanbanPage;