import type { ReactNode } from "react";
import { Bell, BookOpen, CalendarClock, CheckCircle2, GraduationCap, RefreshCw, Trophy } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardianDashboard } from "@/features/guardian/hooks";

const formatDate = (value: string | null) => {
  if (!value) return "لم يتم تحديد موعد";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const GuardianDashboard = () => {
  const { data, isLoading, isError, refetch } = useGuardianDashboard();

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
          <div className="h-32 rounded-3xl bg-muted animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((item) => <div key={item} className="h-56 rounded-3xl bg-muted animate-pulse" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="container mx-auto p-6" dir="rtl">
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="font-bold">تعذر تحميل لوحة ولي الأمر.</p>
              <Button onClick={() => refetch()} className="gap-2"><RefreshCw className="w-4 h-4" /> إعادة المحاولة</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const totalCourses = data.children.reduce((sum, child) => sum + child.stats.courses_count, 0);
  const totalAttempts = data.children.reduce((sum, child) => sum + child.stats.exam_attempts, 0);

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
        <section className="rounded-3xl border bg-card/80 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <Badge className="mb-3">لوحة ولي الأمر</Badge>
              <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
                <GraduationCap className="w-8 h-8 text-primary" />
                متابعة أبنائك التعليمية
              </h1>
              <p className="text-muted-foreground mt-2">الدرجات، الاختبارات القادمة، الدورات، والإشعارات في مكان واحد.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 min-w-0">
              <StatCard label="الأبناء" value={data.children.length} />
              <StatCard label="الدورات" value={totalCourses} />
              <StatCard label="المحاولات" value={totalAttempts} />
            </div>
          </div>
        </section>

        {data.children.length === 0 ? (
          <Card><CardContent className="py-14 text-center"><p className="font-bold">لا يوجد طالب مرتبط بحساب ولي الأمر حتى الآن.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {data.children.map((child) => (
              <Card key={child.student.id} className="rounded-3xl overflow-hidden">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-black">{child.student.full_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {child.student.grade_level || child.student.education_level || "المرحلة التعليمية غير محددة"}
                      </div>
                    </div>
                    <Badge variant="outline">متابعة مباشرة</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat icon={<BookOpen className="w-4 h-4" />} label="دورات" value={child.stats.courses_count} />
                    <MiniStat icon={<Trophy className="w-4 h-4" />} label="متوسط الدرجات" value={`${child.stats.average_grade}%`} />
                    <MiniStat icon={<CheckCircle2 className="w-4 h-4" />} label="محاولات" value={child.stats.exam_attempts} />
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold">الاختبارات القادمة</h3>
                    {child.upcoming_exams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">لا توجد اختبارات قادمة مرتبطة بدورات الطالب.</p>
                    ) : child.upcoming_exams.map((exam) => (
                      <div key={exam.id} className="rounded-2xl border p-4 bg-background/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold">{exam.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">{exam.course}</div>
                            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <CalendarClock className="w-3.5 h-3.5" /> {formatDate(exam.start_time)}
                            </div>
                          </div>
                          <Badge>اختبار</Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold">آخر الدرجات</h3>
                    {child.grades.length === 0 ? (
                      <p className="text-sm text-muted-foreground">لا توجد درجات مسجلة بعد.</p>
                    ) : child.grades.slice(0, 5).map((grade) => (
                      <div key={grade.id} className="flex items-center justify-between rounded-2xl border p-3">
                        <div>
                          <div className="font-semibold text-sm">{grade.course}</div>
                          <div className="text-xs text-muted-foreground">{grade.feedback || "لا توجد ملاحظات"}</div>
                        </div>
                        <div className="text-left font-black">{grade.percentage}%</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold">الدورات</h3>
                    {child.courses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">لا توجد دورات مسجلة.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {child.courses.map((course) => <Badge key={course.id} variant="secondary">{course.title}</Badge>)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> الإشعارات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد إشعارات جديدة.</p>
            ) : data.notifications.map((notification) => (
              <div key={notification.id} className={`rounded-2xl border p-4 ${notification.is_read ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{notification.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                  </div>
                  {!notification.is_read && <Badge>جديد</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border bg-background/70 p-3 text-center"><div className="text-xl font-black">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>;
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <div className="rounded-2xl border p-3"><div className="flex items-center gap-1.5 text-primary text-xs font-bold">{icon}{label}</div><div className="text-lg font-black mt-1">{value}</div></div>;
}

export default GuardianDashboard;
