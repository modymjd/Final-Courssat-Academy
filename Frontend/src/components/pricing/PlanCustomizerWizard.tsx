import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth";
import { useNavigate } from "react-router-dom";
import http from "@/lib/http";
import {
  calculateAcademicQuote,
  formatMonthsArabic,
  generateWhatsAppQuoteUrl,
  PlanType,
  PricingQuote,
  SUPPORT_WHATSAPP_NUMBER,
} from "@/lib/academicPricing";
import {
  Sparkles,
  Users,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Phone,
  MessageCircle,
  Copy,
  ExternalLink,
  Gift,
  HelpCircle,
  Wallet,
  Receipt,
  Check,
} from "lucide-react";

interface TeacherEntry {
  id: string;
  type: "existing" | "new";
  teacherUid?: string;
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  studentQuota: number;
}

interface PlanCustomizerWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlanCustomizerWizard({ isOpen, onClose }: PlanCustomizerWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Academic Pricing Parameters
  const [studentsCount, setStudentsCount] = useState<number>(100);
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>("term");
  const [institutionName, setInstitutionName] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");

  // Live Quotes Calculated via Engine
  const monthlyQuote = useMemo(() => calculateAcademicQuote(studentsCount, "monthly"), [studentsCount]);
  const termQuote = useMemo(() => calculateAcademicQuote(studentsCount, "term"), [studentsCount]);
  const fullYearQuote = useMemo(() => calculateAcademicQuote(studentsCount, "full_year"), [studentsCount]);

  const quote = useMemo(() => {
    if (selectedPlanType === "monthly") return monthlyQuote;
    if (selectedPlanType === "term") return termQuote;
    return fullYearQuote;
  }, [selectedPlanType, monthlyQuote, termQuote, fullYearQuote]);

  // Step 2: Teachers
  const [quotaMode, setQuotaMode] = useState<"shared" | "per_teacher">("per_teacher");
  const [teachersList, setTeachersList] = useState<TeacherEntry[]>([]);

  // Existing teacher inputs
  const [existingUid, setExistingUid] = useState("");
  const [existingSubject, setExistingSubject] = useState("");
  const [existingQuota, setExistingQuota] = useState<number>(30);

  // New teacher inputs
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newQuota, setNewQuota] = useState<number>(30);

  // Step 3 / 4 Submission & Invoice State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<{
    id: number;
    invoice_number: string;
    whatsapp_url: string;
    whatsapp_message: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Pre-fill user data if logged in
  useEffect(() => {
    if (user) {
      if (user.full_name && !institutionName) setInstitutionName(`سنتر ${user.full_name}`);
      if (user.phone && !contactPhone) setContactPhone(user.phone);
      if (user.email && !contactEmail) setContactEmail(user.email);
    }
  }, [user]);

  const handleAddExistingTeacher = () => {
    if (!existingUid.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال كود المعلم (Teacher UID)", variant: "destructive" });
      return;
    }
    const newEntry: TeacherEntry = {
      id: `exist-${Date.now()}`,
      type: "existing",
      teacherUid: existingUid.trim().toUpperCase(),
      fullName: `معلم مسجل (${existingUid.trim().toUpperCase()})`,
      email: "",
      subject: existingSubject.trim() || "عام",
      studentQuota: quotaMode === "per_teacher" ? Number(existingQuota) : 0,
    };
    setTeachersList((prev) => [...prev, newEntry]);
    setExistingUid("");
    setExistingSubject("");
    toast({ title: "تم بنجاح", description: "تمت إضافة المعلم إلى قائمة الربط." });
  };

  const handleAddNewTeacher = () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المعلم وبريده الإلكتروني.", variant: "destructive" });
      return;
    }
    const newEntry: TeacherEntry = {
      id: `new-${Date.now()}`,
      type: "new",
      fullName: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      subject: newSubject.trim() || "عام",
      studentQuota: quotaMode === "per_teacher" ? Number(newQuota) : 0,
    };
    setTeachersList((prev) => [...prev, newEntry]);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewSubject("");
    toast({ title: "تم بنجاح", description: "تم تجهيز حساب المعلم الجديد." });
  };

  const handleRemoveTeacher = (id: string) => {
    setTeachersList((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateQuotationAndOpenWhatsApp = async () => {
    setIsSubmitting(true);
    try {
      // 1. Submit quotation to backend to generate unique invoice
      const payload = {
        student_count: studentsCount,
        plan_type: selectedPlanType,
        institution_name: institutionName || "مركز تعليمي",
        contact_phone: contactPhone || "",
        contact_email: contactEmail || "",
        payment_method_note: "InstaPay / Vodafone Cash / Bank",
      };

      const res = await http.post("/finance/academic-pricing/create-quotation/", payload);
      const data = res.data;

      setGeneratedInvoice({
        id: data.id,
        invoice_number: data.invoice_number,
        whatsapp_url: data.whatsapp_url,
        whatsapp_message: data.whatsapp_message,
      });

      setStep(4);

      // 2. Open WhatsApp in new tab
      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      // Fallback: Generate client-side invoice and open WhatsApp anyway!
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const waUrl = generateWhatsAppQuoteUrl(institutionName || "مركز تعليمي", invoiceNumber, quote);
      
      setGeneratedInvoice({
        id: 9999,
        invoice_number: invoiceNumber,
        whatsapp_url: waUrl,
        whatsapp_message: "طلب تفعيل اشتراك سنتر",
      });

      setStep(4);
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyInvoiceNumber = () => {
    if (generatedInvoice) {
      navigator.clipboard.writeText(generatedInvoice.invoice_number);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({ title: "تم النسخ", description: "تم نسخ رقم الفاتورة إلى الحافظة." });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] p-6 max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader className="text-right space-y-2 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold px-3 py-1">
              <Sparkles size={14} className="ml-1.5" />
              محرك التسعير والحسابات الأكاديمي 2026
            </Badge>
            <div className="text-xs font-bold text-muted-foreground">
              الخطوة <span className="text-primary font-mono text-sm">{step}</span> من 4
            </div>
          </div>
          <DialogTitle className="text-2xl font-black text-foreground">
            {step === 1 && "تخصيص باقة السنتر واحتساب الخصم الأكاديمي"}
            {step === 2 && "إدارة وتوزيع حصص المدرسين (Teacher Quotas)"}
            {step === 3 && "مراجعة الفاتورة المبدئية وعرض السعر"}
            {step === 4 && "تأكيد الطلب والتواصل مع الدعم الفني"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {step === 1 && "حدد سعة الطلاب ونوع الخطة للحصول على أفضل سعر وخصم أكاديمي فوري."}
            {step === 2 && "قم بربط أو إنشاء حسابات المدرسين وتوزيع كوتة الطلاب المخصصة لكل مادة."}
            {step === 3 && "راجع ملخص التكلفة، الخصم المطبق، والمدة الزمنية قبل تأكيد الطلب."}
            {step === 4 && "تم إنشاء طلب الفاتورة بنجاح. أرسل إيصال التحويل للدعم الفني للتفعيل الفوري."}
          </DialogDescription>
        </DialogHeader>

        {/* ================= STEP 1: CAPACITY & ACADEMIC PLAN ================= */}
        {step === 1 && (
          <div className="space-y-6 my-2">
            {/* Center Info Input */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/80">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-bold text-muted-foreground">اسم السنتر / المركز *</Label>
                <Input
                  placeholder="مثال: سنتر الأوائل التعليمي"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-bold text-muted-foreground">رقم الهاتف / واتساب *</Label>
                <Input
                  placeholder="010XXXXXXXX"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="rounded-xl text-sm font-mono"
                />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني</Label>
                <Input
                  type="email"
                  placeholder="center@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Student Capacity Slider */}
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Users size={18} className="text-primary" />
                  <span>سعة الطلاب المطلوبة للسنتر:</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-primary font-mono">{studentsCount}</span>
                  <span className="text-xs text-muted-foreground font-bold">طالب</span>
                  <Badge variant="outline" className="font-mono text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                    سعر الطالب: {quote.studentUnitPrice} ج.م / شهر
                  </Badge>
                </div>
              </div>

              <Slider
                value={[studentsCount]}
                onValueChange={(val) => setStudentsCount(val[0])}
                min={50}
                max={2000}
                step={50}
                className="py-3"
              />

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[100, 200, 300, 500, 1000].map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant={studentsCount === count ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStudentsCount(count)}
                    className="rounded-xl text-xs font-bold h-8 px-3"
                  >
                    {count} طالب
                  </Button>
                ))}
              </div>
            </div>

            {/* Academic Plan Selection (Monthly / Term / Full Year) */}
            <div className="space-y-3">
              <Label className="font-bold text-sm text-foreground flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                <span>اختر نوع الخطة الأكاديمية ونسبة الخصم:</span>
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Monthly */}
                <button
                  type="button"
                  onClick={() => setSelectedPlanType("monthly")}
                  className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    selectedPlanType === "monthly"
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-sm ring-2 ring-primary/20"
                      : "bg-card border-border text-muted-foreground hover:border-slate-400"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-sm text-foreground">الاشتراك الشهري</span>
                      <Badge variant="outline" className="text-[10px]">تجديد شهري</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-normal">
                      المدة: شهر واحد فقط (حتى {monthlyQuote.endDate}).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/60 flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">الخصم: 0%</span>
                    <span className="font-black text-foreground text-sm font-mono">
                      {monthlyQuote.monthlyBasePrice.toLocaleString("en-US")} ج.م / شهر
                    </span>
                  </div>
                </button>

                {/* 2. Dynamic Term Plan (10% Discount) */}
                <button
                  type="button"
                  onClick={() => setSelectedPlanType("term")}
                  className={`relative p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    selectedPlanType === "term"
                      ? "bg-emerald-500/10 border-emerald-600 dark:border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-md ring-2 ring-emerald-500/30"
                      : "bg-card border-border text-muted-foreground hover:border-emerald-500/50"
                  }`}
                >
                  <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <Gift size={10} />
                    <span>خصم 10% للترم</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-sm text-foreground">اشتراك الترم الأكاديمي</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-normal">
                      المدة: {termQuote.calculatedMonths} أشهر متبقية (حتى {termQuote.endDate}).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/60 flex justify-between items-baseline">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">خصم 10%</span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300 text-sm font-mono">
                      {termQuote.netTotal.toLocaleString("en-US")} ج.م
                    </span>
                  </div>
                </button>

                {/* 3. Full Academic Year (15% Discount) */}
                <button
                  type="button"
                  onClick={() => setSelectedPlanType("full_year")}
                  className={`relative p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    selectedPlanType === "full_year"
                      ? "bg-teal-500/10 border-teal-600 dark:border-teal-500 text-teal-950 dark:text-teal-200 font-bold shadow-md ring-2 ring-teal-500/30"
                      : "bg-card border-border text-muted-foreground hover:border-teal-500/50"
                  }`}
                >
                  <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-teal-600 to-emerald-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>أعلى توفير 15%</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-sm text-foreground">العام الدراسي الكامل</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-normal">
                      المدة: {fullYearQuote.calculatedMonths} أشهر شاملة (حتى {fullYearQuote.endDate}).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/60 flex justify-between items-baseline">
                    <span className="text-xs text-teal-600 dark:text-teal-400 font-bold">خصم 15%</span>
                    <span className="font-black text-teal-800 dark:text-teal-300 text-sm font-mono">
                      {fullYearQuote.netTotal.toLocaleString("en-US")} ج.م
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-l from-emerald-900 via-teal-900 to-slate-900 text-white shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                    <Receipt size={14} />
                    <span>حساب التكلفة الأكاديمية المباشرة:</span>
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {quote.planTypeLabel} • سعة {quote.studentCount} طالب
                  </div>
                </div>

                <div className="text-left">
                  <div className="text-[11px] text-slate-300">الإجمالي النهائي المستحق:</div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                    {quote.netTotal.toLocaleString("en-US")} <span className="text-xs font-bold text-white">ج.م</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/15 text-[11px]">
                <div>
                  <span className="text-slate-300 block">السعر الشهري الأساسي:</span>
                  <span className="font-mono font-bold">{quote.monthlyBasePrice.toLocaleString("en-US")} ج.م</span>
                </div>
                <div>
                  <span className="text-slate-300 block">المدة المحسوبة:</span>
                  <span className="font-mono font-bold">{formatMonthsArabic(quote.calculatedMonths)}</span>
                </div>
                <div>
                  <span className="text-slate-300 block">قيمة الخصم ({quote.discountPercentage}%):</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {quote.discountAmount > 0 ? `-${quote.discountAmount.toLocaleString("en-US")} ج.م` : "0 ج.م"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-300 block">صالح حتى تاريخ:</span>
                  <span className="font-mono font-bold text-amber-200">{quote.endDate}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => setStep(2)}
                className="gradient-cta text-white font-black rounded-xl gap-2 px-8 py-2.5 shadow-md"
              >
                <span>متابعة لتوزيع حصص المدرسين</span>
                <ArrowLeft size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: TEACHERS & QUOTAS ================= */}
        {step === 2 && (
          <div className="space-y-6 my-2">
            {/* Quota Mode Selector */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
              <Label className="font-bold text-xs text-foreground block">
                كيف ترغب في إدارة كوتة الطلاب بين المدرسين داخل السنتر؟
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQuotaMode("shared")}
                  className={`p-3.5 rounded-xl border text-right transition-all ${
                    quotaMode === "shared"
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  <div className="font-bold text-xs">كوتة موحدة مفتوحة (Shared Pool)</div>
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    جميع المدرسين يتشاركون السعة الإجمالية ({studentsCount} طالب) بحرية.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setQuotaMode("per_teacher")}
                  className={`p-3.5 rounded-xl border text-right transition-all ${
                    quotaMode === "per_teacher"
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  <div className="font-bold text-xs">كوتة محددة لكل مدرس (Per-Teacher Quota)</div>
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    تخصيص حد أقصى للطلاب لكل معلم داخل المركز لمنع التداخل.
                  </div>
                </button>
              </div>
            </div>

            {/* Teacher Addition Tabs */}
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                <span>إضافة وربط المدرسين المبدئيين بالسنتر (اختياري الآن):</span>
              </h3>

              <Tabs defaultValue="existing" className="w-full">
                <TabsList className="grid grid-cols-2 rounded-xl mb-3">
                  <TabsTrigger value="existing" className="text-xs font-bold">
                    مدرس مسجل مسبقاً (Teacher UID)
                  </TabsTrigger>
                  <TabsTrigger value="new" className="text-xs font-bold">
                    مدرس جديد (توليد حساب فوري)
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Existing Teacher */}
                <TabsContent value="existing" className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-xs font-bold text-muted-foreground">كود المعلم (Teacher UID) *</Label>
                      <Input
                        placeholder="مثال: TCH-A8920"
                        value={existingUid}
                        onChange={(e) => setExistingUid(e.target.value)}
                        className="rounded-xl font-mono text-sm uppercase"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-xs font-bold text-muted-foreground">المادة التدريسية</Label>
                      <Input
                        placeholder="مثال: فيزياء 3 ثانوى"
                        value={existingSubject}
                        onChange={(e) => setExistingSubject(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                    {quotaMode === "per_teacher" && (
                      <div className="space-y-1 sm:col-span-1">
                        <Label className="text-xs font-bold text-muted-foreground">كوتة الطلاب المخصصة</Label>
                        <Input
                          type="number"
                          min={5}
                          max={studentsCount}
                          value={existingQuota}
                          onChange={(e) => setExistingQuota(Number(e.target.value))}
                          className="rounded-xl text-sm font-mono"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddExistingTeacher}
                    variant="outline"
                    className="w-full rounded-xl gap-2 font-bold text-xs"
                  >
                    <Plus size={14} />
                    <span>إضافة المعلم للقائمة</span>
                  </Button>
                </TabsContent>

                {/* Tab: New Teacher */}
                <TabsContent value="new" className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">الاسم بالكامل *</Label>
                      <Input
                        placeholder="أحمد محمد السيد"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني *</Label>
                      <Input
                        type="email"
                        placeholder="teacher@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">رقم الهاتف</Label>
                      <Input
                        placeholder="010XXXXXXXX"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="rounded-xl text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground">المادة التدريسية</Label>
                      <Input
                        placeholder="رياضيات، كيمياء..."
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddNewTeacher}
                    variant="outline"
                    className="w-full rounded-xl gap-2 font-bold text-xs text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <Plus size={14} />
                    <span>تجهيز حساب المعلم الجديد</span>
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Added Teachers List Table */}
              {teachersList.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">المعلمون المضافون ({teachersList.length}):</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {teachersList.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/70 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <GraduationCap size={16} className="text-primary shrink-0" />
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-2">
                              <span>{t.fullName}</span>
                              {t.teacherUid && (
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {t.teacherUid}
                                </Badge>
                              )}
                              <Badge className={t.type === "existing" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"}>
                                {t.type === "existing" ? "مسجل مسبقاً" : "حساب جديد"}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              المادة: {t.subject} {t.studentQuota > 0 && `| الكوتة: ${t.studentQuota} طالب`}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveTeacher(t.id)}
                          className="text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="rounded-xl gap-2">
                <ArrowRight size={16} />
                <span>رجوع</span>
              </Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                className="gradient-cta text-white font-bold rounded-xl gap-2 px-6"
              >
                <span>متابعة لعرض السعر والفاتورة</span>
                <ArrowLeft size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: REVIEW & INVOICE BREAKDOWN ================= */}
        {step === 3 && (
          <div className="space-y-6 my-2">
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <h3 className="font-black text-base text-foreground flex items-center gap-2">
                    <Building2 className="text-primary" size={20} />
                    <span>{institutionName || "مركز تعليمي"}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    عرض سعر اشتراك السنتر الأكاديمي المعتمد
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white font-bold px-3 py-1">
                  خصم {quote.discountPercentage}%
                </Badge>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[10px]">سعة الطلاب</span>
                  <span className="font-bold text-foreground text-sm font-mono">{quote.studentCount} طالب</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[10px]">الشرائح المحسوبة</span>
                  <span className="font-bold text-foreground text-sm font-mono">{quote.studentTiers} شرائح</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[10px]">نوع الخطة</span>
                  <span className="font-bold text-foreground text-sm">{quote.planTypeLabel}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[10px]">صلاحية الاشتراك</span>
                  <span className="font-bold text-foreground text-sm font-mono">{quote.endDate}</span>
                </div>
              </div>

              {/* Financial Calculation Table */}
              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>سعر الشريحة الأساسي ({quote.studentUnitPrice} ج.م / طالب / شهر):</span>
                  <span className="font-mono font-bold">{quote.monthlyBasePrice.toLocaleString("en-US")} ج.م / شهر</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>إجمالي المدة قبل الخصم ({formatMonthsArabic(quote.calculatedMonths)}):</span>
                  <span className="font-mono font-bold">{quote.grossAmount.toLocaleString("en-US")} ج.م</span>
                </div>
                {quote.discountPercentage > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>قيمة الخصم الأكاديمي المطبق ({quote.discountPercentage}%):</span>
                    <span className="font-mono">-{quote.discountAmount.toLocaleString("en-US")} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-foreground pt-3 border-t border-dashed">
                  <span className="text-base">الإجمالي الصافي النهائي للدفع:</span>
                  <span className="font-mono text-xl text-primary font-black">
                    {quote.netTotal.toLocaleString("en-US")} جنيه مصري
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method Notice */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
              <div className="font-bold flex items-center gap-2 text-sm">
                <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-400" />
                <span>طريقة الدفع والتفعيل المعتمدة:</span>
              </div>
              <p className="leading-relaxed">
                يتم تأكيد الطلب فوراً عبر التواصل مع الدعم الفني على واتساب وإرسال إيصال التحويل عبر (إنستاباي / فودافون كاش / تحويل بنكي). يتم التفعيل التلقائي لحساب السنتر والمدرسين في أقل من 5 دقائق.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="rounded-xl gap-2">
                <ArrowRight size={16} />
                <span>رجوع</span>
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleCreateQuotationAndOpenWhatsApp}
                className="gradient-cta text-white font-black rounded-xl gap-2 px-8 py-3 text-sm shadow-lg hover:shadow-emerald-500/20"
              >
                <MessageCircle size={18} />
                <span>
                  {isSubmitting ? "جاري إنشاء الفاتورة..." : "تأكيد الطلب والدفع عبر واتساب / الدعم"}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: SUCCESS & WHATSAPP REDIRECT ================= */}
        {step === 4 && generatedInvoice && (
          <div className="space-y-6 my-4 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground">تم تجهيز طلب الفاتورة بنجاح!</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                تم إنشاء رقم الفاتورة المرجعي وتجهيز رسالة الدفع الرسمية للتواصل مع فريق الدعم الفني.
              </p>
            </div>

            {/* Invoice Reference Card */}
            <div className="p-5 rounded-2xl bg-muted/50 border border-border text-center space-y-3 max-w-md mx-auto">
              <span className="text-xs text-muted-foreground font-bold block">رقم الفاتورة المرجعي:</span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-mono font-black text-primary tracking-wider">
                  #{generatedInvoice.invoice_number}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyInvoiceNumber}
                  className="h-8 rounded-lg gap-1.5 text-xs font-bold"
                >
                  {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{isCopied ? "تم النسخ" : "نسخ"}</span>
                </Button>
              </div>

              <div className="pt-2 border-t border-border/80 text-xs text-muted-foreground flex justify-between">
                <span>المبلغ المطلوب للتحويل:</span>
                <span className="font-black text-foreground font-mono text-sm">
                  {quote.netTotal.toLocaleString("en-US")} ج.م
                </span>
              </div>
            </div>

            {/* Support Contact Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <a
                href={generatedInvoice.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex-1"
              >
                <Button className="w-full h-12 bg-[#25D366] hover:bg-[#20ba59] text-white font-black rounded-xl gap-2 shadow-md">
                  <MessageCircle size={18} />
                  <span>فتح محادثة واتساب الآن</span>
                </Button>
              </a>

              <a href={`tel:${SUPPORT_WHATSAPP_NUMBER}`} className="w-full sm:w-auto">
                <Button variant="outline" className="w-full h-12 rounded-xl gap-2 font-bold text-xs">
                  <Phone size={16} />
                  <span>اتصال: {SUPPORT_WHATSAPP_NUMBER}</span>
                </Button>
              </a>
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onClose();
                  navigate("/center/students");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                العودة إلى لوحة تحكم السنتر
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
