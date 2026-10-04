import React from "react";
import {
  BarChart3,
  TrendingUp,
  KeyRound,
  Users,
  Calendar,
  CheckCircle2,
  PieChart,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCenterReports } from "@/features/center";

export default function CenterReports() {
  const { data: reports, isLoading, isError } = useCenterReports();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-28 w-full rounded-2xl bg-slate-900" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
        </div>
      </div>
    );
  }

  if (isError || !reports) {
    return (
      <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-8 text-center text-white">
        <h2 className="text-xl font-bold">تعذر تحميل التقارير الأكاديمية</h2>
        <p className="text-red-200 text-sm mt-2">يرجى إعادة المحاولة لاحقاً.</p>
      </div>
    );
  }

  const generated_codes = Number(reports?.generated_codes ?? (reports as any)?.generatedCodes ?? 0);
  const redeemed_codes = Number(reports?.redeemed_codes ?? (reports as any)?.redeemedCodes ?? 0);
  const usage_rate = Number(reports?.usage_rate ?? (reports as any)?.usageRate ?? (generated_codes > 0 ? Math.round((redeemed_codes / generated_codes) * 100) : 0));
  const total_students = Number(reports?.total_students ?? (reports as any)?.totalStudents ?? 0);
  const timeline = Array.isArray(reports?.timeline) ? reports.timeline : [];
  const subjects = Array.isArray(reports?.subjects) ? reports.subjects : [];
  const maxRedeemedInTimeline = timeline.length > 0 ? Math.max(...timeline.map((t) => Number(t.redeemed || 0)), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            تقارير ومؤشرات السنتر
          </h1>
          <p className="text-blue-200/80 mt-1 text-sm">
            تحليل حركة استخدام الأكواد، معدلات التفعيل اليومية، والنمو الأكاديمي الشامل.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-950/60 border-blue-800 text-blue-300 text-xs py-1 px-3">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" />
            تقارير خصوصية المعلمين مشفرة
          </Badge>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">إجمالي طلاب السنتر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white font-mono">{total_students}</div>
            <p className="text-xs text-slate-400 mt-1">الطلاب النشطون المسجلون بكافة الدورات</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">معدل تفعيل الأكواد (Usage Rate)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-400 font-mono">{usage_rate}%</div>
            <p className="text-xs text-slate-400 mt-1">
              تم تفعيل {redeemed_codes} من أصل {generated_codes} كود
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">الأكواد الجاهزة للتفعيل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-400 font-mono">
              {Math.max(0, generated_codes - redeemed_codes)}
            </div>
            <p className="text-xs text-slate-400 mt-1">أكواد مطبوعة مع الطلاب بانتظار التفعيل</p>
          </CardContent>
        </Card>
      </div>

      {/* 14-Day Timeline Chart */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            حركة تفعيل الأكواد خلال آخر 14 يوماً
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            عدد الطلاب الذين قاموا بتفعيل أكواد السنتر يومياً
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-800">
            {timeline.map((item, idx) => {
              const heightPercent = (item.redeemed / maxRedeemedInTimeline) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition">
                    {item.redeemed}
                  </div>
                  <div
                    style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-indigo-400 transition"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">{item.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subjects Distribution (Preserves individual teacher anonymity) */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            توزيع المواد الدراسية بالمركز
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            توزيع التخصصات والمقررات بالسنتر مع الالتزام التام بخصوصية المعلمين
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              لم يتم تسجيل مواد حتى الآن.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map((sub, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{sub.subject}</div>
                      <div className="text-[11px] text-slate-400">مقرر نشط بالمركز</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs bg-slate-900 text-slate-300 border-slate-700 font-mono">
                    {sub.count} مدرس
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
