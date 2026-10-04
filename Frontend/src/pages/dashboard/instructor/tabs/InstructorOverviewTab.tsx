import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Video,
  AlertTriangle,
  GraduationCap,
  ClipboardList,
  ArrowLeft,
  Calendar,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Users,
  FileText,
  KeyRound,
  DollarSign,
} from "lucide-react";
import type { InstructorDailyBrief } from "@/types";

interface InstructorOverviewTabProps {
  brief: InstructorDailyBrief | null;
}

export const InstructorOverviewTab: React.FC<InstructorOverviewTabProps> = ({ brief }) => {
  const morning_brief = brief?.morning_brief;
  const todaySessions = morning_brief?.today_sessions ?? [];
  const atRiskAlerts = morning_brief?.at_risk_alerts ?? [];
  const urgentTasks = morning_brief?.urgent_tasks ?? [];
  const pendingGradingCount = morning_brief?.pending_grading_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Notice / Highlight Bar for Pending Grading */}
      {pendingGradingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent rounded-2xl overflow-hidden shadow-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-amber-500/20 text-amber-600 rounded-2xl shrink-0">
                  <GraduationCap size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-foreground">
                      أوراق وامتحانات تنتظر تقييمك
                    </h3>
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px] font-bold">
                      {pendingGradingCount} ورقة معلقة
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الطلاب بانتظار تصحيح إجاباتهم وملاحظاتك الأكاديمية لمواصلة مسارهم التعليمي.
                  </p>
                </div>
              </div>

              <Button
                asChild
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shrink-0 self-start sm:self-auto gap-1.5"
              >
                <Link to="/instructor/exams">
                  <span>ابدأ التصحيح الآن</span>
                  <ArrowLeft size={16} />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main 3-Column Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Today's Live Sessions */}
        <Card className="border-border/60 rounded-3xl overflow-hidden shadow-sm bg-card">
          <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Video size={18} className="text-primary" />
                <span>جلسات اليوم المباشرة</span>
              </span>
              <Badge variant="outline" className="text-[11px] font-bold rounded-lg">
                {todaySessions.length} {todaySessions.length === 1 ? "جلسة" : "جلسات"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {todaySessions.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <Calendar size={22} />
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  لا توجد جلسات مباشرة مجدولة لليوم
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  يمكنك جدولة حصة تفاعلية جديدة من صفحة الكورس
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3.5 bg-muted/30 hover:bg-muted/50 transition-colors rounded-2xl border border-border/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-foreground leading-snug">
                          {session.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {session.course_title}
                        </p>
                      </div>
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30 shrink-0">
                        {session.status || "قادمة"}
                      </Badge>
                    </div>

                    {session.meeting_url && (
                      <Button
                        size="sm"
                        className="w-full text-xs font-bold rounded-xl gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                        asChild
                      >
                        <a href={session.meeting_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          <span>انضم للبث المباشر</span>
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: At-Risk Alerts Center */}
        <Card className="border-red-500/25 rounded-3xl overflow-hidden shadow-sm bg-card">
          <CardHeader className="pb-3 bg-red-500/5 border-b border-red-500/15">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between text-red-600 dark:text-red-400">
              <span className="flex items-center gap-2">
                <AlertTriangle size={18} />
                <span>رصد الطلاب المعرضين للخطر</span>
              </span>
              <Badge variant="outline" className="text-[11px] border-red-500/30 text-red-600 rounded-lg">
                {atRiskAlerts.length} تنبيه
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {atRiskAlerts.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-xs font-bold text-foreground">
                  جميع الطلاب يسيرون بمعدل ممتاز! 👏
                </p>
                <p className="text-[11px] text-muted-foreground">
                  لا توجد انقطاعات أو انخفاضات حرجة في درجات الطلاب حالياً
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3.5 bg-red-500/5 hover:bg-red-500/10 transition-colors rounded-2xl border border-red-500/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                        {alert.student_name}
                      </h4>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                        {alert.course_title}
                      </span>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-normal">
                      {alert.reason}
                    </p>
                    <div className="pt-1 flex justify-end">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-500/15 p-0 px-2"
                      >
                        <Link to="/instructor/students">
                          <span>متابعة الطالب</span>
                          <ArrowLeft size={12} className="mr-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Urgent Tasks */}
        <Card className="border-border/60 rounded-3xl overflow-hidden shadow-sm bg-card">
          <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList size={18} className="text-primary" />
                <span>المهام الأكاديمية العاجلة</span>
              </span>
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs text-primary font-bold">
                <Link to="/instructor/tasks" className="flex items-center gap-1">
                  <span>منظم المهام</span>
                  <ArrowLeft size={13} />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {urgentTasks.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <CheckCircle2 size={22} />
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  لا توجد مهام عاجلة قيد الانتظار
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  يمكنك إضافة وتخطيط مهام أسبوعك من جدول الكانبان
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-muted/30 hover:bg-muted/50 transition-colors rounded-2xl border border-border/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {task.title}
                      </h4>
                      {task.course_title && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {task.course_title}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 font-bold bg-primary/10 text-primary border-primary/20 rounded-md"
                    >
                      {task.priority || "عاجل"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Direct Operations Gateway Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
        <Link
          to="/instructor/courses"
          className="p-4 rounded-2xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-md transition-all group flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
            <FileText size={20} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">إدارة الكورسات</h4>
            <p className="text-[11px] text-muted-foreground">تعديل الدروس والوسائط</p>
          </div>
        </Link>

        <Link
          to="/instructor/exams"
          className="p-4 rounded-2xl bg-card border border-border/70 hover:border-indigo-500/40 hover:shadow-md transition-all group flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:scale-105 transition-transform">
            <GraduationCap size={20} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">بنك الامتحانات</h4>
            <p className="text-[11px] text-muted-foreground">تصحيح ومتابعة النتائج</p>
          </div>
        </Link>

        <Link
          to="/instructor/activation-codes"
          className="p-4 rounded-2xl bg-card border border-border/70 hover:border-amber-500/40 hover:shadow-md transition-all group flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
            <KeyRound size={20} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">أكواد التفعيل</h4>
            <p className="text-[11px] text-muted-foreground">كروت السناتر والطلاب</p>
          </div>
        </Link>

        <Link
          to="/instructor/earnings"
          className="p-4 rounded-2xl bg-card border border-border/70 hover:border-emerald-500/40 hover:shadow-md transition-all group flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
            <DollarSign size={20} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">المحفظة والأرباح</h4>
            <p className="text-[11px] text-muted-foreground">طلب سحب الإيرادات</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default InstructorOverviewTab;
