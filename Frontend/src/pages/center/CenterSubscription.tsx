import React from "react";
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Download,
  Calendar,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useCenterOverview } from "@/features/center";

export default function CenterSubscription() {
  const { toast } = useToast();
  const { data: overview, isLoading } = useCenterOverview();

  const subscription = overview?.subscription;
  const isTrial = subscription?.is_trial ?? true;
  const trialDaysLeft = subscription?.trial_days_left ?? 14;

  const handleUpgradePackage = (planName: string, price: string) => {
    toast({
      title: `ترقية ${planName}`,
      description: `سيتم توجيهك لبوابة الدفع الإلكتروني لإتمام سداد ${price}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-400" />
            الباقة والاشتراك
          </h1>
          <p className="text-blue-200/80 mt-1 text-sm">
            إدارة اشتراك المركز الأكاديمي، تجديد الباقات، وسجل المعاملات المالية.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            className={`text-sm px-3.5 py-1.5 font-bold ${
              isTrial
                ? "bg-amber-950 text-amber-300 border-amber-600"
                : "bg-emerald-950 text-emerald-300 border-emerald-600"
            }`}
          >
            {isTrial ? `فترة تجريبية مجانية (${trialDaysLeft} يوم متبقي)` : "باقة السنتر النشطة"}
          </Badge>
        </div>
      </div>

      {/* Current Subscription Status Card */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            حالة الاشتراك الحالية
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            تفاصيل الخطة المفعلة حالياً لحساب السنتر
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">نوع الباقة</span>
              <div className="text-lg font-bold text-white mt-1">
                {isTrial ? "تجربة مجانية شاملة (Free Trial)" : "باقة السنتر الرسمية"}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {isTrial ? "كوتة 50 كود مجاني للمركز" : "100 كود تفعيل معتمدة"}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">الصلاحية والانتهاء</span>
              <div className="text-lg font-bold text-amber-400 mt-1 font-mono">
                {isTrial ? `${trialDaysLeft} يوم متبقي` : "مستمر (تجديد شهري)"}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">تنتهي فترة التجربة تلقائياً</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400">حالة الدفع</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                {isTrial ? "مجانية 100%" : "مدفوعة ونشطة"}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">لا توجد فواتير متأخرة</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Packages */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          الباقات المتاحة للمراكز التعليمية
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Official Pack (100 Codes / 3000 EGP) */}
          <Card className="relative bg-gradient-to-br from-indigo-950/50 via-slate-900 to-blue-950/40 border-2 border-indigo-500/60 shadow-xl overflow-hidden">
            <div className="absolute top-3 left-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              الأكثر طلباً
            </div>
            <CardHeader>
              <CardTitle className="text-xl font-extrabold text-white">باقة السنتر الرسمية</CardTitle>
              <CardDescription className="text-slate-300 text-xs">
                الحزمة الشاملة بعد انتهاء التجربة المجانية لتشغيل السنتر وتوليد الأكواد
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white font-mono">3,000</span>
                <span className="text-sm font-medium text-slate-400">جنيه مصري</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <strong>100 كود تفعيل</strong> مخصص للطلاب
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ربط غير محدود للمدرسين بالمركز
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  توليد مستندات PDF مخصصة للطباعة بـ QR Codes
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  تخصيص الأكواد لكل مدرس بشكل مستقل تماماً
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  دعم فني مخصص للمراكز التعليمية
                </li>
              </ul>

              <Button
                onClick={() => handleUpgradePackage("باقة السنتر (100 كود)", "3,000 ج.م")}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-10 shadow-lg shadow-indigo-500/20"
              >
                شراء الباقة الآن (3,000 ج.م)
              </Button>
            </CardContent>
          </Card>

          {/* Scale Pack (250 Codes / 6500 EGP) */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl font-extrabold text-white">باقة التوسع الأكاديمي</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                للمراكز الكبيرة ذات الفروع المتعددة وأعداد الطلاب المرتفعة
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white font-mono">6,500</span>
                <span className="text-sm font-medium text-slate-400">جنيه مصري</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <strong>250 كود تفعيل</strong> مخصص للطلاب
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  وفر 1,000 جنيه مقارنة بشراء باقات فردية
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  أولوية في مراجعة طلبات الكوتة الإضافية
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  تقارير تفصيلية متقدمة عن حركات التفعيل
                </li>
              </ul>

              <Button
                variant="outline"
                onClick={() => handleUpgradePackage("باقة التوسع (250 كود)", "6,500 ج.م")}
                className="w-full border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white font-bold h-10"
              >
                شراء باقة التوسع (6,500 ج.م)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment & Invoice History */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            سجل المدفوعات والفواتير
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            سجل العمليات المالية الخاصة بمركزك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500 text-sm">
            {isTrial ? (
              <p>أنت حالياً تستفيد من الفترة التجريبية المجانية. ستظهر فواتيرك هنا عند الترقية.</p>
            ) : (
              <p>لا توجد مدفوعات سابقة مسجلة.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
