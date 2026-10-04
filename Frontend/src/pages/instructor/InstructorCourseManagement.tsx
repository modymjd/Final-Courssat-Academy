import React from "react";
import Layout from "@/components/layout/Layout";
import { useInstructorCourses, useDeleteInstructorCourse } from "@/features/instructor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Users, Star, BookOpen, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const InstructorCourseManagement: React.FC = () => {
  const { data: courses, isLoading } = useInstructorCourses();
  const { mutate: deleteCourse, isPending: isDeleting } = useDeleteInstructorCourse();
  const { toast } = useToast();

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`هل أنت متأكد من حذف دورة "${title}" نهائياً؟`)) {
      deleteCourse(id, {
        onSuccess: () => {
          toast({ title: "تم الحذف بنجاح", description: `تم حذف دورة "${title}".` });
        },
        onError: () => {
          toast({ title: "تعذر الحذف", description: "حدث خطأ أثناء محاولة حذف الدورة.", variant: "destructive" });
        },
      });
    }
  };

  const courseList = Array.isArray(courses) ? courses : [];

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 space-y-6 dir-rtl max-w-6xl" dir="rtl">
        {/* Unified Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-foreground">
              <BookOpen className="text-primary w-7 h-7" />
              إدارة دوراتي ومحاضراتي
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              تابع دوراتك المسجلة، نشر المحاضرات، وتعديل المناهج والأسعار.
            </p>
          </div>
          <Button asChild className="gap-2 font-bold shadow-md shadow-primary/20 rounded-xl h-11 px-5">
            <Link to="/instructor/courses/new">
              <Plus size={18} />
              إضافة دورة جديدة
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded-2xl" />
        ) : courseList.length === 0 ? (
          <div className="text-center py-16 bg-card border border-dashed border-border/80 rounded-2xl p-8">
            <BookOpen size={48} className="mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-bold mb-1">لا توجد لديك دورات حالياً</h3>
            <p className="text-muted-foreground text-xs sm:text-sm mb-6 max-w-md mx-auto">
              ابدأ الآن بإنشاء أول دورة تدريبية لك، وأضف الدروس والفيديوهات والملخصات لطلابك.
            </p>
            <Button asChild className="gap-2 font-bold rounded-xl">
              <Link to="/instructor/courses/new">
                <Plus size={16} />
                إنشاء أول دورة
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block border border-border/70 rounded-2xl overflow-hidden bg-card shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">عنوان الدورة</TableHead>
                    <TableHead className="font-bold">الحالة</TableHead>
                    <TableHead className="font-bold">السعر</TableHead>
                    <TableHead className="font-bold">الطلاب</TableHead>
                    <TableHead className="font-bold">التقييم</TableHead>
                    <TableHead className="font-bold text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseList.map((course) => (
                    <TableRow key={course.id} className="hover:bg-muted/25 transition-colors">
                      <TableCell className="font-bold max-w-[280px]">
                        <Link
                          to={`/course/${course.id}`}
                          className="hover:text-primary hover:underline line-clamp-2"
                          title={course.title}
                        >
                          {course.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={course.status === "published" ? "default" : "secondary"}
                          className="rounded-lg font-semibold text-xs"
                        >
                          {course.status === "published" ? "منشور للطلاب ✓" : "مسودة خاصة 🔒"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-sm">
                        {course.isFree ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                            مجاني
                          </Badge>
                        ) : (
                          formatCurrency(course.price)
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
                          <Users size={14} className="text-primary" />
                          <span>{course.studentCount || 0} طالب</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs font-semibold">
                          <Star size={14} className="text-amber-500 fill-amber-500" />
                          <span>{course.rating || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl text-xs font-bold" title="معاينة">
                            <Link to={`/course/${course.id}`} target="_blank">
                              <Eye size={14} />
                              معاينة
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl text-xs font-bold" title="تعديل">
                            <Link to={`/instructor/courses/${course.id}/builder`}>
                              <Edit size={14} />
                              تعديل
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(course.id, course.title)}
                            disabled={isDeleting}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View (Zero Horizontal Overflow, 44px+ touch targets) */}
            <div className="md:hidden space-y-3">
              {courseList.map((course) => (
                <div
                  key={course.id}
                  className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/course/${course.id}`}
                      className="font-black text-sm text-foreground hover:text-primary leading-snug line-clamp-2"
                    >
                      {course.title}
                    </Link>
                    <Badge
                      variant={course.status === "published" ? "default" : "secondary"}
                      className="shrink-0 text-[11px] rounded-lg font-bold"
                    >
                      {course.status === "published" ? "منشور" : "مسودة"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-semibold">
                        <Users size={14} className="text-primary" />
                        {course.studentCount || 0} طالب
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        <Star size={14} className="text-amber-500 fill-amber-500" />
                        {course.rating || 0}
                      </span>
                    </div>
                    <span className="font-black text-foreground text-sm">
                      {course.isFree ? (
                        <span className="text-emerald-600 font-bold">مجاني</span>
                      ) : (
                        formatCurrency(course.price)
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                    <Button variant="outline" size="sm" asChild className="h-10 rounded-xl font-bold text-xs gap-1">
                      <Link to={`/course/${course.id}`} target="_blank">
                        <Eye size={14} />
                        معاينة
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="h-10 rounded-xl font-bold text-xs gap-1">
                      <Link to={`/instructor/courses/${course.id}/builder`}>
                        <Edit size={14} />
                        تعديل
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(course.id, course.title)}
                      disabled={isDeleting}
                      className="h-10 rounded-xl font-bold text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={15} />
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default InstructorCourseManagement;
