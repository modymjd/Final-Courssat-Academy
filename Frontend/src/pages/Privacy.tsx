import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, Eye, Database, FileText } from "lucide-react";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";

export default function Privacy() {
  const { data: themeData } = usePlatformTheme();
  const siteName = themeData?.site_name?.replace(/ - إديوسمارت|إديوسمارت| - EduSmart|EduSmart/g, "") || "كورسات";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 dir-rtl max-w-4xl space-y-8" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 rounded-3xl border border-primary/20">
          <div className="w-14 h-14 bg-primary/15 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">سياسة الخصوصية وحماية البيانات</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            في منصة {siteName}، نلتزم بأعلى معايير حماية وخصوصية بيانات الطلاب والمدرسين وفقاً للقوانين المصرية والدولية لحماية البيانات.
          </p>
          <span className="inline-block text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
            آخر تحديث: 13 أغسطس 2026
          </span>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Database size={20} />
              </div>
              <CardTitle className="text-lg font-bold">1. البيانات التي نجمعها</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>نجمع البيانات الأساسية اللازمة لتقديم الخدمة التعليمية بكفاءة عالية، وتتضمن:</p>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>البيانات الشخصية: الاسم، البريد الإلكتروني، رقم الهاتف، والدور الأكاديمي (طالب / محاضر / ولي أمر).</li>
                <li>بيانات التحصيل الأكاديمي: تقدم الدروس، نتائج الامتحانات، الواجبات، والشهادات الصادرة.</li>
                <li>بيانات الدفع: معالجة المعاملات المالية تفي بالمعايير الأمنية عبر بوابات دفع معتمدة دون تخزين بيانات الكروت بنظامنا.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Eye size={20} />
              </div>
              <CardTitle className="text-lg font-bold">2. كيف نستخدم بياناتك</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>إتاحة المحتوى التعليمي ومزامنة التقدم عبر الأجهزة.</li>
                <li>توليد تقارير الأداء وتنبيهات التعثر الأكاديمي لمساعدة الطلاب.</li>
                <li>إصدار والتحقق من الشهادات الرقمية المعتمدة.</li>
                <li>إرسال الإشعارات والتحديثات الخاصة بالدورات والجلسات المباشرة.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <Lock size={20} />
              </div>
              <CardTitle className="text-lg font-bold">3. حماية وأمان البيانات</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                نستخدم تقنيات التشفير المتقدمة (SSL/TLS) لتأمين نقل البيانات عبر الإنترنت، وتخزين كلمات المرور بطرق تشفير مجهزة بخوارزميات صلبة، وتأمين البث المرئي عبر Bunny Stream لضمان عدم تسريب المحتوى.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <FileText size={20} />
              </div>
              <CardTitle className="text-lg font-bold">4. حقوقك وتواصل معنا</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                يحق لك في أي وقت تعديل بياناتك الشخصية، طلب تصدير سجلاتك الأكاديمية، أو حذف حسابك بشكل نهائي من خلال التواصل مع فريق الدعم على البريد: <span className="font-semibold text-primary">{themeData?.support_email || "support@courssat.online"}</span>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
