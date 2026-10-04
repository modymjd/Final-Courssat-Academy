import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTable } from "@/components/super-admin/ResponsiveTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { superAdminGet, superAdminPost } from "@/lib/superAdminHttp";
import {
  normalizeQuotaRequest,
  useSuperAdminReviewQuotaRequest,
  useSuperAdminQuickGrantQuota,
  useSuperAdminUpdateContract,
  CenterQuotaRequest,
  QuotaContract,
} from "@/features/activation-codes";
import { formatDate } from "@/lib/format";
import {
  ShieldCheck,
  Ticket,
  Plus,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  PowerOff,
  Building2,
  GraduationCap,
  TrendingUp,
  BarChart3,
  Layers,
  MessageSquare,
  Send,
  Zap,
  Check,
  X,
} from "lucide-react";

interface ManagedOwner {
  id: number;
  email: string;
  fullName?: string;
  full_name?: string;
  role: "instructor" | "center";
}

interface NewContractForm {
  owner: string;
  monthly_code_limit: string;
  billing_unit_size: string;
  price_per_billing_unit: string;
  currency: string;
  effective_from: string;
  notes: string;
}

const emptyNewContractForm: NewContractForm = {
  owner: "",
  monthly_code_limit: "",
  billing_unit_size: "100",
  price_per_billing_unit: "",
  currency: "EGP",
  effective_from: new Date().toISOString().slice(0, 10),
  notes: "",
};

function unwrapList<T>(payload: T[] | { results?: T[]; data?: T[] }): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.results ?? payload?.data ?? [];
}

function safeFormatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return formatDate(dateStr);
  } catch {
    return String(dateStr);
  }
}

