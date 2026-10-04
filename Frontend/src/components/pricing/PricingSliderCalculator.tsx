import React, { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  calculateAcademicQuote,
  generateWhatsAppQuoteUrl,
  PlanType,
  SUPPORT_WHATSAPP_NUMBER,
} from "@/lib/academicPricing";
import {
  Users,
  Calendar,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Zap,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";

interface PricingSliderCalculatorProps {
  onOpenWizard?: () => void;
}

export const PricingSliderCalculator: React.FC<PricingSliderCalculatorProps> = ({ onOpenWizard }) => {
  const [studentsCount, setStudentsCount] = useState<number>(100);
  const [planType, setPlanType] = useState<PlanType>("term");

  const monthlyQuote = useMemo(() => calculateAcademicQuote(studentsCount, "monthly"), [studentsCount]);
  const termQuote = useMemo(() => calculateAcademicQuote(studentsCount, "term"), [studentsCount]);
  const fullYearQuote = useMemo(() => calculateAcademicQuote(studentsCount, "full_year"), [studentsCount]);

  const quote = useMemo(() => {
    if (planType === "monthly") return monthlyQuote;
    if (planType === "term") return termQuote;
    return fullYearQuote;
  }, [planType, monthlyQuote, termQuote, fullYearQuote]);

  const handleWhatsAppInquiry = () => {
    const url = generateWhatsAppQuoteUrl("طلب اشتراك مباشر", "QUOTE", quote);
    window.open(url, "_blank");
  };

  return (
    <Card className="rounded-3xl border-2 border-primary/30 bg-card/90 shadow-xl backdrop-blur-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-achievement/10 border-b border-border/80 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">الحاسبة الأكاديمية التفاعلية للسناتر والمعلمين</h3>
            <p className="text-xs text-muted-foreground">احسب تكلفة منظومة التدريس وسعة الطلاب بدقة مع الخصم الأكاديمي المباشر</p>
          </div>
        </div>

        <Badge variant="outline" className="border-primary/40 text-primary font-bold text-xs px-3 py-1">
          محرك التسعير الرسمي المعتمد
        </Badge>
      </div>

      <CardContent className="p-6 sm:p-8 space-y-8">
        {/* Volume Tier Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className={`p-3 rounded-2xl border transition-all ${
              quote.studentUnitPrice === 30
                ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                : "border-border/60 bg-muted/20 opacity-75"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-foreground">أقل من 300 طالب</span>
              <Badge variant={quote.studentUnitPrice === 30 ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                {quote.studentUnitPrice === 30 ? "الشريحة الحالية" : "شريحة أولى"}
              </Badge>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-black text-primary font-mono">30</span>
              <span className="text-[11px] font-bold text-muted-foreground">ج.م / طالب / شهر</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">مثال: 100 طالب = 3,000 ج.م/شهرياً</p>
          </div>

          <div
            className={`p-3 rounded-2xl border transition-all ${
              quote.studentUnitPrice === 25
                ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                : "border-border/60 bg-muted/20 opacity-75"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-foreground">300 إلى 599 طالب</span>
              <Badge variant={quote.studentUnitPrice === 25 ? "default" : "outline"} className="text-[10px] px-1.5 py-0 bg-achievement/20 text-achievement border-achievement/40">
                {quote.studentUnitPrice === 25 ? "توفير 17% (نشط)" : "توفير 17%"}
              </Badge>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-black text-primary font-mono">25</span>
              <span className="text-[11px] font-bold text-muted-foreground">ج.م / طالب / شهر</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">مثال: 300 طالب = 7,500 ج.م/شهرياً</p>
          </div>

          <div
            className={`p-3 rounded-2xl border transition-all ${
              quote.studentUnitPrice === 20
                ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                : "border-border/60 bg-muted/20 opacity-75"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-foreground">600 طالب فأكثر</span>
              <Badge variant={quote.studentUnitPrice === 20 ? "default" : "outline"} className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
                {quote.studentUnitPrice === 20 ? "أعلى توفير 33% (نشط)" : "توفير 33%"}
              </Badge>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-black text-primary font-mono">20</span>
              <span className="text-[11px] font-bold text-muted-foreground">ج.م / طالب / شهر</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">مثال: 600 طالب = 12,000 ج.م/شهرياً</p>
          </div>
        </div>

        {/* Slider Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>عدد الطلاب المستهدف في مجموعاتك:</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-muted text-muted-foreground">
                سعر الطالب: <strong className="text-foreground font-mono">{quote.studentUnitPrice} ج.م</strong>
              </span>
              <div className="flex items-baseline gap-1.5 px-4 py-1.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black text-xl font-mono">
                <span>{studentsCount.toLocaleString("ar-EG")}</span>
                <span className="text-xs font-bold text-muted-foreground">طالب</span>
              </div>
            </div>
          </div>

          <Slider
            value={[studentsCount]}
            min={20}
            max={2000}
            step={10}
            onValueChange={(val) => setStudentsCount(val[0] || 20)}
            className="py-4 cursor-pointer"
          />

          <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground px-1">
            <span className="cursor-pointer hover:text-foreground" onClick={() => setStudentsCount(100)}>100 طالب (30 ج)</span>
            <span className="cursor-pointer hover:text-foreground" onClick={() => setStudentsCount(300)}>300 طالب (25 ج)</span>
            <span className="cursor-pointer hover:text-foreground" onClick={() => setStudentsCount(600)}>600 طالب (20 ج)</span>
            <span className="cursor-pointer hover:text-foreground" onClick={() => setStudentsCount(1000)}>1,000+ طالب (20 ج)</span>
          </div>
        </div>

        {/* Plan Type Selector Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>اختر مدة وخطة الاشتراك:</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setPlanType("monthly")}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                planType === "monthly"
                  ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="text-xs font-black text-foreground">اشتراك شهري</div>
              <div className="text-[11px] text-muted-foreground mt-1">تجديد شهري مرن</div>
              <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                صالح لشهر واحد (حتى {monthlyQuote.endDate})
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPlanType("term")}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between relative overflow-hidden ${
                planType === "term"
                  ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-black text-foreground">اشتراك الترم الدراسي</div>
                <span className="px-1.5 py-0.5 rounded-md bg-achievement/20 text-achievement text-[10px] font-black">
                  خصم 10%
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {termQuote.calculatedMonths} أشهر متبقية حتى نهاية الترم
              </div>
              <div className="text-[10px] text-primary font-bold mt-2 font-mono">
                صالح حتى {termQuote.endDate}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPlanType("full_year")}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between relative overflow-hidden ${
                planType === "full_year"
                  ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-black text-foreground">العام الدراسي الكامل</div>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                  خصم 15% الأوفر
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {fullYearQuote.calculatedMonths} أشهر شاملة حتى نهاية العام
              </div>
              <div className="text-[10px] text-primary font-bold mt-2 font-mono">
                صالح حتى {fullYearQuote.endDate}
              </div>
            </button>
          </div>
        </div>

        {/* Live Calculation Output Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-muted/40 border border-border/80">
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">التكلفة الإجمالية الصافية:</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-primary font-mono tracking-tight">
                {quote.netTotal.toLocaleString("ar-EG")}
              </span>
              <span className="text-xs font-extrabold text-foreground">ج.م</span>
            </div>
            {quote.discountAmount > 0 && (
              <p className="text-[11px] text-achievement font-bold">
                وفرت {quote.discountAmount.toLocaleString("ar-EG")} ج.م ({quote.discountPercentage}% خصم)
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">تكلفة الطالب الواحد شهرياً:</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground font-mono">
                {(Math.round((quote.netTotal / quote.calculatedMonths / quote.studentCount) * 10) / 10).toLocaleString("ar-EG")}
              </span>
              <span className="text-xs font-bold text-muted-foreground">ج.م / طالب / شهر</span>
            </div>
            <p className="text-[11px] text-muted-foreground">أوفر من أي منصة أو تطبيق بديل</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">ما تتضمنه الباقة مجاناً:</span>
            <ul className="text-xs space-y-1 font-semibold text-foreground">
              <li className="flex items-center gap-1.5 text-primary">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>فيديوهات مشفرة Bunny Stream</span>
              </li>
              <li className="flex items-center gap-1.5 text-primary">
                <Zap className="w-3.5 h-3.5" />
                <span>علامة مائية متحركة لمنع التصوير</span>
              </li>
              <li className="flex items-center gap-1.5 text-primary">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>أكواد تفعيل غير محدودة لطلابك</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            onClick={handleWhatsAppInquiry}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>طلب تفعيل الباقة فوراً عبر واتساب ({SUPPORT_WHATSAPP_NUMBER})</span>
          </Button>

          {onOpenWizard && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenWizard}
              className="w-full sm:w-auto h-12 px-5 rounded-2xl font-bold text-xs border-border hover:bg-muted/50"
            >
              <span>تخصيص المعلمين وإصدار فاتورة رسمية (معالج السنتر)</span>
              <ArrowLeft className="w-4 h-4 ms-1.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PricingSliderCalculator;
