import React, { useState, useMemo } from "react";
import {
  KeyRound,
  PlusCircle,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Copy,
  ExternalLink,
  GraduationCap,
  Sparkles,
  Send,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  useBatches,
  useQuota,
  useActivationCodes,
  useCenterQuotaRequests,
  useGenerateBatch,
  useCreateCenterQuotaRequest,
  useExtendBatchShelfLife,
  ActivationCodeItem,
  ActivationCodeBatch,
  CenterQuotaRequest,
} from "@/features/activation-codes";
import { useCenterInstructors, type CenterInstructorItem } from "@/features/center";

export default function CenterActivationCodes() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"codes" | "batches" | "requests">("codes");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInstructorFilter, setSelectedInstructorFilter] = useState<string>("all");

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isQuotaRequestModalOpen, setIsQuotaRequestModalOpen] = useState(false);
  const [selectedBatchForExtension, setSelectedBatchForExtension] = useState<ActivationCodeBatch | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(30);
  const [showPins, setShowPins] = useState<Record<number, boolean>>({});

  // Form states
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>("");
  const [generateQuantity, setGenerateQuantity] = useState<number>(10);
  const [shelfLifeDays, setShelfLifeDays] = useState<string>("90");
  const [accessDurationType, setAccessDurationType] = useState<string>("lifetime");
  const [fixedAccessUntil, setFixedAccessUntil] = useState<string>("");
  const [requestQuantity, setRequestQuantity] = useState<number>(50);
  const [requestReason, setRequestReason] = useState<string>("");

  // Data fetching
  const { data: quota, isLoading: isQuotaLoading } = useQuota();
  const { data: rawBatches, isLoading: isBatchesLoading } = useBatches();
  const { data: rawCodes, isLoading: isCodesLoading } = useActivationCodes();
  const { data: rawQuotaRequests, isLoading: isRequestsLoading } = useCenterQuotaRequests();
  const { data: rawInstructors, isLoading: isInstructorsLoading } = useCenterInstructors();

  const batches = useMemo<ActivationCodeBatch[]>(() => {
    if (Array.isArray(rawBatches)) return rawBatches;
    if (rawBatches && Array.isArray((rawBatches as any).results)) return (rawBatches as any).results;
    if (rawBatches && Array.isArray((rawBatches as any).data)) return (rawBatches as any).data;
    return [];
  }, [rawBatches]);

  const codes = useMemo<ActivationCodeItem[]>(() => {
    if (Array.isArray(rawCodes)) return rawCodes;
    if (rawCodes && Array.isArray((rawCodes as any).results)) return (rawCodes as any).results;
    if (rawCodes && Array.isArray((rawCodes as any).data)) return (rawCodes as any).data;
    return [];
  }, [rawCodes]);

  const quotaRequests = useMemo<CenterQuotaRequest[]>(() => {
    if (Array.isArray(rawQuotaRequests)) return rawQuotaRequests;
    if (rawQuotaRequests && Array.isArray((rawQuotaRequests as any).results)) return (rawQuotaRequests as any).results;
    if (rawQuotaRequests && Array.isArray((rawQuotaRequests as any).data)) return (rawQuotaRequests as any).data;
    return [];
  }, [rawQuotaRequests]);

  const instructors = useMemo<CenterInstructorItem[]>(() => {
    if (Array.isArray(rawInstructors)) return rawInstructors;
    if (rawInstructors && Array.isArray((rawInstructors as any).results)) return (rawInstructors as any).results;
    if (rawInstructors && Array.isArray((rawInstructors as any).data)) return (rawInstructors as any).data;
    return [];
  }, [rawInstructors]);

  // Mutations
  const generateBatchMutation = useGenerateBatch();
  const createQuotaRequestMutation = useCreateCenterQuotaRequest();
  const extendShelfLifeMutation = useExtendBatchShelfLife();

  const availableQuota = quota?.available ?? 0;
  const maxLimit = quota?.maxLimit ?? 50;
  const activeInstructors = useMemo(() => instructors.filter((ins) => Boolean(ins?.is_active ?? (ins as any)?.isActive)), [instructors]);
  const filteredCodes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ar");
    return codes.filter((code) => {
      if (statusFilter !== "all" && code.displayStatus !== statusFilter) return false;
      if (
        selectedInstructorFilter !== "all" &&
        code.targetInstructorName !== selectedInstructorFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [
        code.code,
        code.targetInstructorName,
        code.redeemedByName,
        code.redeemedByEmail,
      ].some((value) => String(value || "").toLocaleLowerCase("ar").includes(query));
    });
  }, [codes, searchQuery, selectedInstructorFilter, statusFilter]);

  const togglePinVisibility = (codeId: number) => {
    setShowPins((current) => ({ ...current, [codeId]: !current[codeId] }));
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "تم نسخ الكود", description: "يمكنك مشاركته الآن مع الطالب." });
    } catch {
      toast({
        title: "تعذر النسخ التلقائي",
        description: "حدد الكود وانسخه يدويًا من الجدول.",
        variant: "destructive",
      });
    }
  };

  const renderSubscriptionTypeBadge = (batch: ActivationCodeBatch) => {
    const duration = batch?.accessDurationDays ?? batch?.access_duration_days;
    const fixedUntil = batch?.fixedAccessUntil ?? batch?.fixed_access_until;

    if (fixedUntil) {
      return (
        <Badge variant="outline" className="bg-purple-950 text-purple-300 border-purple-800 text-xs font-mono">
          حتى {new Date(fixedUntil).toLocaleDateString("ar-EG")}
        </Badge>
      );
    }
    if (duration === 30) {
      return (
        <Badge variant="outline" className="bg-blue-950 text-blue-300 border-blue-800 text-xs font-medium">
          شهري (30 يوم)
        </Badge>
      );
    }
    if (duration === 120) {
      return (
        <Badge variant="outline" className="bg-amber-950 text-amber-300 border-amber-800 text-xs font-medium">
          ترم (120 يوم)
        </Badge>
      );
    }
    if (duration && Number(duration) > 0) {
      return (
        <Badge variant="outline" className="bg-indigo-950 text-indigo-300 border-indigo-800 text-xs font-medium">
          {duration} يوم
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-950 text-emerald-300 border-emerald-800 text-xs font-medium">
        دائم
      </Badge>
    );
  };

  const renderBatchExpiry = (batch: ActivationCodeBatch) => {
    const expiryStr = batch?.expiresAt || batch?.expires_at;
    const isExpired = Boolean(
      batch?.isExpired ??
      batch?.is_expired ??
      (expiryStr ? new Date(expiryStr).getTime() < Date.now() : false)
    );

    if (isExpired) {
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className="bg-red-950 text-red-400 border-red-800 text-[11px] w-fit">
            منتهي الصلاحية
          </Badge>
          {expiryStr && (
            <span className="text-[10px] text-slate-500 font-mono">
              انتهى في {new Date(expiryStr).toLocaleDateString("ar-EG")}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-slate-300 font-medium">
          {expiryStr ? `صالح حتى ${new Date(expiryStr).toLocaleDateString("ar-EG")}` : "صالح"}
        </span>
        <span className="text-[10px] text-emerald-400 font-medium">
          نشط للطباعة والتوزيع
        </span>
      </div>
    );
  };

  // Submit batch generation
  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeInstructors.length === 0) {
      toast({
        title: "غير مسموح",
        description: "يجب إضافة واعتماد معلم واحد على الأقل قبل توليد الأكواد.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedInstructorId) {
      toast({
        title: "اختر المعلم",
        description: "يرجى تحديد المعلم المستهدف الذي ستخصص له هذه الأكواد.",
        variant: "destructive",
      });
      return;
    }

    if (accessDurationType === "fixed_date" && !fixedAccessUntil) {
      toast({
        title: "تاريخ الانتهاء مطلوب",
        description: "يرجى تحديد تاريخ انتهاء الاشتراك المحدد للكورس.",
        variant: "destructive",
      });
      return;
    }

    if (generateQuantity > availableQuota) {
      toast({
        title: "تجاوز الكوتة المتاحة",
        description: `الكمية المطلوبة (${generateQuantity}) تتجاوز الكوتة المتبقية (${availableQuota}). يرجى تقديم طلب زيادة كوتة.`,
        variant: "destructive",
      });
      setIsGenerateModalOpen(false);
      setIsQuotaRequestModalOpen(true);
      return;
    }

    let accessDurationDays: number | null = null;
    let fixedAccessUntilVal: string | null = null;

    if (accessDurationType === "30") {
      accessDurationDays = 30;
    } else if (accessDurationType === "120") {
      accessDurationDays = 120;
    } else if (accessDurationType === "fixed_date") {
      fixedAccessUntilVal = fixedAccessUntil || null;
    }

    try {
      const res = await generateBatchMutation.mutateAsync({
        batch_type: "center_student",
        quantity: Number(generateQuantity),
        target_instructor_id: Number(selectedInstructorId),
        shelf_life_days: Number(shelfLifeDays) || 90,
        access_duration_days: accessDurationDays,
        fixed_access_until: fixedAccessUntilVal,
      });

      toast({
        title: "تم توليد الأكواد بنجاح 🎉",
        description: `تم إنشاء الدفعة وربطها بالمعلم المحدد.`,
      });

      setIsGenerateModalOpen(false);
      setSelectedInstructorId("");
      setGenerateQuantity(10);
      setShelfLifeDays("90");
      setAccessDurationType("lifetime");
      setFixedAccessUntil("");

      if (res.pdf_url) {
        window.open(res.pdf_url, "_blank");
      }
    } catch (err: any) {
      toast({
        title: "خطأ في التوليد",
        description: err?.message || "تعذر توليد الدفعة، تأكد من صحة البيانات.",
        variant: "destructive",
      });
    }
  };

  // Submit Shelf-Life Extension
  const handleExtendShelfLife = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForExtension) return;

    try {
      const res = await extendShelfLifeMutation.mutateAsync({
        batchId: selectedBatchForExtension.id,
        additionalDays: Number(extensionDays),
      });

      toast({
        title: "تم تمديد صلاحية الدفعة بنجاح 🎉",
        description: res?.message || `تم تمديد صلاحية كروت الدفعة #${selectedBatchForExtension.id} بمقدار ${extensionDays} يوماً.`,
      });

      setSelectedBatchForExtension(null);
      setExtensionDays(30);
    } catch (err: any) {
      toast({
        title: "فشل تمديد الصلاحية",
        description: err?.response?.data?.error || err?.response?.data?.detail || err?.message || "حدث خطأ أثناء تمديد الصلاحية.",
        variant: "destructive",
      });
    }
  };

  // Submit Quota Request
  const handleCreateQuotaRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requestQuantity || requestQuantity <= 0) {
      toast({
        title: "كمية غير صالحة",
        description: "يرجى تحديد عدد أكواد أكبر من الصفر.",
        variant: "destructive",
      });
      return;
    }

    if (!requestReason.trim()) {
      toast({
        title: "سبب الطلب مطلوب",
        description: "يرجى توضيح سبب الحاجة إلى زيادة الكوتة للإدارة.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createQuotaRequestMutation.mutateAsync({
        requested_quantity: Number(requestQuantity),
        reason: requestReason,
      });

      toast({
        title: "تم إرسال طلب الاعتماد بنجاح",
        description: "سيقوم مسؤول المنصة بمراجعة الطلب والموافقة عليه في أقرب وقت.",
      });

      setIsQuotaRequestModalOpen(false);
      setRequestReason("");
      setActiveTab("requests");
    } catch (err: any) {
      toast({
        title: "فشل إرسال الطلب",
        description: err?.message || "حدث خطأ أثناء إرسال طلب الكوتة.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-6 rounded-2xl border border-blue-800/40 shadow-lg">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <KeyRound className="w-8 h-8 text-blue-400" />
            أكواد التفعيل المخصصة
          </h1>
          <p className="text-blue-200/80 mt-1 text-sm">
            توليد وتوزيع أكواد السنتر المربوطة بمدرسي المركز، ومتابعة حالات التفعيل اللحظية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              if (activeInstructors.length === 0) {
                toast({
                  title: "شرط أساسي",
                  description: "يجب إضافة معلم واحد على الأقل للمركز قبل توليد الأكواد.",
                  variant: "destructive",
                });
                return;
              }
              setIsGenerateModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md shadow-blue-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            توليد دفعة جديدة
          </Button>

          <Button
            onClick={() => setIsQuotaRequestModalOpen(true)}
            variant="outline"
            className="border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            طلب زيادة كوتة
          </Button>
        </div>
      </div>

      {/* Quota Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">إجمالي سعة الكوتة المعتمدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-white font-mono">{maxLimit} كود</div>
            <p className="text-xs text-slate-400 mt-1">تشمل رصيد التجربة المجانية والطلبات المعتمدة</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">الكوتة المتاحة للتوليد حالياً</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{availableQuota} كود</div>
            <p className="text-xs text-slate-400 mt-1">الأكواد المتبقية التي يمكنك توليدها الآن</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">المدرسين المتاحين للربط</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">
              {activeInstructors.length} مدرسين
            </div>
            <p className="text-xs text-slate-400 mt-1">كل دفعة أكواد تخصص لمدرس محدد حصراً</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="codes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-2">
            <KeyRound className="w-4 h-4" />
            قائمة الأكواد ({codes.length})
          </TabsTrigger>
          <TabsTrigger value="batches" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-2">
            <FileText className="w-4 h-4" />
            الدفعات والـ PDF ({batches.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-2">
            <Sparkles className="w-4 h-4" />
            طلبات اعتماد الكوتة ({quotaRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INDIVIDUAL CODES LIST */}
        <TabsContent value="codes" className="space-y-4">
          {/* Filters Bar */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="بحث بالكود، اسم الطالب، أو اسم المعلم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-slate-950 border-slate-800 text-white">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="active">نشط (غير مستخدم)</SelectItem>
                    <SelectItem value="redeemed">مستخدَم</SelectItem>
                    <SelectItem value="expired">منتهي الصلاحية</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedInstructorFilter} onValueChange={setSelectedInstructorFilter}>
                  <SelectTrigger className="w-[170px] bg-slate-950 border-slate-800 text-white">
                    <SelectValue placeholder="تصفية بالمعلم" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">جميع المعلمين</SelectItem>
                    {activeInstructors.map((ins) => (
                      <SelectItem key={ins.id} value={ins.instructor_name}>
                        {ins.instructor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Codes Table */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-right text-slate-400">الكود</TableHead>
                      <TableHead className="text-right text-slate-400">رمز المرور (PIN)</TableHead>
                      <TableHead className="text-right text-slate-400">المعلم المستهدف</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-right text-slate-400">المستخدم (الطالب)</TableHead>
                      <TableHead className="text-right text-slate-400">تاريخ التفعيل</TableHead>
                      <TableHead className="text-left text-slate-400">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCodes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                          لا توجد أكواد مطابقة لخيارات البحث الحالية.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCodes.map((code) => (
                        <TableRow key={code.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="font-mono font-bold text-blue-300">
                            <span className="bg-blue-950/80 border border-blue-800/60 px-2.5 py-1 rounded-lg">
                              {code.code}
                            </span>
                          </TableCell>

                          <TableCell className="font-mono text-slate-300">
                            <div className="flex items-center gap-2">
                              <span>{showPins[code.id] ? code.password : "••••••"}</span>
                              <button
                                onClick={() => togglePinVisibility(code.id)}
                                className="text-slate-500 hover:text-slate-300"
                              >
                                {showPins[code.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </TableCell>

                          <TableCell className="text-slate-200">
                            <span className="flex items-center gap-1.5 font-medium">
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                              {code.targetInstructorName || "عام"}
                            </span>
                          </TableCell>

                          <TableCell>
                            {code.displayStatus === "redeemed" ? (
                              <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1 inline" /> مستخدم
                              </Badge>
                            ) : code.displayStatus === "expired" ? (
                              <Badge className="bg-red-950 text-red-400 border-red-800 text-xs">
                                منتهي الصلاحية
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-950 text-blue-400 border-blue-800 text-xs">
                                نشط (متاح)
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-slate-300 text-xs">
                            {code.redeemedByName ? (
                              <div>
                                <div className="font-medium text-white">{code.redeemedByName}</div>
                                <div className="text-slate-500 text-[11px] font-mono">{code.redeemedByEmail}</div>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-slate-400 text-xs font-mono">
                            {code.redeemedAt
                              ? new Date(code.redeemedAt).toLocaleDateString("ar-EG")
                              : "—"}
                          </TableCell>

                          <TableCell className="text-left">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyCode(code.code)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                              title="نسخ الكود"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: BATCHES & PDF EXPORT */}
        <TabsContent value="batches" className="space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-right text-slate-400">رقم الدفعة</TableHead>
                    <TableHead className="text-right text-slate-400">المعلم المستهدف</TableHead>
                    <TableHead className="text-right text-slate-400">الكمية</TableHead>
                    <TableHead className="text-right text-slate-400">المفعّلة / النشطة</TableHead>
                    <TableHead className="text-right text-slate-400">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right text-slate-400">نوع الاشتراك</TableHead>
                    <TableHead className="text-right text-slate-400">صلاحية الدفعة</TableHead>
                    <TableHead className="text-left text-slate-400">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        لم يتم توليد أي دفعات بعد. اضغط "توليد دفعة جديدة" للبدء.
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((b) => (
                      <TableRow key={b.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="font-mono text-white font-bold">#{b.id}</TableCell>
                        <TableCell className="font-medium text-slate-200">
                          {b.targetInstructorName || "معلم السنتر"}
                        </TableCell>
                        <TableCell className="font-mono text-slate-300">{b.quantity} كود</TableCell>
                        <TableCell>
                          <span className="text-emerald-400 font-mono font-bold">{b.redeemedCount}</span>
                          <span className="text-slate-500"> / {b.quantity}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 font-mono">
                          {new Date(b.createdAt).toLocaleDateString("ar-EG")}
                        </TableCell>
                        <TableCell>
                          {renderSubscriptionTypeBadge(b)}
                        </TableCell>
                        <TableCell>
                          {renderBatchExpiry(b)}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBatchForExtension(b)}
                              className="h-8 text-xs border-amber-800/60 text-amber-300 hover:bg-amber-900/40 gap-1.5"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              تمديد الصلاحية
                            </Button>
                            {b.pdfFile ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(b.pdfFile!, "_blank")}
                                className="h-8 text-xs border-blue-800/60 text-blue-300 hover:bg-blue-900/40 gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5" />
                                تحميل PDF
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-500">جاري المعالجة</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: QUOTA APPROVAL REQUESTS */}
        <TabsContent value="requests" className="space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-right text-slate-400">رقم الطلب</TableHead>
                    <TableHead className="text-right text-slate-400">الكمية المطلوبة</TableHead>
                    <TableHead className="text-right text-slate-400">سبب الطلب</TableHead>
                    <TableHead className="text-right text-slate-400">الحالة</TableHead>
                    <TableHead className="text-right text-slate-400">تاريخ التقديم</TableHead>
                    <TableHead className="text-right text-slate-400">ملاحظات الإدارة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotaRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        لا توجد طلبات اعتماد كوتة حالياً. يمكنك تقديم طلب جديد عند الحاجة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    quotaRequests.map((req) => (
                      <TableRow key={req.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="font-mono text-white font-bold">#{req.id}</TableCell>
                        <TableCell className="font-mono text-amber-400 font-bold">
                          +{req.requestedQuantity} كود
                        </TableCell>
                        <TableCell className="text-slate-300 text-xs max-w-xs truncate">{req.reason}</TableCell>
                        <TableCell>
                          {req.status === "approved" ? (
                            <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-xs">
                              تمت الموافقة 🎉
                            </Badge>
                          ) : req.status === "rejected" ? (
                            <Badge className="bg-red-950 text-red-400 border-red-800 text-xs">
                              تم الرفض
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-950 text-amber-400 border-amber-800 text-xs">
                              قيد مراجعة السوبر أدمن ⏳
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 font-mono">
                          {new Date(req.createdAt).toLocaleDateString("ar-EG")}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {req.adminNotes || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: GENERATE BATCH MODAL */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-400" />
              توليد دفعة أكواد تفعيل جديدة
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              حدد المعلم والكمية المطلوبة. سيتم تخصيص الأكواد لمقررات المعلم المعتمدة فقط.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateBatch} className="space-y-4 mt-2">
            {/* Target Instructor Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                المعلم المستهدف (إلزامي) <span className="text-red-400">*</span>
              </label>
              <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                  <SelectValue placeholder="اختر المعلم المستهدف..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {activeInstructors.map((ins) => (
                    <SelectItem key={ins.instructor_id} value={ins.instructor_id.toString()}>
                      {ins.instructor_name} ({ins.subject || "عام"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                الأكواد الصادرة ستسمح للطالب بالانضمام لكورسات هذا المعلم دون غيره.
              </p>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-300">عدد الأكواد المطلوبة</label>
                <span className="text-amber-400 font-mono">الكوتة المتاحة: {availableQuota} كود</span>
              </div>
              <Input
                type="number"
                min={1}
                max={availableQuota > 0 ? availableQuota : 1}
                value={generateQuantity}
                onChange={(e) => setGenerateQuantity(Number(e.target.value))}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            {/* Shelf Life Section */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <label className="text-xs font-semibold text-slate-300">
                  صلاحية شحن الكروت المطبوعة (Shelf Life)
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                الفترة المتاحة لتوزيع الكرت واستخدامه من قبل الطالب قبل انتهاء صلاحية الكود.
              </p>
              <Select value={shelfLifeDays} onValueChange={setShelfLifeDays} disabled={availableQuota <= 0}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                  <SelectValue placeholder="اختر مدة صلاحية الكرت" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="30">30 يوماً</SelectItem>
                  <SelectItem value="60">60 يوماً</SelectItem>
                  <SelectItem value="90">90 يوماً (الافتراضي والموصى به)</SelectItem>
                  <SelectItem value="180">180 يوماً</SelectItem>
                  <SelectItem value="365">365 يوماً (سنة كاملة)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Course Access Duration Section */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <label className="text-xs font-semibold text-slate-300">
                  صلاحية اشتراك الطالب في الكورس (Course Access Duration)
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                تحديد مدة وصول الطالب لمحتوى الكورس بعد تفعيل الكود بنجاح.
              </p>
              <Select value={accessDurationType} onValueChange={setAccessDurationType} disabled={availableQuota <= 0}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                  <SelectValue placeholder="اختر مدة الاشتراك" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="lifetime">وصول دائم مدى الحياة (Lifetime Access)</SelectItem>
                  <SelectItem value="30">اشتراك شهري (30 يوماً) - مناسب لحصص ومذكرات الشهر</SelectItem>
                  <SelectItem value="120">اشتراك فصل دراسي (120 يوماً) - للترم الدراسي</SelectItem>
                  <SelectItem value="fixed_date">تاريخ نهاية محدد (موعد نهاية السنة الدراسية)</SelectItem>
                </SelectContent>
              </Select>

              {accessDurationType === "fixed_date" && (
                <div className="space-y-1 pt-1 animate-in fade-in">
                  <label className="text-[11px] flex items-center gap-1.5 text-slate-300">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    تاريخ انتهاء الوصول المحدد:
                  </label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={fixedAccessUntil}
                    onChange={(e) => setFixedAccessUntil(e.target.value)}
                    required
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              )}
            </div>

            {availableQuota <= 0 && (
              <div className="p-3 bg-amber-950/50 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-center justify-between">
                <span>نفدت الكوتة المتاحة لديك حالياً.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setIsQuotaRequestModalOpen(true);
                  }}
                  className="h-7 text-xs border-amber-700 text-amber-300"
                >
                  طلب زيادة كوتة
                </Button>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsGenerateModalOpen(false)}
                className="border-slate-800 text-slate-400 hover:text-white"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={
                  generateBatchMutation.isPending ||
                  availableQuota <= 0 ||
                  (accessDurationType === "fixed_date" && !fixedAccessUntil)
                }
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {generateBatchMutation.isPending ? "جاري التوليد..." : "توليد وطباعة الأكواد"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: REQUEST QUOTA INCREASE MODAL */}
      <Dialog open={isQuotaRequestModalOpen} onOpenChange={setIsQuotaRequestModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              طلب اعتماد كوتة أكواد إضافية
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              إذا كنت بحاجة إلى أكواد إضافية فوق رصيدك التجريبي، يمكنك إرسال طلب لاعتماد كوتة جديدة من إدارة المنصة.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateQuotaRequest} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الكمية الإضافية المطلوبة (كود)</label>
              <Input
                type="number"
                min={10}
                step={10}
                value={requestQuantity}
                onChange={(e) => setRequestQuantity(Number(e.target.value))}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">سبب طلب الزيادة <span className="text-red-400">*</span></label>
              <Textarea
                placeholder="مثال: زيادة عدد الطلاب المنضمين لدورة الفيزياء، أو فتح فرع جديد..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={3}
                className="bg-slate-950 border-slate-800 text-white text-xs resize-none"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuotaRequestModalOpen(false)}
                className="border-slate-800 text-slate-400 hover:text-white"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={createQuotaRequestMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {createQuotaRequestMutation.isPending ? "جاري الإرسال..." : "إرسال طلب الاعتماد"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EXTEND BATCH SHELF-LIFE MODAL */}
      <Dialog
        open={Boolean(selectedBatchForExtension)}
        onOpenChange={(open) => {
          if (!open) setSelectedBatchForExtension(null);
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              تمديد صلاحية شحن الدفعة #{selectedBatchForExtension?.id}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              تمديد تاريخ انتهاء صلاحية شحن الكروت غير المستخدمة في هذه الدفعة قبل إتلافها أو إيقافها.
            </DialogDescription>
          </DialogHeader>

          {selectedBatchForExtension && (
            <form onSubmit={handleExtendShelfLife} className="space-y-4 py-2">
              <div className="bg-slate-950/60 p-3 rounded-lg space-y-1.5 text-xs border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">صلاحية الدفعة الحالية:</span>
                  <span className="font-mono font-bold text-white">
                    {selectedBatchForExtension.expiresAt || selectedBatchForExtension.expires_at
                      ? new Date(String(selectedBatchForExtension.expiresAt || selectedBatchForExtension.expires_at)).toLocaleDateString("ar-EG")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الأكواد النشطة غير المستخدمة:</span>
                  <span className="font-mono font-bold text-blue-400">
                    {selectedBatchForExtension.activeCount ?? selectedBatchForExtension.active_count ?? 0} كود
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">فترة التمديد الإضافية</label>
                <Select
                  value={String(extensionDays)}
                  onValueChange={(val) => setExtensionDays(Number(val))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue placeholder="اختر مدة التمديد" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="30">+30 يوماً إضافية (شهر)</SelectItem>
                    <SelectItem value="60">+60 يوماً إضافية (شهران)</SelectItem>
                    <SelectItem value="90">+90 يوماً إضافية (فصل دراسي)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">
                  سيتم ترحيل تاريخ انتهاء الصلاحية بمقدار المدة المحددة لجميع الأكواد غير المفعلة في هذه الدفعة.
                </p>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedBatchForExtension(null)}
                  disabled={extendShelfLifeMutation.isPending}
                  className="border-slate-800 text-slate-400 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={extendShelfLifeMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
                >
                  {extendShelfLifeMutation.isPending ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  تأكيد التمديد الآن
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