export default function SuperAdminQuotaContracts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"contracts" | "requests">("contracts");

  // Filters - Contracts
  const [contractSearch, setContractSearch] = useState("");
  const [contractRoleFilter, setContractRoleFilter] = useState<"all" | "center" | "instructor">("all");
  const [contractStatusFilter, setContractStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Filters - Quota Requests
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Modals state
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [isQuickGrantModalOpen, setIsQuickGrantModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<QuotaContract | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<{
    request: CenterQuotaRequest;
    action: "approve" | "reject";
  } | null>(null);

  // Forms state
  const [newContractForm, setNewContractForm] = useState<NewContractForm>(emptyNewContractForm);
  const [quickGrantOwner, setQuickGrantOwner] = useState<string>("");
  const [quickGrantMode, setQuickGrantMode] = useState<"additional" | "new_limit">("additional");
  const [quickGrantQuantity, setQuickGrantQuantity] = useState<number>(50);
  const [quickGrantPrice, setQuickGrantPrice] = useState<string>("");
  const [quickGrantUnitSize, setQuickGrantUnitSize] = useState<number>(100);
  const [quickGrantNotes, setQuickGrantNotes] = useState<string>("");

  // Edit Contract Form state
  const [editMonthlyLimit, setEditMonthlyLimit] = useState<number>(0);
  const [editPricePerUnit, setEditPricePerUnit] = useState<string>("");
  const [editUnitSize, setEditUnitSize] = useState<number>(100);
  const [editNotes, setEditNotes] = useState<string>("");
  const [editEffectiveTo, setEditEffectiveTo] = useState<string>("");

  // Review Admin Notes state
  const [reviewAdminNotes, setReviewAdminNotes] = useState<string>("");

  // Mutations from activation-codes hooks
  const reviewMutation = useSuperAdminReviewQuotaRequest();
  const quickGrantMutation = useSuperAdminQuickGrantQuota();
  const updateContractMutation = useSuperAdminUpdateContract();

  // Fetch Owners (Instructors + Centers)
  const ownersQuery = useQuery({
    queryKey: ["super-admin-quota-owners"],
    queryFn: async () => {
      const [instructors, centers] = await Promise.all([
        superAdminGet<ManagedOwner[] | { results?: ManagedOwner[]; data?: ManagedOwner[] }>(
          "/super-admin/users/?role=instructor"
        ),
        superAdminGet<ManagedOwner[] | { results?: ManagedOwner[]; data?: ManagedOwner[] }>(
          "/super-admin/users/?role=center"
        ),
      ]);
      return [...unwrapList(instructors), ...unwrapList(centers)];
    },
    staleTime: 60_000,
  });

  // Fetch Quota Contracts
  const contractsQuery = useQuery({
    queryKey: ["super-admin-quota-contracts"],
    queryFn: () =>
      superAdminGet<QuotaContract[] | { results?: QuotaContract[]; data?: QuotaContract[] }>(
        "/super-admin/quota-contracts/"
      ),
  });

  // Fetch Quota Periods (to map live generated and available counts per contract)
  const periodsQuery = useQuery({
    queryKey: ["super-admin-quota-periods"],
    queryFn: () =>
      superAdminGet<any[] | { results?: any[]; data?: any[] }>(
        "/super-admin/quota-periods/"
      ),
  });

  // Fetch Quota Requests
  const quotaRequestsQuery = useQuery({
    queryKey: ["super-admin-quota-requests"],
    queryFn: async () => {
      const res = await superAdminGet<any>("/activation-codes/quota-requests/");
      const list: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.results)
        ? res.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      return list.map(normalizeQuotaRequest);
    },
  });

  const owners = useMemo(() => ownersQuery.data ?? [], [ownersQuery.data]);
  const contracts = useMemo(() => unwrapList(contractsQuery.data ?? []), [contractsQuery.data]);
  const periods = useMemo(() => unwrapList(periodsQuery.data ?? []), [periodsQuery.data]);
  const quotaRequests = useMemo(() => quotaRequestsQuery.data ?? [], [quotaRequestsQuery.data]);

  // Index latest open/active period by contract ID
  const periodByContract = useMemo(() => {
    const map = new Map<number, any>();
    periods.forEach((p) => {
      const cid = typeof p.contract === "number" ? p.contract : p.contract?.id;
      if (cid && !map.has(cid)) {
        map.set(cid, p);
      }
    });
    return map;
  }, [periods]);

  // Metric computations
  const activeContracts = useMemo(
    () => contracts.filter((c) => Boolean(c.is_active ?? c.isActive)),
    [contracts]
  );
  const pendingRequests = useMemo(
    () => quotaRequests.filter((r) => r.status === "pending"),
    [quotaRequests]
  );
  const totalContractedCapacity = useMemo(
    () => activeContracts.reduce((sum, c) => sum + Number(c.monthly_code_limit ?? c.monthlyCodeLimit ?? 0), 0),
    [activeContracts]
  );
  const totalGeneratedThisMonth = useMemo(() => {
    return periods.reduce((sum, p) => {
      if (p.status === "open" || !p.status) {
        return sum + Number(p.generated_count ?? 0);
      }
      return sum;
    }, 0);
  }, [periods]);

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      superAdminPost<{ status: string }>(`/super-admin/quota-contracts/${id}/deactivate/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-quota-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-quota-periods"] });
      toast({ title: "تم إيقاف العقد", description: "لن يُستخدم هذا العقد في الفترات المستقبلية." });
    },
    onError: (error: Error) => {
      toast({ title: "تعذر إيقاف العقد", description: error.message, variant: "destructive" });
    },
  });

  // Create Contract Mutation
  const createContractMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      superAdminPost<QuotaContract>("/super-admin/quota-contracts/", payload),
    onSuccess: () => {
      toast({ title: "تم إنشاء العقد بنجاح", description: "تم تفعيل عقد السعة الجديد للمالك المحدد." });
      queryClient.invalidateQueries({ queryKey: ["super-admin-quota-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-quota-periods"] });
      setNewContractForm(emptyNewContractForm);
      setIsNewContractModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "تعذر إنشاء العقد", description: error.message, variant: "destructive" });
    },
  });

  // Handlers
  const handleCreateContract = () => {
    const ownerId = Number(newContractForm.owner);
    const limit = Number(newContractForm.monthly_code_limit);
    const billingUnit = Number(newContractForm.billing_unit_size);
    const price = Number(newContractForm.price_per_billing_unit);

    if (!ownerId || !limit || limit < 1 || !billingUnit || billingUnit < 1 || Number.isNaN(price) || price < 0) {
      toast({
        title: "بيانات غير صالحة",
        description: "يرجى مراجعة اختيار المالك، والحد الشهري، ووحدة الفوترة، والسعر.",
        variant: "destructive",
      });
      return;
    }

    createContractMutation.mutate({
      owner: ownerId,
      monthly_code_limit: limit,
      billing_unit_size: billingUnit,
      price_per_billing_unit: price.toFixed(2),
      currency: newContractForm.currency.trim().toUpperCase() || "EGP",
      effective_from: newContractForm.effective_from,
      is_active: true,
      notes: newContractForm.notes.trim(),
    });
  };

  const handleQuickGrant = () => {
    const ownerId = Number(quickGrantOwner);
    if (!ownerId) {
      toast({ title: "اختر المالك أولاً", description: "يرجى تحديد مدرس أو سنتر لمنح الكوتة.", variant: "destructive" });
      return;
    }

    const payload: any = {
      owner_id: ownerId,
      notes: quickGrantNotes.trim() || undefined,
      billing_unit_size: quickGrantUnitSize > 0 ? quickGrantUnitSize : 100,
    };

    if (quickGrantPrice !== "" && !Number.isNaN(Number(quickGrantPrice))) {
      payload.price_per_billing_unit = Number(quickGrantPrice).toFixed(2);
    }

    if (quickGrantMode === "additional") {
      if (!quickGrantQuantity || quickGrantQuantity <= 0) {
        toast({ title: "الكمية غير صالحة", description: "يرجى إدخال كمية أكواد إضافية أكبر من 0.", variant: "destructive" });
        return;
      }
      payload.additional_quantity = Number(quickGrantQuantity);
    } else {
      if (!quickGrantQuantity || quickGrantQuantity <= 0) {
        toast({ title: "الحد الشهري غير صالح", description: "يرجى إدخال حد شهري جديد أكبر من 0.", variant: "destructive" });
        return;
      }
      payload.new_monthly_limit = Number(quickGrantQuantity);
    }

    quickGrantMutation.mutate(payload, {
      onSuccess: () => {
        toast({
          title: "تم منح وتحديث الكوتة بنجاح 🎉",
          description: "تم تطبيق التعديلات وانعكست على الحصة المتاحة للمالك فوراً.",
        });
        setIsQuickGrantModalOpen(false);
        setQuickGrantOwner("");
        setQuickGrantQuantity(50);
        setQuickGrantPrice("");
        setQuickGrantNotes("");
        queryClient.invalidateQueries({ queryKey: ["super-admin-quota-contracts"] });
        queryClient.invalidateQueries({ queryKey: ["super-admin-quota-periods"] });
        queryClient.invalidateQueries({ queryKey: ["super-admin-quota-requests"] });
      },
      onError: (err: any) => {
        toast({
          title: "تعذر منح الكوتة",
          description: err?.message || "حدث خطأ أثناء معالجة المنح السريع.",
          variant: "destructive",
        });
      },
    });
  };

  const handleOpenEditContract = (contract: QuotaContract) => {
    setEditingContract(contract);
    setEditMonthlyLimit(Number(contract.monthly_code_limit ?? contract.monthlyCodeLimit ?? 0));
    setEditPricePerUnit(String(contract.price_per_billing_unit ?? contract.pricePerBillingUnit ?? "0"));
    setEditUnitSize(Number(contract.billing_unit_size ?? contract.billingUnitSize ?? 100));
    setEditNotes(contract.notes || "");
    setEditEffectiveTo(contract.effective_to ?? contract.effectiveTo ?? "");
  };

  const handleSaveEditContract = () => {
    if (!editingContract) return;

    if (!editMonthlyLimit || editMonthlyLimit < 1) {
      toast({ title: "حد غير صالح", description: "يجب أن يكون الحد الشهري 1 على الأقل.", variant: "destructive" });
      return;
    }

    const payload: Record<string, any> = {
      monthly_code_limit: editMonthlyLimit,
      billing_unit_size: editUnitSize > 0 ? editUnitSize : 100,
      price_per_billing_unit: Number(editPricePerUnit || 0).toFixed(2),
      notes: editNotes.trim(),
    };

    if (editEffectiveTo) {
      payload.effective_to = editEffectiveTo;
    }

    updateContractMutation.mutate(
      { contractId: editingContract.id, payload },
      {
        onSuccess: () => {
          toast({ title: "تم تحديث العقد", description: "تم حفظ التعديلات وتحديث شروط العقد بنجاح." });
          setEditingContract(null);
          queryClient.invalidateQueries({ queryKey: ["super-admin-quota-contracts"] });
          queryClient.invalidateQueries({ queryKey: ["super-admin-quota-periods"] });
        },
        onError: (err: any) => {
          toast({
            title: "تعذر تحديث العقد",
            description: err?.message || "حدث خطأ أثناء حفظ التعديلات.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleOpenReview = (request: CenterQuotaRequest, action: "approve" | "reject") => {
    setReviewingRequest({ request, action });
    setReviewAdminNotes("");
  };

  const handleConfirmReview = () => {
    if (!reviewingRequest) return;
    const { request, action } = reviewingRequest;

    reviewMutation.mutate(
      {
        requestId: request.id,
        action,
        adminNotes: reviewAdminNotes.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          toast({
            title: action === "approve" ? "تم اعتماد طلب الكوتة بنجاح ✅" : "تم رفض طلب الكوتة",
            description: data?.message || (action === "approve" ? "تمت إضافة الكوتة المطلوبة لحساب المستفيد." : "تم تسجيل الرفض وإشعار مقدم الطلب."),
          });
          setReviewingRequest(null);
          queryClient.invalidateQueries({ queryKey: ["super-admin-quota-requests"] });
          queryClient.invalidateQueries({ queryKey: ["super-admin-quota-contracts"] });
          queryClient.invalidateQueries({ queryKey: ["super-admin-quota-periods"] });
        },
        onError: (err: any) => {
          toast({
            title: "تعذر تنفيذ المراجعة",
            description: err?.response?.data?.error || err?.message || "حدث خطأ أثناء مراجعة الطلب.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Filtered Contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const name = String(c.owner_name ?? c.ownerName ?? "").toLowerCase();
      const email = String(c.owner_email ?? c.ownerEmail ?? "").toLowerCase();
      const notes = String(c.notes ?? "").toLowerCase();
      const role = String(c.owner_role ?? c.ownerRole ?? "");
      const q = contractSearch.trim().toLowerCase();

      const matchesQuery = !q || name.includes(q) || email.includes(q) || notes.includes(q);
      const matchesRole = contractRoleFilter === "all" || role === contractRoleFilter;
      const isActive = Boolean(c.is_active ?? c.isActive);
      const matchesStatus =
        contractStatusFilter === "all" ||
        (contractStatusFilter === "active" && isActive) ||
        (contractStatusFilter === "inactive" && !isActive);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [contracts, contractSearch, contractRoleFilter, contractStatusFilter]);

  // Filtered Quota Requests
  const filteredRequests = useMemo(() => {
    return quotaRequests.filter((r) => {
      const email = String(r.requestedByEmail || "").toLowerCase();
      const name = String(r.requestedByName || "").toLowerCase();
      const center = String(r.centerName || "").toLowerCase();
      const reason = String(r.reason || "").toLowerCase();
      const q = requestSearch.trim().toLowerCase();

      const matchesQuery = !q || email.includes(q) || name.includes(q) || center.includes(q) || reason.includes(q);
      const matchesStatus = requestStatusFilter === "all" || r.status === requestStatusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [quotaRequests, requestSearch, requestStatusFilter]);

  const refreshAll = () => {
    contractsQuery.refetch();
    periodsQuery.refetch();
    quotaRequestsQuery.refetch();
    ownersQuery.refetch();
  };

  const isRefreshing =
    contractsQuery.isFetching ||
    periodsQuery.isFetching ||
    quotaRequestsQuery.isFetching ||
    ownersQuery.isFetching;

  return (
    <div className="space-y-6 dir-rtl" dir="rtl">
      {/* Top Action Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            إدارة عقود وكوتة أكواد التفعيل
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            التحكم في السعة التعاقدية للمراكز التعليمية والمدرسين، منح الكوتات السريعة، ومراجعة طلبات زيادة السعة اللحظية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 gap-1.5"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            تحديث
          </Button>

          <Button
            onClick={() => setIsQuickGrantModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-lg shadow-amber-600/20"
          >
            <Zap className="w-4 h-4" />
            منح / تعديل كوتة سريعة
          </Button>

          <Button
            onClick={() => setIsNewContractModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 shadow-lg shadow-red-600/20"
          >
            <Plus className="w-4 h-4" />
            عقد سعة جديد
          </Button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Active Contracts */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-400">إجمالي العقود النشطة</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white font-mono">{activeContracts.length}</div>
            <p className="text-xs text-slate-500 mt-1">عقد تجاري سارٍ حالياً بالمنصة</p>
          </CardContent>
        </Card>

        {/* Card 2: Pending Requests */}
        <Card className={`border-slate-800 shadow-md transition-all ${
          pendingRequests.length > 0 ? "bg-amber-950/20 border-amber-500/30" : "bg-slate-900/80"
        }`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              طلبات الكوتة المعلقة
              {pendingRequests.length > 0 && (
                <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0 animate-pulse">
                  {pendingRequests.length} معلق
                </Badge>
              )}
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-400 font-mono">{pendingRequests.length}</div>
            <p className="text-xs text-slate-500 mt-1">بانتظار مراجعة وقرار الإدارة</p>
          </CardContent>
        </Card>

        {/* Card 3: Total Contracted Capacity */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-400">إجمالي السعة المتعاقد عليها</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Ticket className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-400 font-mono">{totalContractedCapacity.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">كود شهرياً للمراكز والمعلمين</p>
          </CardContent>
        </Card>

        {/* Card 4: Generated Codes This Month */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-400">الأكواد الصادرة هذا الشهر</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-purple-400 font-mono">{totalGeneratedThisMonth.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">كود تم توليده في الدورات المفتوحة</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl h-auto flex-wrap justify-start">
          <TabsTrigger
            value="contracts"
            className="data-[state=active]:bg-red-600 data-[state=active]:text-white gap-2 font-bold px-4"
          >
            <Layers className="w-4 h-4" />
            العقود التجارية ({contracts.length})
          </TabsTrigger>

          <TabsTrigger
            value="requests"
            className="data-[state=active]:bg-amber-600 data-[state=active]:text-white gap-2 font-bold px-4 relative"
          >
            <Sparkles className="w-4 h-4" />
            طلبات زيادة الكوتة ({quotaRequests.length})
            {pendingRequests.length > 0 && (
              <span className="ms-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONTRACTS */}
        <TabsContent value="contracts" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="بحث باسم المالك، البريد، أو الملاحظات..."
                  value={contractSearch}
                  onChange={(e) => setContractSearch(e.target.value)}
                  className="pr-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={contractRoleFilter} onValueChange={(v: any) => setContractRoleFilter(v)}>
                  <SelectTrigger className="w-[140px] bg-slate-950 border-slate-700 text-white">
                    <SelectValue placeholder="الدور" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">كل الأدوار</SelectItem>
                    <SelectItem value="center">سنتر</SelectItem>
                    <SelectItem value="instructor">مدرس</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={contractStatusFilter} onValueChange={(v: any) => setContractStatusFilter(v)}>
                  <SelectTrigger className="w-[140px] bg-slate-950 border-slate-700 text-white">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="active">نشط فقط</SelectItem>
                    <SelectItem value="inactive">متوقف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              {contractsQuery.isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                  <span>جاري تحميل عقود الكوتة...</span>
                </div>
              ) : contractsQuery.isError ? (
                <div className="py-16 text-center text-red-400">
                  تعذر تحميل العقود. يرجى إعادة المحاولة لاحقاً.
                </div>
              ) : filteredContracts.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  لا توجد عقود مطابقة لمعايير البحث الحالية.
                </div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="text-right p-3.5">المالك</th>
                        <th className="text-right p-3.5">الدور</th>
                        <th className="text-right p-3.5">الحد الشهري</th>
                        <th className="text-right p-3.5 min-w-[180px]">استهلاك الشهر الحالي</th>
                        <th className="text-right p-3.5">سعر الوحدة</th>
                        <th className="text-right p-3.5">فترة السريان</th>
                        <th className="text-right p-3.5">الحالة</th>
                        <th className="text-left p-3.5">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {filteredContracts.map((contract) => {
                        const ownerRole = contract.owner_role ?? contract.ownerRole;
                        const ownerName = contract.owner_name ?? contract.ownerName;
                        const ownerEmail = contract.owner_email ?? contract.ownerEmail;
                        const limit = Number(contract.monthly_code_limit ?? contract.monthlyCodeLimit ?? 0);
                        const unitSize = Number(contract.billing_unit_size ?? contract.billingUnitSize ?? 100);
                        const price = contract.price_per_billing_unit ?? contract.pricePerBillingUnit;
                        const isActive = Boolean(contract.is_active ?? contract.isActive);
                        const effFrom = contract.effective_from ?? contract.effectiveFrom;
                        const effTo = contract.effective_to ?? contract.effectiveTo;

                        const period = periodByContract.get(contract.id);
                        const generated = period ? Number(period.generated_count ?? 0) : 0;
                        const available = period ? Number(period.available_count ?? Math.max(0, limit - generated)) : limit;
                        const percentUsed = limit > 0 ? Math.min(100, Math.round((generated / limit) * 100)) : 0;

                        return (
                          <tr key={contract.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {ownerRole === "center" ? (
                                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                                ) : (
                                  <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                                )}
                                <span>{ownerName || ownerEmail}</span>
                              </div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5">
                                #{contract.owner} • {ownerEmail}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <Badge
                                variant="outline"
                                className={
                                  ownerRole === "center"
                                    ? "border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs"
                                    : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs"
                                }
                              >
                                {ownerRole === "center" ? "سنتر" : "مدرس"}
                              </Badge>
                            </td>

                            <td className="p-3.5">
                              <span className="font-mono font-bold text-white text-base">
                                {limit.toLocaleString()}
                              </span>
                              <span className="text-xs text-slate-400 ms-1">كود</span>
                            </td>

                            <td className="p-3.5">
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-slate-400">
                                    مولّد: <strong className="text-white">{generated}</strong>
                                  </span>
                                  <span className="text-slate-400">
                                    متبقٍ: <strong className={available <= 0 ? "text-red-400" : "text-emerald-400"}>{available}</strong>
                                  </span>
                                </div>
                                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      percentUsed > 90
                                        ? "bg-red-500"
                                        : percentUsed > 70
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${percentUsed}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5 font-mono text-slate-200">
                              <div>{price} {contract.currency}</div>
                              <div className="text-[11px] text-slate-400">لكل {unitSize} كود</div>
                            </td>

                            <td className="p-3.5 text-xs font-mono text-slate-400">
                              <div>من: {safeFormatDate(effFrom)}</div>
                              {effTo && <div className="text-slate-500">إلى: {safeFormatDate(effTo)}</div>}
                            </td>

                            <td className="p-3.5">
                              {isActive ? (
                                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30">
                                  نشط
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-slate-800 text-slate-400">
                                  متوقف
                                </Badge>
                              )}
                            </td>

                            <td className="p-3.5 text-left">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenEditContract(contract)}
                                  className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 gap-1 text-xs"
                                  title="تعديل الكوتة والأسعار"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  تعديل
                                </Button>

                                {isActive && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deactivateMutation.mutate(contract.id)}
                                    disabled={deactivateMutation.isPending}
                                    className="h-8 px-2.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 gap-1 text-xs"
                                    title="إيقاف العقد"
                                  >
                                    <PowerOff className="w-3.5 h-3.5" />
                                    إيقاف
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: QUOTA REQUESTS */}
        <TabsContent value="requests" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="بحث باسم مقدم الطلب، السنتر، البريد، أو مبرر الطلب..."
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  className="pr-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="w-full md:w-[200px]">
                <Select value={requestStatusFilter} onValueChange={(v: any) => setRequestStatusFilter(v)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue placeholder="حالة الطلب" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="pending">قيد المراجعة</SelectItem>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              {quotaRequestsQuery.isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span>جاري تحميل طلبات الكوتة...</span>
                </div>
              ) : quotaRequestsQuery.isError ? (
                <div className="py-16 text-center text-red-400">
                  تعذر تحميل طلبات الكوتة.
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  لا توجد طلبات كوتة مطابقة للخيارات المحددة.
                </div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="text-right p-3.5">مقدم الطلب</th>
                        <th className="text-right p-3.5">الدور والجهة</th>
                        <th className="text-right p-3.5">الكوتة الحالية</th>
                        <th className="text-right p-3.5">الكمية المطلوبة</th>
                        <th className="text-right p-3.5 min-w-[200px]">مبرر الطلب</th>
                        <th className="text-right p-3.5">تاريخ التقديم</th>
                        <th className="text-right p-3.5">الحالة</th>
                        <th className="text-right p-3.5">ملاحظات الإدارة</th>
                        <th className="text-left p-3.5">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {filteredRequests.map((req) => {
                        const isPending = req.status === "pending";
                        const isApproved = req.status === "approved";
                        const isRejected = req.status === "rejected";
                        const role = req.requestedByRole || (req.centerName ? "center" : "instructor");

                        return (
                          <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-white">
                                {req.requestedByName || req.requestedByEmail}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {req.requestedByEmail}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={
                                    role === "center"
                                      ? "border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs"
                                      : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs"
                                  }
                                >
                                  {role === "center" ? "سنتر" : "مدرس"}
                                </Badge>
                              </div>
                              {req.centerName && (
                                <div className="text-xs text-slate-400 mt-0.5">{req.centerName}</div>
                              )}
                            </td>

                            <td className="p-3.5 font-mono text-slate-300">
                              {req.currentQuota} كود
                            </td>

                            <td className="p-3.5">
                              <span className="font-mono font-black text-amber-400 text-base">
                                +{req.requestedQuantity}
                              </span>
                              <span className="text-xs text-slate-400 ms-1">كود</span>
                            </td>

                            <td className="p-3.5 text-xs text-slate-300 max-w-[280px]">
                              <p className="line-clamp-2" title={req.reason}>
                                {req.reason || "—"}
                              </p>
                            </td>

                            <td className="p-3.5 text-xs font-mono text-slate-400">
                              {safeFormatDate(req.createdAt)}
                            </td>

                            <td className="p-3.5">
                              {isApproved ? (
                                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> معتمد
                                </Badge>
                              ) : isRejected ? (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="w-3 h-3" /> مرفوض
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 animate-pulse">
                                  <Clock className="w-3 h-3" /> قيد المراجعة
                                </Badge>
                              )}
                            </td>

                            <td className="p-3.5 text-xs text-slate-400">
                              {req.adminNotes ? (
                                <div className="text-slate-200">{req.adminNotes}</div>
                              ) : (
                                <span>—</span>
                              )}
                              {req.reviewedByName && (
                                <div className="text-[11px] text-slate-500 mt-0.5">بواسطة {req.reviewedByName}</div>
                              )}
                            </td>

                            <td className="p-3.5 text-left">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenReview(req, "approve")}
                                    className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    اعتماد
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenReview(req, "reject")}
                                    className="h-7 px-2 border-red-500/40 text-red-400 hover:bg-red-950/40 font-bold text-xs gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    رفض
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-600 font-mono">مكتمل</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: EDIT CONTRACT */}
      <Dialog open={Boolean(editingContract)} onOpenChange={(open) => !open && setEditingContract(null)}>
        <DialogContent size="md" className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-white">
              <Edit className="w-5 h-5 text-red-400" />
              تعديل عقد سعة الكوتة
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              تعديل السعة والأسعار لعقد {editingContract?.owner_name || editingContract?.owner_email} (#{editingContract?.owner})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editMonthlyLimit" className="text-slate-300">الحد الشهري (كود) *</Label>
                <Input
                  id="editMonthlyLimit"
                  type="number"
                  min={1}
                  value={editMonthlyLimit}
                  onChange={(e) => setEditMonthlyLimit(Number(e.target.value))}
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPricePerUnit" className="text-slate-300">السعر لكل وحدة فوترة *</Label>
                <Input
                  id="editPricePerUnit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editPricePerUnit}
                  onChange={(e) => setEditPricePerUnit(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editUnitSize" className="text-slate-300">حجم وحدة الفوترة (أكواد)</Label>
                <Input
                  id="editUnitSize"
                  type="number"
                  min={1}
                  value={editUnitSize}
                  onChange={(e) => setEditUnitSize(Number(e.target.value))}
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEffectiveTo" className="text-slate-300">تاريخ انتهاء السريان (اختياري)</Label>
                <Input
                  id="editEffectiveTo"
                  type="date"
                  value={editEffectiveTo}
                  onChange={(e) => setEditEffectiveTo(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editNotes" className="text-slate-300">ملاحظات العقد</Label>
              <Textarea
                id="editNotes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="أضف ملاحظات أو تفاصيل الاتفاق..."
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingContract(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveEditContract}
              disabled={updateContractMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
            >
              {updateContractMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: QUICK GRANT QUOTA */}
      <Dialog open={isQuickGrantModalOpen} onOpenChange={setIsQuickGrantModalOpen}>
        <DialogContent size="md" className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-white">
              <Zap className="w-5 h-5 text-amber-400" />
              منح أو تعديل كوتة سريعة
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              تطبيق مباشر للكوتة على الشهر الحالي أو ضبط الحد الشهري دون الحاجة لإنشاء عقد جديد من الصفر.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">اختر المالك المستفيد *</Label>
              <select
                value={quickGrantOwner}
                onChange={(e) => setQuickGrantOwner(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- اختر سنتر أو مدرس --</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    #{owner.id} — {owner.fullName || owner.full_name || owner.email} ({owner.role === "center" ? "سنتر" : "مدرس"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">نوع الإجراء</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickGrantMode("additional")}
                  className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                    quickGrantMode === "additional"
                      ? "bg-amber-600/20 border-amber-500 text-amber-300 shadow-md"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  إضافة كوتة للشهر الحالي (+X)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickGrantMode("new_limit")}
                  className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                    quickGrantMode === "new_limit"
                      ? "bg-amber-600/20 border-amber-500 text-amber-300 shadow-md"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  تعيين حد شهري جديد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quickGrantQuantity" className="text-slate-300">
                  {quickGrantMode === "additional" ? "عدد الأكواد الإضافية *" : "الحد الشهري الجديد *"}
                </Label>
                <Input
                  id="quickGrantQuantity"
                  type="number"
                  min={1}
                  value={quickGrantQuantity}
                  onChange={(e) => setQuickGrantQuantity(Number(e.target.value))}
                  placeholder="مثال: 50 أو 100"
                  className="bg-slate-950 border-slate-700 text-white font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quickGrantPrice" className="text-slate-300">سعر وحدة الفوترة (اختياري)</Label>
                <Input
                  id="quickGrantPrice"
                  type="number"
                  min={0}
                  step="0.01"
                  value={quickGrantPrice}
                  onChange={(e) => setQuickGrantPrice(e.target.value)}
                  placeholder="السعر (ج.م)"
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quickGrantNotes" className="text-slate-300">ملاحظات الإجراء</Label>
              <Input
                id="quickGrantNotes"
                value={quickGrantNotes}
                onChange={(e) => setQuickGrantNotes(e.target.value)}
                placeholder="مثال: منحة استثنائية لمعرض الطلاب..."
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsQuickGrantModalOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleQuickGrant}
              disabled={quickGrantMutation.isPending || !quickGrantOwner || !quickGrantQuantity}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
            >
              {quickGrantMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              تنفيذ المنح الفوري
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: NEW CONTRACT */}
      <Dialog open={isNewContractModalOpen} onOpenChange={setIsNewContractModalOpen}>
        <DialogContent size="md" className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-red-400" />
              إنشاء عقد سعة تجاري جديد
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              تحديد شروط وسعة العقد التجاري الجديد للمالك المختار.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-slate-300">المالك *</Label>
              <select
                value={newContractForm.owner}
                onChange={(e) => setNewContractForm((cur) => ({ ...cur, owner: e.target.value }))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">-- اختر سنتر أو مدرس --</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    #{owner.id} — {owner.fullName || owner.full_name || owner.email} ({owner.role === "center" ? "سنتر" : "مدرس"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">الحد الشهري (أكواد) *</Label>
              <Input
                type="number"
                min={1}
                value={newContractForm.monthly_code_limit}
                onChange={(e) => setNewContractForm((cur) => ({ ...cur, monthly_code_limit: e.target.value }))}
                placeholder="مثال: 500"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">وحدة الفوترة (أكواد) *</Label>
              <Input
                type="number"
                min={1}
                value={newContractForm.billing_unit_size}
                onChange={(e) => setNewContractForm((cur) => ({ ...cur, billing_unit_size: e.target.value }))}
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">السعر لكل وحدة فوترة *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={newContractForm.price_per_billing_unit}
                onChange={(e) => setNewContractForm((cur) => ({ ...cur, price_per_billing_unit: e.target.value }))}
                placeholder="مثال: 2500"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">تاريخ بدء السريان *</Label>
              <Input
                type="date"
                value={newContractForm.effective_from}
                onChange={(e) => setNewContractForm((cur) => ({ ...cur, effective_from: e.target.value }))}
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-slate-300">ملاحظات العقد</Label>
              <Input
                value={newContractForm.notes}
                onChange={(e) => setNewContractForm((cur) => ({ ...cur, notes: e.target.value }))}
                placeholder="مثال: خصم خاص بنسبة 15% للفصل الدراسي الأول..."
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsNewContractModalOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCreateContract}
              disabled={createContractMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
            >
              {createContractMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ العقد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: REVIEW QUOTA REQUEST */}
      <Dialog open={Boolean(reviewingRequest)} onOpenChange={(open) => !open && setReviewingRequest(null)}>
        <DialogContent size="md" className="bg-slate-900 border-slate-800 text-white dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-white">
              {reviewingRequest?.action === "approve" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  اعتماد طلب زيادة الكوتة
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  رفض طلب زيادة الكوتة
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {reviewingRequest?.action === "approve"
                ? "سيتم اعتماد السعة الإضافية المطلوبة وإشعار المستفيد فوراً."
                : "سيتم رفض الطلب وتسجيل الملاحظات للمستفيد."}
            </DialogDescription>
          </DialogHeader>

          {reviewingRequest && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">مقدم الطلب:</span>
                  <span className="font-bold text-white">
                    {reviewingRequest.request.requestedByName || reviewingRequest.request.requestedByEmail}
                  </span>
                </div>
                {reviewingRequest.request.centerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">المؤسسة / السنتر:</span>
                    <span className="text-blue-400 font-bold">{reviewingRequest.request.centerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">الكوتة الحالية:</span>
                  <span className="font-mono text-slate-300">{reviewingRequest.request.currentQuota} كود</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">الكمية المطلوبة:</span>
                  <span className="font-mono font-black text-lg text-amber-400">
                    +{reviewingRequest.request.requestedQuantity} كود
                  </span>
                </div>
                {reviewingRequest.request.reason && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400 block text-xs mb-1">مبرر الطلب:</span>
                    <p className="text-xs text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      {reviewingRequest.request.reason}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewNotes" className="text-slate-300">
                  ملاحظات الإدارة (ستظهر للمستخدم في إشعاره)
                </Label>
                <Textarea
                  id="reviewNotes"
                  rows={3}
                  value={reviewAdminNotes}
                  onChange={(e) => setReviewAdminNotes(e.target.value)}
                  placeholder={
                    reviewingRequest.action === "approve"
                      ? "تم اعتماد الطلب تقديراً للأداء المميز..."
                      : "نعتذر، تم استيفاء الحد المسموح لهذا الشهر..."
                  }
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReviewingRequest(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmReview}
              disabled={reviewMutation.isPending}
              className={
                reviewingRequest?.action === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                  : "bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
              }
            >
              {reviewMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {reviewingRequest?.action === "approve" ? "تأكيد الاعتماد الفوري" : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
