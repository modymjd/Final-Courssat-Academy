import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, AlertCircle, BookOpen, Scale } from "lucide-react";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";

export default function Terms() {
  const { data: themeData } = usePlatformTheme();
  const siteName = themeData?.site_name?.replace(/ - إديوسمارت|إديوسمارت| - EduSmart|EduSmart/g, "") || "كورسات";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 dir-rtl max-w-4xl space-y-8" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 rounded-3xl border border-primary/20">
          <div className="w-14 h-14 bg-primary/15 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
            <Scale size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">شروط وقواعد الاستخدام</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            تحدد هذه الأحكام والشروط القواعد والتنظيمات الخاصة باستخدام منصة {siteName} التعليمية وحماية الحقوق الفكرية والأكاديمية.
          </p>
          <span className="inline-block text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
            سارية اعتباراً من: 13 أغسطس 2026
          </span>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <CheckCircle2 size={20} />
              </div>
              <CardTitle className="text-lg font-bold">1. إنشاء الحساب والاستخدام المقبول</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>يلتزم المستخدم بالآتي أثناء تصفح واستخدام المنصة:</p>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>إدخال بيانات صحيحة ومحدثة عند التسجيل.</li>
                <li>الحفاظ على سرية بيانات الدخول وعدم مشاركة الحساب مع أشخاص آخرين.</li>
                <li>عدم استخدام المنصة لأي أغراض تخالف القوانين أو تضر بالعملية التعليمية.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <BookOpen size={20} />
              </div>
              <CardTitle className="text-lg font-bold">2. الملكية الفكرية وحماية المحتوى</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                جميع المواد التعليمية والفيديوهات المدمجة والامتحانات والشهادات مملوكة حصرياً للمنصة والمدرسين المعتمدين.
              </p>
              <p className="font-semibold text-foreground text-xs sm:text-sm">
                يُحظر تماماً تسجيل المحتوى والمرئيات أو نسخها أو إعادة توزيعها تجارياً بدون إذن كتابي صريح.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <AlertCircle size={20} />
              </div>
              <CardTitle className="text-lg font-bold">3. سياسة الاسترجاع والاشتراكات</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                تخضع اشتراكات الكورسات الفردية والباقات المباشرة لسياسة الضمان الأكاديمي، حيث يمكن طلب الاسترجاع خلال 14 يوماً من الشراء بشرط عدم تجاوز مشاهدة 20% من محتوى الكورس.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <FileText size={20} />
              </div>
              <CardTitle className="text-lg font-bold">4. تعديل الشروط</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                تحتفظ المنصة بحق تحديث شروط الخدمة لضمان جودة الأداء الأكاديمي، وسيتم إخطار المستخدمين بأي تغييرات جوهرية عبر الإشعارات أو البريد الإلكتروني.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
