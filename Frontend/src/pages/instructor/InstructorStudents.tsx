import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import {
  Users,
  Search,
  Download,
  Trash2,
  Mail,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  UserX,
  BarChart2,
  Megaphone,
  SendHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useInstructorStudents,
  useInstructorPrivateStudents,
  useRemoveStudentEnrollment,
} from "@/features/instructor/academicToolsHooks";
import { useInstructorCourses } from "@/features/instructor/hooks";
import { CourseAnalyticsModal } from "@/components/instructor/CourseAnalyticsModal";
import { BroadcastModal } from "@/components/instructor/BroadcastModal";
import { ParentReportModal } from "@/components/instructor/ParentReportModal";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("ar-EG");
  } catch {
    return "-";
  }
}

export default function InstructorStudents() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>(undefined);
  const [studentToRemove, setStudentToRemove] = useState<{ id: number; name: string } | null>(null);
  const [analyticsCourseId, setAnalyticsCourseId] = useState<number | null>(null);

  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [parentReportStudent, setParentReportStudent] = useState<{
    id: number;
    name: string;
    reportData?: Record<string, any>;
  } | null>(null);

  const { data: rawCourses = [] } = useInstructorCourses();
  const courses: any[] = Array.isArray(rawCourses) ? rawCourses : (rawCourses as any)?.results || [];

  const {
    data: courseStudents = [],
    isLoading: isLoadingCourse,
    isError: isErrorCourse,
    refetch: refetchCourse,
  } = useInstructorStudents({
    course_id: selectedCourseId,
    search: searchTerm,
  });

  const {
    data: privateStudents = [],
    isLoading: isLoadingPrivate,
    isError: isErrorPrivate,
    refetch: refetchPrivate,
  } = useInstructorPrivateStudents();

  const removeEnrollmentMutation = useRemoveStudentEnrollment();

  const handleConfirmRemove = () => {
    if (!studentToRemove) return;
    removeEnrollmentMutation.mutate(studentToRemove.id, {
      onSuccess: () => {
        toast({ title: "تمت الإزالة", description: `تمت إزالة الطالب ${studentToRemove.name} من الدورة بنجاح.` });
        setStudentToRemove(null);
        refetchCourse();
      },
      onError: () => {
        toast({ title: "خطأ", description: "حدث خطأ أثناء إزالة الطالب. يرجى المحاولة مرة أخرى.", variant: "destructive" });
      },
    });
  };

  const handleExportCSV = () => {
    if (!courseStudents || courseStudents.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد طلاب للتصدير حالياً." });
      return;
    }

    const headers = ["ID", "اسم الطالب", "البريد الإلكتروني", "الدورة", "نسبة التقدم %", "تاريخ التسجيل"];
    const rows = courseStudents.map((s) => [
      s.student_id,
      s.student_name || "غير متوفر",
      s.student_email || "غير متوفر",
      s.course?.title || "غير محدد",
      s.progress ?? 0,
      formatDateSafe(s.enrolled_at),
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 space-y-6 dir-rtl" dir="rtl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20 shadow-sm">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3 text-foreground">
              <Users className="w-8 h-8 text-primary" />
              إدارة الطلاب والمسجلين
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              متابعة تقدم الطلاب المسجلين في دوراتك، التواصل المباشر، وإدارة حالة التسجيل.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => setIsBroadcastOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-sm"
            >
              <Megaphone className="w-4 h-4 text-amber-300" />
              بث إعلان عام
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
          </div>
        </div>

        <Tabs defaultValue="course-students" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="course-students">طلاب الدورات ({courseStudents.length})</TabsTrigger>
            <TabsTrigger value="private-students">الطلاب الخاصين بالأكواد ({privateStudents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="course-students" className="space-y-6">
            {/* Filter Controls */}
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                {/* Search Input */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="البحث باسم الطالب أو البريد الإلكتروني..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 text-sm"
                  />
                </div>

                {/* Course Dropdown Filter */}
                <div className="w-full md:w-64">
                  <select
                    value={selectedCourseId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCourseId(val ? Number(val) : undefined);
                    }}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">جميع الدورات التعليمية</option>
                    {courses.map((course: any) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCourse()}
                  className="gap-2 shrink-0 h-10"
                >
                  <RefreshCw className="w-4 h-4" />
                  تحديث
                </Button>
              </CardContent>
            </Card>

            {/* Main Table Container */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-3 px-6">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                  <span>قائمة الطلاب المسجلين ({courseStudents.length})</span>
                  {isLoadingCourse && <span className="text-sm font-normal text-primary animate-pulse">جاري التحميل...</span>}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                {/* Loading Skeleton State */}
                {isLoadingCourse && (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse w-full" />
                    ))}
                  </div>
                )}

                {/* Error State */}
                {isErrorCourse && !isLoadingCourse && (
                  <div className="p-12 text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                    <h3 className="text-lg font-bold">تعذر تحميل بيانات الطلاب</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      حدث خطأ أثناء جلب قائمة الطلاب. يرجى التحقق من الاتصال وإعادة المحاولة.
                    </p>
                    <Button onClick={() => refetchCourse()} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <RefreshCw className="w-4 h-4" />
                      إعادة المحاولة
                    </Button>
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingCourse && !isErrorCourse && courseStudents.length === 0 && (
                  <div className="p-12 text-center space-y-4">
                    <UserX className="w-16 h-16 text-muted-foreground/40 mx-auto" />
                    <h3 className="text-xl font-bold">لا يوجد طلاب مسجلون حالياً</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      لم يتم العثور على طلاب مطابقين للبحث أو لم يقم أي طالب بالتسجيل بعد.
                    </p>
                  </div>
                )}

                {/* Desktop Table View */}
                {!isLoadingCourse && !isErrorCourse && courseStudents.length > 0 && (
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-right">اسم الطالب</TableHead>
                          <TableHead className="text-right">البريد الإلكتروني</TableHead>
                          <TableHead className="text-right">الدورة المسجل بها</TableHead>
                          <TableHead className="text-right">نسبة الإنجاز</TableHead>
                          <TableHead className="text-right">تاريخ التسجيل</TableHead>
                          <TableHead className="text-center">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courseStudents.map((student) => (
                          <TableRow key={student.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-semibold text-foreground">
                              {student.student_name || `طالب #${student.student_id}`}
                            </TableCell>
                            <TableCell className="text-muted-foreground dir-ltr text-right">
                              {student.student_email || "غير متوفر"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="gap-1 bg-primary/10 text-primary border-primary/30 cursor-pointer hover:bg-primary/20"
                                onClick={() => student.course_id && setAnalyticsCourseId(student.course_id)}
                                title="عرض تحليلات الدورة"
                              >
                                <BookOpen className="w-3 h-3" />
                                {student.course?.title || "دورة تعليمية"}
                              </Badge>
                            </TableCell>
                            <TableCell className="w-48">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold">
                                  <span>{student.progress}%</span>
                                  {student.completed_at ? (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> مكتمل
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> مستمر
                                    </span>
                                  )}
                                </div>
                                <Progress value={student.progress} className="h-2" />
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateSafe(student.enrolled_at)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  title="تحليلات إكمال الدورة"
                                  onClick={() => student.course_id && setAnalyticsCourseId(student.course_id)}
                                >
                                  <BarChart2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                                  title="إرسال رسالة"
                                  onClick={() => toast({ title: "الرسائل", description: `التواصل المباشر مع ${student.student_name} عبر الرسائل متاح قريباً.` })}
                                >
                                  <Mail className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                  title="إرسال تقرير لولي الأمر"
                                  onClick={() =>
                                    setParentReportStudent({
                                      id: student.student_id,
                                      name: student.student_name || `طالب #${student.student_id}`,
                                      reportData: {
                                        course: student.course?.title || "غير محدد",
                                        progress: `${student.progress || 0}%`,
                                        status: student.completed_at ? "مكتمل" : "مستمر",
                                        enrolled_at: formatDateSafe(student.enrolled_at),
                                      },
                                    })
                                  }
                                >
                                  <SendHorizontal className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  title="إزالة الطالب"
                                  onClick={() =>
                                    setStudentToRemove({
                                      id: student.id,
                                      name: student.student_name || `طالب #${student.student_id}`,
                                    })
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Mobile Card View (Zero Horizontal Overflow) */}
                {!isLoadingCourse && !isErrorCourse && courseStudents.length > 0 && (
                  <div className="md:hidden p-4 space-y-3">
                    {courseStudents.map((student) => (
                      <div key={student.id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm">{student.student_name || `طالب #${student.student_id}`}</h4>
                            <p className="text-xs text-muted-foreground dir-ltr text-right">{student.student_email || "غير متوفر"}</p>
                          </div>
                          <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/30">
                            {student.course?.title || "دورة تعليمية"}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">نسبة الإنجاز: {student.progress}%</span>
                            {student.completed_at ? (
                              <span className="text-emerald-600 text-xs flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> مكتمل
                              </span>
                            ) : (
                              <span className="text-amber-600 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" /> مستمر
                              </span>
                            )}
                          </div>
                          <Progress value={student.progress} className="h-1.5" />
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          تاريخ التسجيل: {formatDateSafe(student.enrolled_at)}
                        </p>

                        <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 text-xs text-emerald-600 hover:bg-emerald-50"
                            onClick={() =>
                              setParentReportStudent({
                                id: student.student_id,
                                name: student.student_name || `طالب #${student.student_id}`,
                                reportData: {
                                  course: student.course?.title || "غير محدد",
                                  progress: `${student.progress || 0}%`,
                                  status: student.completed_at ? "مكتمل" : "مستمر",
                                  enrolled_at: formatDateSafe(student.enrolled_at),
                                },
                              })
                            }
                          >
                            <SendHorizontal className="w-3.5 h-3.5 ml-1" />
                            تقرير ولي الأمر
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              setStudentToRemove({
                                id: student.id,
                                name: student.student_name || `طالب #${student.student_id}`,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="private-students" className="space-y-6">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-3 px-6">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                  <span>قائمة الطلاب الخاصين بك ({privateStudents.length})</span>
                  {isLoadingPrivate && <span className="text-sm font-normal text-primary animate-pulse">جاري التحميل...</span>}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingPrivate && (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse w-full" />
                    ))}
                  </div>
                )}

                {isErrorPrivate && !isLoadingPrivate && (
                  <div className="p-12 text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                    <h3 className="text-lg font-bold">تعذر تحميل بيانات الطلاب</h3>
                    <Button onClick={() => refetchPrivate()} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <RefreshCw className="w-4 h-4" />
                      إعادة المحاولة
                    </Button>
                  </div>
                )}

                {!isLoadingPrivate && !isErrorPrivate && privateStudents.length === 0 && (
                  <div className="p-12 text-center space-y-4">
                    <UserX className="w-16 h-16 text-muted-foreground/40 mx-auto" />
                    <h3 className="text-xl font-bold">لا يوجد طلاب خاصين بك حالياً</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      هؤلاء هم الطلاب الذين انضموا إليك مباشرة عبر أكواد التفعيل (انضمام كطالب عام).
                    </p>
                  </div>
                )}

                {!isLoadingPrivate && !isErrorPrivate && privateStudents.length > 0 && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="text-right">اسم الطالب</TableHead>
                            <TableHead className="text-right">البريد الإلكتروني</TableHead>
                            <TableHead className="text-right">تاريخ الانضمام</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {privateStudents.map((student) => (
                            <TableRow key={student.id} className="hover:bg-muted/40 transition-colors">
                              <TableCell className="font-semibold text-foreground">
                                {student.student_name || `طالب #${student.student_id}`}
                              </TableCell>
                              <TableCell className="text-muted-foreground dir-ltr text-right">
                                {student.student_email || "غير متوفر"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDateSafe(student.joined_at)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={student.is_active ? "default" : "secondary"}>
                                  {student.is_active ? "نشط" : "غير نشط"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden p-4 space-y-3">
                      {privateStudents.map((student) => (
                        <div key={student.id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">{student.student_name || `طالب #${student.student_id}`}</h4>
                            <Badge variant={student.is_active ? "default" : "secondary"}>
                              {student.is_active ? "نشط" : "غير نشط"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground dir-ltr text-right">{student.student_email || "غير متوفر"}</p>
                          <p className="text-[11px] text-muted-foreground">تاريخ الانضمام: {formatDateSafe(student.joined_at)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirm Remove Dialog */}
        <Dialog open={!!studentToRemove} onOpenChange={() => setStudentToRemove(null)}>
          <DialogContent size="sm" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                تأكيد إزالة الطالب من الدورة
              </DialogTitle>
              <DialogDescription className="pt-2 text-muted-foreground">
                هل أنت متأكد من أنك تريد إزالة الطالب <strong>{studentToRemove?.name}</strong> من الدورة التعليمية؟ لن يتمكن الطالب من الوصول لمحتوى الدورة بعد الإزالة.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setStudentToRemove(null)}>
                إلغاء
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmRemove}
                disabled={removeEnrollmentMutation.isPending}
              >
                {removeEnrollmentMutation.isPending ? "جاري الإزالة..." : "إزالة الطالب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Course Analytics Modal */}
        <CourseAnalyticsModal
          courseId={analyticsCourseId}
          isOpen={!!analyticsCourseId}
          onClose={() => setAnalyticsCourseId(null)}
        />

        {/* Broadcast Announcement Modal */}
        <BroadcastModal
          isOpen={isBroadcastOpen}
          onClose={() => setIsBroadcastOpen(false)}
        />

        {/* Parent Report Modal */}
        <ParentReportModal
          studentId={parentReportStudent?.id || null}
          studentName={parentReportStudent?.name}
          reportData={parentReportStudent?.reportData}
          isOpen={!!parentReportStudent}
          onClose={() => setParentReportStudent(null)}
        />
      </div>
    </Layout>
  );
}
