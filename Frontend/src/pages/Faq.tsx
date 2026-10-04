import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Search, BookOpen, CreditCard, ShieldCheck, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";

const FAQ_ITEMS = [
  {
    category: "الاشتراكات والدفع",
    icon: <CreditCard className="text-emerald-500" size={18} />,
    questions: [
      {
        q: "ما هي طرق الدفع المتاحة في المنصة؟",
        a: "ندعم جميع وسائل الدفع الإلكترونية المحلية والدولية، بما في ذلك البطاقات البنكية (Visa / MasterCard)، ميزة، فودافون كاش، وفوري."
      },
      {
        q: "هل يمكنني إلغاء الاشتراك واسترداد المبلغ؟",
        a: "نعم، يتيح لك نظام الضمان الأكاديمي طلب استرداد المبلغ خلال 14 يوماً من الشراء بشرط عدم تجاوز نسبة مشاهدة 20% من الكورس."
      }
    ]
  },
  {
    category: "الدورات والمحتوى الأكاديمي",
    icon: <BookOpen className="text-blue-500" size={18} />,
    questions: [
      {
        q: "كيف يمكنني الوصول للدروس بعد الشراء؟",
        a: "بمجرد إتمام التسجيل أو الشراء، تظهر الدورة مباشرة في حسابك بتبويب 'لوحة التحكم' ويمكنك مشاهدتها في أي وقت ومن أي جهاز."
      },
      {
        q: "هل الفيديوهات ممررة بجودة عالية وتعمل على الموبايل؟",
        a: "نعم، يتم بث جميع الفيديوهات عبر خوادم Bunny Stream فائقة السرعة مع التكيف التلقائي مع سرعة إنترنت المستخدم."
      }
    ]
  },
  {
    category: "الشهادات والاعتمادات",
    icon: <GraduationCap className="text-purple-500" size={18} />,
    questions: [
      {
        q: "كيف أحصل على شهادة إتمام الدورة؟",
        a: "تُصدر الشهادة الرقمية المعتمدة تلقائياً بمجرد إكمال جميع دروس الدورة واجتياز الامتحان النهائي بنجاح."
      },
      {
        q: "هل يمكن للشركات والجهات التحقق من صحة شهادتي؟",
        a: "نعم، تحتوي كل شهادة على كود رقمي وفريد ورابط تحكم موثق يتيح لأي جهة التحقق من صحة بيانات الشهادة فوراً."
      }
    ]
  }
];

export default function Faq() {
  const { data: themeData } = usePlatformTheme();
  const siteName = themeData?.site_name?.replace(/ - إديوسمارت|إديوسمارت| - EduSmart|EduSmart/g, "") || "كورسات";
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFaqs = FAQ_ITEMS.map((cat) => ({
    ...cat,
    questions: cat.questions.filter(
      (item) =>
        item.q.includes(searchTerm) || item.a.includes(searchTerm)
    )
  })).filter((cat) => cat.questions.length > 0);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 dir-rtl max-w-4xl space-y-8" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 rounded-3xl border border-primary/20">
          <div className="w-14 h-14 bg-primary/15 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
            <HelpCircle size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">مركز الأسئلة الشائعة والدعم</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            إليك الإجابات الكاملة والتفصيلية عن أبرز التساؤلات الخاصة بالدراسة والاشتراكات والشهادات في منصة {siteName}.
          </p>

          <div className="relative max-w-md mx-auto pt-2">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
            <Input
              placeholder="ابحث عن سؤالك هنا..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-3 pe-10 h-11 rounded-2xl bg-background border-border/80 shadow-xs"
            />
          </div>
        </div>

        {/* Content Accordions */}
        <div className="space-y-6">
          {filteredFaqs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground rounded-2xl border-dashed">
              لم نجد نتائج مطابقة لمصطلح البحث "{searchTerm}".
            </Card>
          ) : (
            filteredFaqs.map((cat, idx) => (
              <Card key={idx} className="border-border/60 rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/30 py-4 flex flex-row items-center gap-3">
                  <div className="p-2 rounded-xl bg-background border shadow-2xs">
                    {cat.icon}
                  </div>
                  <CardTitle className="text-base font-bold">{cat.category}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Accordion type="single" collapsible className="w-full">
                    {cat.questions.map((q, qIdx) => (
                      <AccordionItem key={qIdx} value={`item-${idx}-${qIdx}`} className="border-b border-border/40 last:border-none">
                        <AccordionTrigger className="text-sm font-semibold hover:text-primary text-right leading-snug py-3">
                          {q.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1 pb-3">
                          {q.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
