import React from "react";
import { Link } from "react-router-dom";
import {
  Users,
  KeyRound,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  PlusCircle,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCenterOverview } from "@/features/center";

export default function CenterOverview() {
  const { data: overview, isLoading, isError, refetch } = useCenterOverview();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-28 w-full rounded-2xl bg-slate-900" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
          <Skeleton className="h-32 rounded-xl bg-slate-900" />
        </div>
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">تعذر تحميل بيانات لوحة السنتر</h2>
        <p className="text-red-200 text-sm">حدث خطأ أثناء جلب مؤشرات الأداء، يرجى المحاولة مرة أخرى.</p>
        <Button onClick={() => refetch()} variant="outline" className="border-red-700 text-red-300">
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const center_info = overview?.center_info || (overview as any)?.centerInfo || {};
  const kpis = overview?.kpis || {};
  const subscription = overview?.subscription || {};
  const onboarding = overview?.onboarding || {};
  const activity_feed = overview?.activity_feed || (overview as any)?.recent_activity || (overview as any)?.recentActivity || (overview as any)?.activityFeed || [];

  const totalGenerated = Number(kpis.total_generated_codes ?? (kpis as any).generated_codes ?? (kpis as any).generatedCodes ?? 0);
  const remainingQuota = Number(kpis.remaining_quota ?? (kpis as any).available_quota ?? (kpis as any).availableQuota ?? 0);
  const totalRedeemed = Number(kpis.total_redeemed_codes ?? (kpis as any).redeemed_codes ?? (kpis as any).redeemedCodes ?? 0);
  const maxQuota = totalGenerated + remainingQuota;
  const quotaUsedPercent = maxQuota > 0 ? Math.round((totalGenerated / maxQuota) * 100) : 0;
  const institutionName = center_info.institution_name || (center_info as any).institutionName || "المركز التعليمي";
  const isVerified = Boolean(center_info.is_verified || (center_info as any).isVerified);
  const hasInstructors = Boolean(onboarding.has_instructors || (onboarding as any).hasInstructors);

  return (
    <div className="space-y-6">
      {/* Onboarding Guard Banner (Strict rule: Must have >= 1 instructor to generate codes) */}
      {!hasInstructors && (
        <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-slate-900 border-2 border-amber-500/80 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="bg-amber-600 text-white hover:bg-amber-700 text-xs">
                  خطوة إلزامية أولى
                </Badge>
                <h3 className="text-lg font-bold text-white">إضافة مدرس للمركز شرط أساسي للبدء</h3>
              </div>
              <p className="text-sm text-amber-200/90 max-w-2xl leading-relaxed">
                لا يمكن للمركز توليد أو طباعة أكواد التفعيل وتوزيعها على الطلاب دون وجود معلم واحد على الأقل معتمد
                ومرتبط بمواد تدريبية داخل السنتر.
              </p>
            </div>
          </div>
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 gap-2">
            <Link to="/center/instructors">
              <PlusCircle className="w-4 h-4" />
              إضافة مدرس الآن
            </Link>
          </Button>
        </div>
      )}

      {/* Welcome & Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              أهلاً بك، {institutionName} 👋
            </h1>
            {isVerified && (
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" /> مركز موثق
              </Badge>
            )}
          </div>
          <p className="text-blue-200/80 mt-1 text-sm">
            نظرة شاملة ومحدثة لحظياً على أداء السنتر، حركة تفعيل الأكواد، ونشاط الطلاب.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Link to="/center/activation-codes">
              <KeyRound className="w-4 h-4" />
              توليد أكواد جديدة
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white gap-2">
            <Link to="/center/subscription">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              إدارة الباقة
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Active Students */}
        <Card className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">إجمالي طلاب السنتر</CardTitle>
            <Users className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white font-mono">{kpis.total_active_students ?? 0}</div>
            <p className="text-xs text-slate-400 mt-1">الطلاب النشطون المسجلون عبر أكواد السنتر</p>
          </CardContent>
        </Card>

        {/* KPI 2: Activation Codes (Generated & Redeemed) */}
        <Card className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">الأكواد (متوّلدة / مفعّلة)</CardTitle>
            <KeyRound className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white font-mono">
              {totalRedeemed} <span className="text-sm font-normal text-slate-500">/ {totalGenerated}</span>
            </div>
            <p className="text-xs text-indigo-300/80 mt-1">
              معدل الاستخدام: <strong className="text-white font-mono">{kpis.usage_rate ?? (totalGenerated > 0 ? Math.round((totalRedeemed / totalGenerated) * 100) : 0)}%</strong>
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Remaining Quota */}
        <Card className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">الكوتة المتبقية للتوليد</CardTitle>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-400 font-mono">{remainingQuota}</div>
            <p className="text-xs text-slate-400 mt-1">كود متاح للتوليد والطباعة الآن</p>
          </CardContent>
        </Card>

        {/* KPI 4: Instructors & Subscription */}
        <Card className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">المدرسين وحالة الباقة</CardTitle>
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white font-mono">{kpis.total_active_instructors ?? 0}</span>
              <Badge
                className={
                  subscription.is_trial
                    ? "bg-amber-950 text-amber-300 border-amber-700/60"
                    : "bg-emerald-950 text-emerald-300 border-emerald-700/60"
                }
              >
                {subscription.is_trial ? `تجربة (${subscription.trial_days_left ?? 14} يوم)` : "باقة مدفوعة"}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">مدرسون نشطون مرتبطون بالمركز</p>
          </CardContent>
        </Card>
      </div>

      {/* Quota Progress & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quota Meter Card */}
        <Card className="lg:col-span-2 bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  استهلاك كوتة الأكواد
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  {subscription.is_trial
                    ? "أنت حالياً في فترة التجربة المجانية (كوتة 50 كود معتمد)"
                    : "استهلاك باقة المركز الحالية"}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild className="text-xs border-blue-800/60 text-blue-300 hover:bg-blue-900/40">
                <Link to="/center/activation-codes">
                  طلب زيادة كوتة <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>تم توليد {totalGenerated} كود</span>
                <span className="font-mono">{quotaUsedPercent}% مستهلك من إجمالي السعة</span>
              </div>
              <Progress value={quotaUsedPercent} className="h-2.5 bg-slate-800" />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400">المولّدة</div>
                <div className="text-lg font-bold text-white font-mono">{totalGenerated}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400">المفعّلة</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">{totalRedeemed}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400">المتبقية</div>
                <div className="text-lg font-bold text-amber-400 font-mono">{remainingQuota}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan & Upgrade Callout */}
        <Card className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-blue-950/50 border-indigo-800/40">
          <CardHeader>
            <Badge className="w-fit mb-1 bg-indigo-600/20 text-indigo-300 border-indigo-500/30 text-xs">
              باقة السنتر الرسمية
            </Badge>
            <CardTitle className="text-lg font-bold text-white">ترقية الباقة وتوسيع السعة</CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              بعد انتهاء فترة التجربة أو عند الحاجة لأكواد أكثر، يمكنك شراء باقة 100 كود بسعر 3,000 ج.م مباشرة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                توليد فوري للأكواد وطباعة PDF بـ QR Code
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                تخصيص الكود لكل دكتور/مدرس بشكل مستقل
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                دعم فني وربط غير محدود للمدرسين
              </li>
            </ul>

            <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs h-9 mt-2">
              <Link to="/center/subscription">
                الترقية وشراء باقة جديدة
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Section */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              آخر النشاطات بالمركز
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              سجل التفعيلات اللحظية للطلاب وانضمام المدرسين الجدد
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {activity_feed.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              لا توجد نشاطات مسجلة بعد. عند تفعيل الطلاب لأكوادهم ستظهر هنا مباشرة.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {activity_feed.map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        act.type === "code_redeemed"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                          : "bg-blue-950 text-blue-400 border border-blue-800/50"
                      }`}
                    >
                      {act.type === "code_redeemed" ? <KeyRound className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{act.title}</div>
                      <div className="text-xs text-slate-400">
                        {act.description} • المعلم: <span className="text-slate-300">{act.target_instructor}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                    {new Date(act.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
