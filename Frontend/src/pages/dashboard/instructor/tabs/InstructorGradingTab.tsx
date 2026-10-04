import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useInstructorGrades, useInstructorStudents } from "@/features/instructor";
import { useInstructorExams } from "@/features/exams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  Users,
  Search,
  ArrowLeft,
  FileCheck,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { Grade } from "@/types";

export const InstructorGradingTab: React.FC = () => {
  const { data: rawGrades, isLoading: isGradesLoading } = useInstructorGrades();
  const { data: rawStudents, isLoading: isStudentsLoading } = useInstructorStudents();
  const { data: rawExams } = useInstructorExams();
  const [studentSearch, setStudentSearch] = useState("");

  const grades: Grade[] = useMemo(() => {
    if (!rawGrades) return [];
    return Array.isArray(rawGrades) ? rawGrades : [];
  }, [rawGrades]);

  const students = useMemo(() => {
    if (!rawStudents) return [];
    return Array.isArray(rawStudents) ? rawStudents : [];
  }, [rawStudents]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 8);
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        (s.student_name || "").toLowerCase().includes(q) ||
        (s.student_email || "").toLowerCase().includes(q) ||
        (s.course?.title || "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const exams = useMemo(() => {
    if (!rawExams) return [];
    return Array.isArray(rawExams) ? rawExams : [];
  }, [rawExams]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-card p-4 sm:p-5 rounded-3xl border border-border/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="text-primary" size={22} />
            <span>منظومة التقييم ورصد تقدم الطلاب</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة إجابات الطلاب المعلقة، رصد الدرجات، ومراقبة نسب الإنجاز ومعدلات التعثر
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            asChild
            variant="outline"
            className="rounded-2xl text-xs font-bold border-border/80 bg-muted/20 hover:bg-muted/40 gap-1.5"
          >
            <Link to="/instructor/grades">
              <FileCheck size={15} className="text-primary" />
              <span>سجل الدرجات</span>
            </Link>
          </Button>

          <Button
            asChild
            className="gradient-cta text-white font-bold text-xs rounded-2xl gap-1.5 shadow-sm"
          >
            <Link to="/instructor/exams">
              <FileText size={15} />
              <span>إدارة الامتحانات والتصحيح</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Dual-Zone Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Zone 1: Pending & Recent Grading Submissions (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-3xl border-border/70 bg-card overflow-hidden shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileCheck size={18} className="text-indigo-500" />
                  <span>أوراق وتقييمات الطلاب</span>
                </span>
                <Badge variant="outline" className="text-[11px] font-bold">
                  {grades.length} تسليمات
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {isGradesLoading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : grades.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">لا توجد تسليمات جديدة معلقة</h4>
                  <p className="text-[11px] text-muted-foreground">
                    تم تقييم كافة الإجابات بنجاح، يمكنك مراجعة بنك الأسئلة أو إضافة امتحانات جديدة
                  </p>
                  <div className="pt-2">
                    <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold">
                      <Link to="/instructor/exams/builder">إنشاء اختبار جديد</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {grades.slice(0, 6).map((grade) => (
                    <div
                      key={grade.id}
                      className="p-3 bg-muted/25 hover:bg-muted/40 transition-colors rounded-2xl border border-border/40 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                            {(grade as any).studentName || "طالب"}
                          </h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {grade.assignmentTitle || "اختبار دوري"} • {grade.courseName}
                        </p>
                      </div>

                      <div className="text-left shrink-0">
                        <Badge
                          variant="outline"
                          className="text-xs font-bold bg-primary/10 text-primary border-primary/25 rounded-lg"
                        >
                          {grade.score} / {grade.maxScore || 100}
                        </Badge>
                      </div>
                    </div>
                  ))}

                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-xl mt-2"
                  >
                    <Link to="/instructor/exams" className="flex items-center justify-center gap-1">
                      <span>عرض وتصحيح كافة الاختبارات</span>
                      <ArrowLeft size={13} />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Active Exams Overview */}
          <Card className="rounded-3xl border-border/70 bg-card overflow-hidden shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
              <CardTitle className="text-xs sm:text-sm font-bold flex items-center justify-between">
                <span>الامتحانات النشطة بالكورسات</span>
                <Link to="/instructor/exams" className="text-xs text-primary hover:underline font-semibold">
                  الكل
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 divide-y divide-border/40">
              {exams.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  لا توجد اختبارات منشورة حالياً
                </p>
              ) : (
                exams.slice(0, 3).map((exam: any) => (
                  <div key={exam.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{exam.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {exam.question_count || exam.total_questions || 0} أسئلة • {exam.duration_minutes || 60} دقيقة
                      </p>
                    </div>
                    <Badge
                      className={`text-[9px] font-bold ${
                        exam.is_published
                          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                      }`}
                    >
                      {exam.is_published ? "منشور" : "مسودة"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Zone 2: Student Progress & At-Risk Radar (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-3xl border-border/70 bg-card overflow-hidden shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  <span>رصد تقدم الطلاب المسجلين</span>
                </CardTitle>

                <div className="relative w-full sm:w-48">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="بحث عن طالب..."
                    className="pr-8 h-8 rounded-xl bg-background text-xs border-border/70 focus-visible:ring-primary"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {isStudentsLoading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-xs text-muted-foreground">لم يتم العثور على طلاب مسجلين</p>
                  <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold">
                    <Link to="/instructor/students">فتح إدارة الطلاب</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudents.map((student) => {
                    const progress = Number(student.progress || 0);
                    const isAtRisk = progress < 15;

                    return (
                      <div
                        key={student.id}
                        className="p-3 sm:p-4 rounded-2xl bg-muted/25 hover:bg-muted/40 transition-colors border border-border/40 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                              {student.student_name || "طالب"}
                            </h4>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {student.course?.title || "دورة تعليمية"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isAtRisk ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 font-bold"
                              >
                                متعثر
                              </Badge>
                            ) : progress >= 100 ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold"
                              >
                                أتم الكورس
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold"
                              >
                                قيد التقدم
                              </Badge>
                            )}

                            <span className="text-xs font-extrabold text-foreground min-w-[2.5rem] text-left">
                              {progress}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <Progress
                          value={progress}
                          className="h-2 rounded-full bg-muted"
                        />
                      </div>
                    );
                  })}

                  <div className="pt-2 flex justify-between items-center text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      إجمالي المعروض: {filteredStudents.length} طالب
                    </span>
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-xs font-bold text-primary gap-1"
                    >
                      <Link to="/instructor/students">
                        <span>دليل الطلاب الكامل وتتبع الغياب</span>
                        <ArrowLeft size={13} />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstructorGradingTab;
