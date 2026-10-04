import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Loader2,
  GraduationCap,
  Presentation,
  Building2,
  KeyRound,
  Zap,
  HelpCircle,
  ArrowRight,
  Clock,
  Users,
  Video,
  FileSpreadsheet,
  QrCode,
  Laptop,
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth";
import { usePlatformPricing, PricingPlanDto } from "@/hooks/usePlatformPricing";
import { apiPost } from "@/lib/http";
import PlanCustomizerWizard from "@/components/pricing/PlanCustomizerWizard";
import PricingSliderCalculator from "@/components/pricing/PricingSliderCalculator";
import { SUPPORT_WHATSAPP_NUMBER } from "@/lib/academicPricing";

type AudienceTab = "students" | "instructors" | "centers";

export const Pricing: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AudienceTab>("students");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Selected Plan for Checkout
  const [selectedPlanModal, setSelectedPlanModal] = useState<PricingPlanDto | null>(null);

  // Coming Soon Gateway Notice Modal
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [comingSoonPlanName, setComingSoonPlanName] = useState<string>("");

  // Activation Code Redemption State
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Coupon State in Modal
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);

  const {
    plans,
    isLoading: isPlansLoading,
    gatewayStatus,
    isGatewayStatusLoading,
    createKashierSession,
    isCreatingKashierSession,
  } = usePlatformPricing();

  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isElectronicPaymentActive = Boolean(gatewayStatus?.is_enabled);

  // Handle Code Redemption
  const handleRedeemCode = async () => {
    if (!redeemCode.trim()) {
      toast({
        variant: "destructive",
        title: "يرجى كتابة كود التفعيل",
        description: "أدخل كود التفعيل المكون من الحروف والأرقام المرسل لك.",
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يرجى تسجيل الدخول أولاً لتفعيل الكود وربطه بحسابك.",
      });
      navigate("/login");
      return;
    }

    setIsRedeeming(true);
    try {
      const res = await apiPost<{ message?: string }>("/activation-codes/redeem/", {
        code: redeemCode.trim().toUpperCase(),
      });
      toast({
        title: "تم تفعيل الكود بنجاح! 🎉",
        description: res.message || "تم شحن وتفعيل محتواك بنجاح، يمكنك البدء الآن.",
      });
      setIsRedeemOpen(false);
      setRedeemCode("");
      navigate("/student/dashboard");
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || "كود التفعيل غير صالح أو تم استخدامه مسبقاً.";
      toast({
        variant: "destructive",
        title: "فشل تفعيل الكود",
        description: msg,
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSelectPlan = (plan: PricingPlanDto) => {
    const monthlyPrice = Number(plan.price_monthly);

    // Free Tier / Trial
    if (monthlyPrice === 0) {
      if (!isAuthenticated) {
        navigate("/register");
        return;
      }
      toast({
        title: `أنت الآن في باقة ${plan.name} 🎉`,
        description: "تم تفعيل حسابك للاستمتاع بالمزايا التمهيدية المجانية.",
      });
      navigate("/dashboard");
      return;
    }

    // Check Gateway Status
    if (!isElectronicPaymentActive) {
      setComingSoonPlanName(plan.name);
      setIsComingSoonModalOpen(true);
      return;
    }

    setSelectedPlanModal(plan);
    setDiscountAmount(0);
    setCouponCode("");
  };

  const handleConfirmPayment = async () => {
    if (!selectedPlanModal) return;

    if (!isAuthenticated) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يرجى تسجيل الدخول أو إنشاء حسابك أولاً لإتمام الاشتراك.",
      });
      navigate("/login");
      return;
    }

    try {
      const res = await createKashierSession({
        resource_type: "subscription",
        resource_id: selectedPlanModal.id,
        billing_cycle: billing,
        coupon_code: couponCode.trim() || undefined,
      });

      if (res.checkout_url) {
        toast({
          title: "جاري التوجيه لبوابة الدفع الإلكتروني المعتمدة...",
          description: "يرجى الانتظار بينما نفتح لك صفحة السداد الآمنة بالفيزا / البطاقة البنكية.",
        });
        window.location.href = res.checkout_url;
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل فتح بوابة الدفع",
        description: err.message || "حدث خطأ أثناء إنشاء جلسة الدفع الإلكتروني. يرجى المحاولة لاحقاً.",
      });
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8 transition-colors">
        
        {/* Top Header Banner */}
        <div className="max-w-6xl mx-auto text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm">
            <Sparkles size={16} />
            <span>باقات المنصة الرسمية — أعلى معايير الجودة والحماية للتعليم الأكاديمي</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
            استثمر في مستقبلك التعليمي بمنظومة متكاملة
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            منظومة سحابية ذكية مصممة خصيصاً للطلاب، المعلمين، والمراكز التعليمية. حماية فائقة للفيديوهات، فلاش كاردز التكرار المتباعد، وتتبع التحصيل الدقيق.
          </p>

          {/* Quick Activation Code Redemption Bar */}
          <div className="pt-2">
            <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-card border border-border px-5 py-3 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground">
                <KeyRound className="w-4 h-4 text-primary" />
                <span>لديك كود تفعيل ورقي أو إلكتروني من المدرس أو السنتر؟</span>
              </div>
              <Button
                size="sm"
                onClick={() => setIsRedeemOpen(true)}
                className="h-8 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-sm"
              >
                فعّل الكود الآن
              </Button>
            </div>
          </div>
        </div>

        {/* Audience Selector Tabs (Students / Instructors / Centers) */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="grid grid-cols-3 p-1.5 rounded-2xl bg-muted border border-border shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("students")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "students"
                  ? "bg-card text-primary shadow-md scale-[1.01]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>باقات الطلاب</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("instructors")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "instructors"
                  ? "bg-card text-primary shadow-md scale-[1.01]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Presentation className="w-4 h-4" />
              <span>المدرسين والمعلمين</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("centers")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "centers"
                  ? "bg-card text-primary shadow-md scale-[1.01]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>السناتر والمراكز</span>
            </button>
          </div>
        </div>

        {/* Container for Dynamic Tab Content */}
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            
            {/* ========================================================================= */}
            {/* TAB 1: STUDENTS (الطلاب) */}
            {/* ========================================================================= */}
            {activeTab === "students" && (
              <motion.div
                key="students-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-10"
              >
                {/* Billing Cycle Toggle */}
                <div className="flex justify-center items-center gap-3">
                  <span className={`text-xs sm:text-sm font-bold ${billing === "monthly" ? "text-primary" : "text-muted-foreground"}`}>
                    اشتراك شهري
                  </span>
                  <button
                    type="button"
                    onClick={() => setBilling((prev) => (prev === "monthly" ? "yearly" : "monthly"))}
                    className="relative w-14 h-8 bg-muted border border-border rounded-full p-1 transition-colors"
                  >
                    <div
                      className={`w-6 h-6 bg-primary rounded-full transition-transform ${
                        billing === "yearly" ? "-translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 ${billing === "yearly" ? "text-primary" : "text-muted-foreground"}`}>
                    <span>اشتراك سنوي</span>
                    <span className="px-2 py-0.5 rounded-full bg-achievement/20 text-achievement text-[11px] font-black">
                      وفر حتى 20%
                    </span>
                  </span>
                </div>

                {/* Dynamic DB Plans Loading State */}
                {isPlansLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground font-bold">جاري تحميل باقات المنصة الرسمية من الخادم...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                    {/* Render Real DB Plans */}
                    {plans
                      .filter((p) => p.is_active && !p.slug.includes("center"))
                      .map((plan) => {
                        const monthlyPrice = Number(plan.price_monthly);
                        const yearlyPrice = Number(plan.price_yearly);
                        const displayPrice = billing === "yearly" ? yearlyPrice : monthlyPrice;

                        return (
                          <Card
                            key={plan.id}
                            className={`relative flex flex-col justify-between rounded-3xl bg-card transition-all overflow-hidden ${
                              plan.is_featured
                                ? "border-2 border-primary shadow-xl shadow-primary/10 lg:scale-105 z-10"
                                : "border border-border shadow-sm hover:border-border/80"
                            }`}
                          >
                            {plan.is_featured && (
                              <div className="bg-gradient-to-r from-primary via-primary/90 to-achievement text-white text-center py-2 text-xs font-black flex items-center justify-center gap-1.5 shadow-sm">
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>الخيار الأكثر طلباً للطلاب المتفوقين</span>
                              </div>
                            )}

                            <div className={`p-6 ${plan.is_featured ? "pt-4" : "pt-6"}`}>
                              <CardHeader className="p-0 pb-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <CardTitle className="text-xl font-black text-foreground">
                                      {plan.name}
                                    </CardTitle>
                                    <CardDescription className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                      {plan.description}
                                    </CardDescription>
                                  </div>
                                  {plan.trial_days > 0 && (
                                    <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
                                      {plan.trial_days} أيام تجربة
                                    </Badge>
                                  )}
                                </div>

                                <div className="mt-5 flex items-baseline gap-1.5">
                                  <span className="text-4xl font-black tracking-tight text-primary font-mono">
                                    {displayPrice.toLocaleString("ar-EG")}
                                  </span>
                                  <span className="text-sm font-bold text-muted-foreground">
                                    {plan.currency || "ج.م"}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-medium">
                                    / {billing === "yearly" ? "سنوياً" : "شهرياً"}
                                  </span>
                                </div>
                                {billing === "yearly" && plan.yearly_savings_percentage && plan.yearly_savings_percentage > 0 && (
                                  <div className="text-[11px] text-achievement font-extrabold mt-1">
                                    وفرت {plan.yearly_savings_percentage}% مع الاشتراك السنوي
                                  </div>
                                )}
                              </CardHeader>

                              <CardContent className="p-0 pt-4 space-y-3 border-t border-border/60">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                  مزايا الباقة:
                                </p>
                                <ul className="space-y-2.5">
                                  {plan.features?.map((feat, fIdx) => (
                                    <li key={fIdx} className="flex items-start gap-2.5 text-xs font-semibold text-foreground">
                                      <div className={`p-0.5 rounded-full shrink-0 mt-0.5 ${feat.is_included ? "text-primary" : "text-muted-foreground/40"}`}>
                                        {feat.is_included ? <Check size={14} /> : <X size={14} />}
                                      </div>
                                      <span className={feat.is_included ? "text-foreground" : "text-muted-foreground line-through"}>
                                        {feat.label}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </CardContent>
                            </div>

                            <CardFooter className="p-6 pt-0">
                              <Button
                                onClick={() => handleSelectPlan(plan)}
                                className={`w-full h-11 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all ${
                                  plan.is_featured
                                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                                }`}
                              >
                                {!isElectronicPaymentActive && monthlyPrice > 0 ? (
                                  <span className="flex items-center justify-center gap-1.5">
                                    <Clock size={15} className="text-amber-500" />
                                    <span>الدفع بالبطاقات (قريباً)</span>
                                  </span>
                                ) : (
                                  <span>اشترك في {plan.name}</span>
                                )}
                              </Button>
                            </CardFooter>
                          </Card>
                        );
                      })}

                    {/* Additional Pay-Per-Course Option Card */}
                    <Card className="flex flex-col justify-between rounded-3xl border border-dashed border-border bg-card/60 hover:bg-card transition-all shadow-sm">
                      <div className="p-6">
                        <CardHeader className="p-0 pb-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-xl font-black text-foreground">
                                شراء كورس محدد
                              </CardTitle>
                              <CardDescription className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                ادفع ثمن الكورس المطلوب فقط بدون أي التزامات دورية.
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-border">
                              حسب الرغبة
                            </Badge>
                          </div>

                          <div className="mt-5 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black tracking-tight text-foreground font-mono">
                              حسب سعر الكورس
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-0 pt-4 space-y-3 border-t border-border/60">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                            طرق الحصول على الكورس:
                          </p>
                          <div className="space-y-2">
                            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs font-semibold text-foreground flex items-center gap-2">
                              <KeyRound className="w-4 h-4 text-primary shrink-0" />
                              <span>تفعيل مباشر عبر كود المدرس أو السنتر</span>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs font-semibold text-foreground flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
                              <span>
                                {isElectronicPaymentActive ? "الدفع الإلكتروني بالبطاقات متاح" : "الدفع الإلكتروني بالبطاقات (قريباً)"}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </div>

                      <CardFooter className="p-6 pt-0">
                        <Link to="/courses" className="w-full">
                          <Button variant="outline" className="w-full h-11 rounded-2xl font-bold text-xs border-border hover:bg-muted">
                            تصفح دليل الكورسات المتاحة
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </div>
                )}
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2 & 3: INSTRUCTORS & CENTERS (المعلمين والسناتر) */}
            {/* ========================================================================= */}
            {(activeTab === "instructors" || activeTab === "centers") && (
              <motion.div
                key="instructors-centers-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {/* Live Interactive Pricing Calculator */}
                <PricingSliderCalculator onOpenWizard={() => setIsWizardOpen(true)} />
              </motion.div>
            )}

          </AnimatePresence>
        </div>


        {/* Security & Payment Methods Trust Bar */}
        <div className="max-w-5xl mx-auto mt-16 p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-foreground">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span>معاملات مالية مشفرة طبقاً لأحدث معايير الأمان المصرفي الدولية (PCI-DSS)</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-bold text-muted-foreground">
            <div className="flex items-center gap-2 text-primary">
              <CreditCard className="w-4 h-4" />
              <span>فيزا • ماستركارد • كارت ميزة الوطني</span>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <Zap className="w-4 h-4" />
              <span>إنستاباي (InstaPay) والمحافظ الإلكترونية</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <KeyRound className="w-4 h-4 text-achievement" />
              <span>أكواد التفعيل الورقية الفورية</span>
            </div>
          </div>
        </div>

        {/* Modern Animated FAQ Accordion */}
        <div className="max-w-4xl mx-auto mt-20 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              الأسئلة الشائعة حول الباقات والاشتراكات
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              إجابات مباشرة وواضحة على كل ما يخص كيفية الاشتراك، طرق الدفع، وتفعيل الحسابات
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            {[
              {
                id: "faq-1",
                q: "كيف يستفيد الطالب من باقة الاشتراك الشامل؟",
                a: "الاشتراك الشامل يمنح الطالب وصولاً كاملاً وغير محدود لكافة محتويات المنصة، متضمناً مشاهدة المحاضرات المشفرة عبر Bunny Stream HLS، فلاش كاردز التكرار المتباعد، بنك الأسئلة والاختبارات الدورية، وتتبع ساعات المذاكرة وبومودورو.",
              },
              {
                id: "faq-2",
                q: "ما هي طرق الدفع والتفعيل المتاحة حالياً على المنصة؟",
                a: "يمكن تفعيل الكورسات والباقات فوراً عبر أكواد التفعيل المباشرة الصادرة من المعلم أو السنتر، أو عبر التحويل المباشر من خلال إنستاباي (InstaPay) ومحافظ الهاتف (فودافون كاش). أما الدفع بالبطاقات البنكية المباشرة (كاشيير) فيخضع حالياً للاعتماد البنكي النهائي وسيتاح في أقرب وقت.",
              },
              {
                id: "faq-3",
                q: "كيف تعمل حاسبة السناتر والمعلمين؟ وهل توجد خصومات على الفترات الطويلة؟",
                a: "تعتمد الحاسبة الأكاديمية على تسعير مرن يراعي عدد الطلاب الفعلي؛ حيث تمنح المنصة خصماً فورياً 10% عند الاشتراك لنهاية الترم الدراسي، وخصماً 15% عند الاشتراك للعام الدراسي الكامل، مع إمكانية زيادة سعة الطلاب في أي وقت.",
              },
              {
                id: "faq-4",
                q: "كيف تحمي المنصة فيديوهات المحاضرين من التسريب وسرقة المحتوى؟",
                a: "نستخدم بنية تحتية مشفرة متطورة عبر Bunny Stream HLS مع توقيع الروابط الرقمي، بالإضافة إلى علامة مائية ديناميكية متحركة تحمل اسم ورقم هاتف الطالب تتحرك عشوائياً على الشاشة لمنع تصويرها بكاميرات الهواتف.",
              },
              {
                id: "faq-5",
                q: "هل يمكن للمركز التعليمي إدارة فروع متعددة ومدرسين متعددين؟",
                a: "نعم، توفر باقة السنتر والمؤسسات لوحة تحكم إدارية مركزية تمكنك من إضافة المحاضرين، تعيين المساعدين بصلاحيات محددة، طباعة بطاقات أكواد التفعيل بصيغة PDF، وتسجيل حضور وغياب الطلاب عبر الـ QR Code.",
              },
            ].map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="bg-card border border-border rounded-2xl px-5 py-1 shadow-sm"
              >
                <AccordionTrigger className="text-right text-xs sm:text-sm font-extrabold text-foreground hover:no-underline hover:text-primary">
                  <div className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{faq.q}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed ps-6 pt-1">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Modal 1: Activation Code Redemption Dialog */}
        <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
          <DialogContent size="sm" className="dir-rtl text-right">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                <KeyRound className="w-5 h-5 text-primary" />
                تفعيل كود الشحن والوصول
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                أدخل كود التفعيل المستلم من المحاضر أو السنتر التعليمي لتفعيل الكورس أو الباقة بحسابك فوراً.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <label htmlFor="modal-redeem-code" className="text-xs font-bold text-foreground">
                  كود التفعيل (Activation Code)
                </label>
                <Input
                  id="modal-redeem-code"
                  placeholder="مثال: ACT-XXXX-YYYY"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  className="h-11 font-mono text-center text-base tracking-widest uppercase rounded-xl border-border"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleRedeemCode}
                disabled={isRedeeming || !redeemCode.trim()}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm"
              >
                {isRedeeming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    جاري التفعيل...
                  </>
                ) : (
                  "تأكيد وتفعيل الكود"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 2: Coming Soon Payment Gateway Notice Modal */}
        <Dialog open={isComingSoonModalOpen} onOpenChange={setIsComingSoonModalOpen}>
          <DialogContent size="md" className="dir-rtl text-right">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                <Clock className="w-5 h-5 text-amber-500" />
                الدفع الإلكتروني بالبطاقات البنكية متاح قريباً
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                بوابة الدفع الإلكتروني بالفيزا والماستركارد قيد المراجعة والاعتماد المصرفي النهائي من البنك المركزي وسوف تتاح قريباً جداً.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-foreground space-y-2">
                <p className="font-bold text-amber-600 dark:text-amber-400">
                  يمكنك الاشتراك في &quot;{comingSoonPlanName}&quot; وتفعيل حسابك فوراً من خلال القنوات المتاحة حالياً:
                </p>
                <ul className="space-y-2 ps-4 list-disc text-muted-foreground text-xs">
                  <li>
                    <strong>كود التفعيل الورقي:</strong> احصل عليه من مدرسك أو السنتر التعليمي وأدخله في خانة تفعيل الأكواد.
                  </li>
                  <li>
                    <strong>التحويل المباشر عبر InstaPay أو فودافون كاش:</strong> يتم التفعيل اليدوي الفوري خلال دقائق.
                  </li>
                  <li>
                    <strong>فريق الدعم المباشر على واتساب:</strong> يتولى تأكيد بياناتك وتفعيل الباقة لك.
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  setIsComingSoonModalOpen(false);
                  setIsRedeemOpen(true);
                }}
                className="w-full sm:w-auto h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs sm:text-sm"
              >
                <KeyRound className="w-4 h-4 me-2" />
                تفعيل عبر كود
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  window.open(`https://wa.me/20${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحباً، أود تفعيل الاشتراك في باقة: ${comingSoonPlanName}`)}`, "_blank");
                }}
                className="w-full sm:w-auto h-11 rounded-xl font-bold text-xs sm:text-sm border-border flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                تواصل واتساب للتفعيل ({SUPPORT_WHATSAPP_NUMBER})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 3: Kashier Live Checkout Modal (When Gateway is Enabled) */}
        <Dialog open={Boolean(selectedPlanModal)} onOpenChange={(open) => !open && setSelectedPlanModal(null)}>
          <DialogContent size="md" className="dir-rtl text-right">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                <CreditCard className="w-5 h-5 text-primary" />
                إتمام الاشتراك — {selectedPlanModal?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                اختر طريقة الدفع المناسبة واستكمل السداد الآمن.
              </DialogDescription>
            </DialogHeader>

            {selectedPlanModal && (
              <div className="space-y-4 py-2">
                {/* Summary Box */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between items-center font-bold">
                    <span>دورة الفوترة:</span>
                    <span className="text-primary font-black">
                      {billing === "yearly" ? "سنوياً (أوفر قيمة)" : "شهرياً"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>السعر الأساسي:</span>
                    <span>
                      {(billing === "yearly" ? Number(selectedPlanModal.price_yearly) : Number(selectedPlanModal.price_monthly)).toLocaleString("ar-EG")}{" "}
                      {selectedPlanModal.currency || "ج.م"}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-achievement font-bold">
                      <span>الخصم المطبق:</span>
                      <span>-{discountAmount.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex justify-between items-center text-base font-black">
                    <span>المبلغ النهائي المطلوب:</span>
                    <span className="text-xl text-primary font-black font-mono">
                      {(
                        (billing === "yearly" ? Number(selectedPlanModal.price_yearly) : Number(selectedPlanModal.price_monthly)) -
                        discountAmount
                      ).toLocaleString("ar-EG")}{" "}
                      {selectedPlanModal.currency || "ج.م"}
                    </span>
                  </div>
                </div>

                {/* Gateway Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">طريقة الدفع الإلكتروني المعتمدة:</label>
                  <div className="p-3.5 rounded-xl border border-primary bg-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-foreground">
                          الدفع الإلكتروني المباشر (كاشيير / Kashier)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          فيزا، ماستركارد، كارت ميزة الوطني، فودافون كاش، إنستاباي
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-primary text-primary-foreground text-[10px]">معتمد</Badge>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={handleConfirmPayment}
                disabled={isCreatingKashierSession}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm shadow-md"
              >
                {isCreatingKashierSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    جاري تجهيز بوابة السداد...
                  </>
                ) : (
                  "متابعة السداد الآمن عبر كاشيير (Kashier)"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Center Custom Plan Wizard Modal */}
        <PlanCustomizerWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
        />

      </div>
    </Layout>
  );
};

export default Pricing;
