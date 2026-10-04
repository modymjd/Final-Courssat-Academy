import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  Users,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Ticket,
  Percent,
  Trash2,
  CreditCard,
  Lock,
  KeyRound,
  Zap,
} from "lucide-react";
import { superAdminGet, superAdminPost, superAdminPatch, superAdminDelete } from "@/lib/superAdminHttp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTable } from "@/components/super-admin/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";


interface MrrStatsDto {
  mrr: string;
  currency?: string;
  total_active_subscriptions?: number;
  active_subscriptions_total?: number;
  plan_breakdown?: Record<string, number>;
  plan_distribution?: Record<string, number>;
}

interface ChangeRequestDto {
  id: number;
  target_model: string;
  target_id: number;
  old_value: any;
  new_value: any;
  requested_by_email: string;
  approved_by_email: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export default function SuperAdminPricing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plans");

  // Modals state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    is_featured: false,
    is_active: true,
    trial_days: 0,
  });

  const [confirmModalData, setConfirmModalData] = useState<{ title: string; desc: string; action: () => void } | null>(null);

  // Queries
  const { data: mrrStats, isLoading: isMrrLoading } = useQuery<MrrStatsDto>({
    queryKey: ["super-admin-mrr-stats"],
    queryFn: () => superAdminGet<MrrStatsDto>("/finance/super-admin/mrr-stats/"),
    staleTime: 1000 * 60 * 5,
  });

  const { data: plansData, isLoading: isPlansLoading } = useQuery<any>({
    queryKey: ["super-admin-plans"],
    queryFn: () => superAdminGet<any>("/finance/super-admin/pricing/"),
  });

  const { data: couponsData, isLoading: isCouponsLoading } = useQuery<any>({
    queryKey: ["super-admin-coupons"],
    queryFn: () => superAdminGet<any>("/finance/super-admin/coupons/"),
  });

  const { data: changeRequests, isLoading: isRequestsLoading } = useQuery<any>({
    queryKey: ["super-admin-change-requests"],
    queryFn: () => superAdminGet<any>("/finance/super-admin/change-requests/"),
  });

  const { data: adminPayouts, isLoading: isPayoutsLoading } = useQuery<any>({
    queryKey: ["super-admin-payouts"],
    queryFn: () => superAdminGet<any>("/finance/super-admin/payouts/"),
  });

  const { data: academicInvoices, isLoading: isInvoicesLoading } = useQuery<any>({
    queryKey: ["super-admin-academic-invoices"],
    queryFn: () => superAdminGet<any>("/finance/academic-pricing/quotations/"),
  });

  const academicInvoicesList: any[] = Array.isArray(academicInvoices) ? academicInvoices : [];

  // Payment Gateway Configuration Query & Mutation
  const { data: gatewayConfig, isLoading: isGatewayLoading } = useQuery<any>({
    queryKey: ["super-admin-gateway-config"],
    queryFn: () => superAdminGet<any>("/finance/super-admin/gateway-config/"),
  });

  const [gatewayForm, setGatewayForm] = useState({
    is_active: false,
    mode: "test",
    merchant_id: "",
    api_key: "",
    iframe_key: "",
  });

  useEffect(() => {
    if (gatewayConfig) {
      setGatewayForm({
        is_active: Boolean(gatewayConfig.is_active),
        mode: gatewayConfig.mode || "test",
        merchant_id: gatewayConfig.merchant_id || "",
        api_key: gatewayConfig.api_key || "",
        iframe_key: gatewayConfig.iframe_key || "",
      });
    }
  }, [gatewayConfig]);

  const saveGatewayMutation = useMutation({
    mutationFn: (payload: any) => superAdminPatch("/finance/super-admin/gateway-config/", payload),
    onSuccess: (res: any) => {
      toast({
        title: "تم حفظ وتحديث إعدادات بوابة الدفع بنجاح! 🎉",
        description: res?.config?.is_enabled
          ? "بوابة الدفع الإلكتروني أصبحت مفعلة الآن رسمياً لجميع الزوار في صفحة الأسعار والكورسات."
          : "تم الحفظ. البوابة ما زالت في وضع (قريباً) لعدم اكتمال المفاتيح أو تعطيل التفعيل.",
      });
      queryClient.invalidateQueries({ queryKey: ["super-admin-gateway-config"] });
      queryClient.invalidateQueries({ queryKey: ["public-payment-gateway-status"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "فشل حفظ إعدادات بوابة الدفع",
        description: err.message,
      });
    },
  });

  // Mutations
  const approveInvoiceMutation = useMutation({
    mutationFn: (id: number) =>
      superAdminPost(`/finance/academic-pricing/quotations/${id}/approve/`, { action: "approve" }),
    onSuccess: (res: any) => {
      toast({
        title: "تم تأكيد الدفع وتفعيل باقة السنتر بنجاح!",
        description: res?.detail || "تم تحديث حصص الموارد وتاريخ انتهاء الاشتراك.",
      });
      queryClient.invalidateQueries({ queryKey: ["super-admin-academic-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-mrr-stats"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "فشل تفعيل الفاتورة",
        description: err.message || "حدث خطأ أثناء تفعيل اشتراك السنتر.",
      });
    },
  });

  const rejectInvoiceMutation = useMutation({
    mutationFn: (id: number) =>
      superAdminPost(`/finance/academic-pricing/quotations/${id}/approve/`, { action: "reject" }),
    onSuccess: () => {
      toast({ title: "تم رفض الفاتورة بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["super-admin-academic-invoices"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => superAdminPost(`/finance/super-admin/change-requests/${id}/approve/`, {}),
    onSuccess: () => {
      toast({ title: "تمت الموافقة ونشر التعديل المالي بنجاح!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-mrr-stats"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "فشلت عملية الموافقة (Maker-Checker)",
        description: err.message || "لا يمكنك الموافقة على طلب قمت بإنشائه بنفسك.",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => superAdminPost(`/finance/super-admin/change-requests/${id}/reject/`, {}),
    onSuccess: () => {
      toast({ title: "تم رفض طلب التغيير بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["super-admin-change-requests"] });
    },
  });

  const approvePayoutMutation = useMutation({
    mutationFn: (id: number) => superAdminPost(`/finance/super-admin/payouts/${id}/approve/`, {}),
    onSuccess: () => {
      toast({ title: "تم اعتماد طلب السحب بنجاح!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-payouts"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "فشل اعتماد الطلب (Maker-Checker)",
        description: err.message || "لا يمكنك اعتماد طلب السحب الخاص بك.",
      });
    },
  });

  const rejectPayoutMutation = useMutation({
    mutationFn: (id: number) => superAdminPost(`/finance/super-admin/payouts/${id}/reject/`, {}),
    onSuccess: () => {
      toast({ title: "تم رفض طلب السحب وإعادة الرصيد للمحفظة." });
      queryClient.invalidateQueries({ queryKey: ["super-admin-payouts"] });
    },
  });

  const disbursePayoutMutation = useMutation({
    mutationFn: (id: number) => superAdminPost(`/finance/super-admin/payouts/${id}/disburse/`, {}),
    onSuccess: () => {
      toast({ title: "تم تأكيد تحويل وصرف الأرباح وتسجيل قيد الدفتر المزدوج!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-payouts"] });
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: (payload: any) => {
      if (selectedPlan?.id) {
        return superAdminPatch(`/finance/super-admin/pricing/${selectedPlan.id}/`, payload);
      }
      return superAdminPost("/finance/super-admin/pricing/", payload);
    },
    onSuccess: () => {
      toast({
        title: "تم حفظ وتحديث خطة الأسعار بنجاح!",
        description: "تم تحديث بيانات الخطة في قاعدة البيانات فوراً ونشرها عبر المنصة.",
      });
      setIsPlanModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["super-admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["public-pricing-plans"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-mrr-stats"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "حدث خطأ أثناء حفظ الخطة", description: err.message });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => superAdminDelete(`/finance/super-admin/pricing/${id}/`),
    onSuccess: () => {
      toast({ title: "تم حذف خطة الأسعار بنجاح!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["public-pricing-plans"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-mrr-stats"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "فشل حذف الخطة", description: err.message });
    },
  });

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "percent",
    discount_value: "20",
    minimum_amount: "",
    maximum_discount: "",
    max_uses: "",
    per_user_limit: "1",
    is_active: true,
  });

  const saveCouponMutation = useMutation({
    mutationFn: (payload: any) => {
      if (selectedCoupon?.id) {
        return superAdminPatch(`/finance/super-admin/coupons/${selectedCoupon.id}/`, payload);
      }
      return superAdminPost("/finance/super-admin/coupons/", payload);
    },
    onSuccess: () => {
      toast({ title: "تم حفظ كود الخصم بنجاح!" });
      setIsCouponModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["super-admin-coupons"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "فشل حفظ الكوبون", description: err.message });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: number) => superAdminDelete(`/finance/super-admin/coupons/${id}/`),
    onSuccess: () => {
      toast({ title: "تم حذف الكوبون بنجاح!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-coupons"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "فشل حذف الكوبون", description: err.message });
    },
  });

  const handleOpenEditPlan = (plan: any) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price_monthly: String(plan.price_monthly),
      price_yearly: String(plan.price_yearly),
      is_featured: plan.is_featured,
      is_active: plan.is_active,
      trial_days: plan.trial_days || 0,
    });
    setIsPlanModalOpen(true);
  };

  const handleOpenCreatePlan = () => {
    setSelectedPlan(null);
    setPlanForm({
      name: "",
      slug: "",
      description: "",
      price_monthly: "199",
      price_yearly: "1990",
      is_featured: false,
      is_active: true,
      trial_days: 7,
    });
    setIsPlanModalOpen(true);
  };

  const handleOpenCreateCoupon = () => {
    setSelectedCoupon(null);
    setCouponForm({
      code: "",
      discount_type: "percent",
      discount_value: "20",
      minimum_amount: "",
      maximum_discount: "",
      max_uses: "100",
      per_user_limit: "1",
      is_active: true,
    });
    setIsCouponModalOpen(true);
  };

  const handleOpenEditCoupon = (coupon: any) => {
    setSelectedCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      minimum_amount: coupon.minimum_amount ? String(coupon.minimum_amount) : "",
      maximum_discount: coupon.maximum_discount ? String(coupon.maximum_discount) : "",
      max_uses: coupon.max_uses ? String(coupon.max_uses) : "",
      per_user_limit: coupon.per_user_limit ? String(coupon.per_user_limit) : "1",
      is_active: coupon.is_active,
    });
    setIsCouponModalOpen(true);
  };

  const handleSubmitPlanForm = () => {
    savePlanMutation.mutate({
      ...planForm,
      price_monthly: parseFloat(planForm.price_monthly),
      price_yearly: parseFloat(planForm.price_yearly),
    });
  };

  const handleSubmitCouponForm = () => {
    const payload: any = {
      code: couponForm.code.trim().toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: parseFloat(couponForm.discount_value),
      per_user_limit: parseInt(couponForm.per_user_limit) || 1,
      is_active: couponForm.is_active,
    };
    if (couponForm.minimum_amount) payload.minimum_amount = parseFloat(couponForm.minimum_amount);
    if (couponForm.maximum_discount) payload.maximum_discount = parseFloat(couponForm.maximum_discount);
    if (couponForm.max_uses) payload.max_uses = parseInt(couponForm.max_uses);

    saveCouponMutation.mutate(payload);
  };

  const plansList = Array.isArray(plansData) ? plansData : plansData?.results || [];
  const couponsList = Array.isArray(couponsData) ? couponsData : couponsData?.results || [];
  const requestsList: ChangeRequestDto[] = Array.isArray(changeRequests) ? changeRequests : changeRequests?.results || [];
  const adminPayoutsList: any[] = Array.isArray(adminPayouts) ? adminPayouts : adminPayouts?.results || [];

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-slate-100">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            إدارة الأسعار والاشتراكات والحوكمة المالية
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            التحكم في الخطط، الأسعار، الكوبونات، ومراجعة طلبات التغيير المالية (Maker-Checker Protocol).
          </p>
        </div>

        <Button onClick={handleOpenCreatePlan} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" />
          إضافة خطة أسعار جديدة
        </Button>
      </div>

      {/* Analytics MRR Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-400">الإيراد الشهري المتكرر (MRR)</CardTitle>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              {isMrrLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : `${Number(mrrStats?.mrr || 0).toLocaleString("ar-EG")} ج.م`}
            </div>
            <p className="text-xs text-slate-400 mt-1">المعدل الشهري النشط للحسابات الحالية</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-400">إجمالي الاشتراكات النشطة</CardTitle>
            <Users className="w-5 h-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-400 font-mono">
              {isMrrLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-400" /> : ((mrrStats?.total_active_subscriptions ?? mrrStats?.active_subscriptions_total) || 0).toLocaleString("ar-EG")}
            </div>
            <p className="text-xs text-slate-400 mt-1">المشتركين الحاليين في كافة الخطط</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-400">طلبات التغيير بانتظار الموافقة</CardTitle>
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-400 font-mono">
              {requestsList.filter((r) => r.status === "pending").length}
            </div>
            <p className="text-xs text-slate-400 mt-1">تتطلب موافقة مشرف آخر (Maker-Checker)</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap">
          <TabsTrigger value="plans" className="font-bold">خطط الأسعار</TabsTrigger>
          <TabsTrigger value="invoices" className="font-bold relative">
            فواتير واشتراكات السناتر
            {academicInvoicesList.filter((i: any) => i.status === "pending_payment_confirmation").length > 0 && (
              <span className="ms-1.5 px-2 py-0.5 text-xs bg-amber-500 text-slate-950 rounded-full font-black animate-pulse">
                {academicInvoicesList.filter((i: any) => i.status === "pending_payment_confirmation").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="coupons" className="font-bold">الكوبونات والخصومات</TabsTrigger>
          <TabsTrigger value="payouts" className="font-bold relative">
            طلبات السحب
            {adminPayoutsList.filter((p: any) => p.status === "pending").length > 0 && (
              <span className="ms-1.5 px-2 py-0.5 text-xs bg-emerald-600 text-white rounded-full font-bold">
                {adminPayoutsList.filter((p: any) => p.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="font-bold relative">
            موافقات الحوكمة
            {requestsList.filter((r) => r.status === "pending").length > 0 && (
              <span className="ms-1.5 px-2 py-0.5 text-xs bg-amber-600 text-white rounded-full font-bold">
                {requestsList.filter((r) => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="gateway" className="font-bold relative flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" />
            <span>بوابة كاشيير (Kashier)</span>
            {!gatewayConfig?.is_enabled ? (
              <span className="ms-1 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-extrabold">
                قريباً
              </span>
            ) : (
              <span className="ms-1 px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-extrabold">
                مفعلة
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800">
              <CardTitle className="text-lg font-semibold text-slate-100">قائمة خطط الأسعار الحالية</CardTitle>
              <CardDescription className="text-slate-400">عرض وتعديل أسعار الخطط وميزاتها المعلنة للطلاب.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isPlansLoading ? (
                <div className="py-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" /> جاري التحميل...</div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-right text-slate-400">الاسم والـ Slug</TableHead>
                      <TableHead className="text-right text-slate-400">السعر الشهري</TableHead>
                      <TableHead className="text-right text-slate-400">السعر السنوي</TableHead>
                      <TableHead className="text-right text-slate-400">أيام التجربة</TableHead>
                      <TableHead className="text-right text-slate-400">الأكثر طلباً</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-left text-slate-400">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plansList.map((plan: any) => (
                      <TableRow key={plan.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="font-bold">
                          <div className="text-slate-100">{plan.name}</div>
                          <div className="text-xs font-mono text-slate-400">{plan.slug}</div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-200">{Number(plan.price_monthly).toLocaleString("ar-EG")} ج.م</TableCell>
                        <TableCell className="font-semibold text-slate-200">{Number(plan.price_yearly).toLocaleString("ar-EG")} ج.م</TableCell>
                        <TableCell className="text-slate-300">{plan.trial_days} أيام</TableCell>
                        <TableCell>
                          {plan.is_featured ? (
                            <Badge className="bg-emerald-600 text-white">مميّزة</Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-700 text-slate-400">عادية</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {plan.is_active ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">مفعّلة</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20">معطلة</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleOpenEditPlan(plan)} className="hover:bg-slate-800 text-slate-300">
                              <Edit2 className="w-4 h-4 me-1 text-emerald-400" />
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setConfirmModalData({
                                  title: `تأكيد حذف الخطة (${plan.name})`,
                                  desc: "هل أنت متأكد من حذف هذه الخطة؟ سيتم إزالتها نهائياً من قاعدة البيانات وصفحة الأسعار.",
                                  action: () => {
                                    deletePlanMutation.mutate(plan.id);
                                    setConfirmModalData(null);
                                  },
                                });
                              }}
                              className="hover:bg-rose-950/40 text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800 flex flex-row justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-100">إدارة الكوبونات وأكواد الخصم</CardTitle>
                <CardDescription className="text-slate-400">إنشاء وتحديد شروط الكوبونات والتأكد من حدود الاستخدام.</CardDescription>
              </div>
              <Button onClick={handleOpenCreateCoupon} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                إضافة كوبون جديد
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isCouponsLoading ? (
                <div className="py-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" /> جاري التحميل...</div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-right text-slate-400">كود الخصم</TableHead>
                      <TableHead className="text-right text-slate-400">نوع الخصم وقيمته</TableHead>
                      <TableHead className="text-right text-slate-400">الاستخدامات</TableHead>
                      <TableHead className="text-right text-slate-400">الحد الأدنى للطلب</TableHead>
                      <TableHead className="text-right text-slate-400">تاريخ الانتهاء</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-left text-slate-400">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couponsList.length === 0 ? (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">لا توجد كوبونات مضافة حالياً.</TableCell>
                      </TableRow>
                    ) : (
                      couponsList.map((c: any) => (
                        <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="font-mono font-bold text-emerald-400">{c.code}</TableCell>
                          <TableCell className="font-semibold text-slate-200">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} ج.م`}
                          </TableCell>
                          <TableCell className="text-slate-300">{c.used_count} / {c.max_uses || "غير محدود"}</TableCell>
                          <TableCell className="text-slate-300">{c.minimum_amount ? `${c.minimum_amount} ج.م` : "بدون حد"}</TableCell>
                          <TableCell className="text-slate-400 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar-EG") : "دائم"}</TableCell>
                          <TableCell>
                            {c.is_active ? (
                              <Badge className="bg-emerald-600 text-white">نشط</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-800 text-slate-400">معطل</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleOpenEditCoupon(c)} className="hover:bg-slate-800 text-slate-300">
                                <Edit2 className="w-4 h-4 me-1 text-emerald-400" />
                                تعديل
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setConfirmModalData({
                                    title: `تأكيد حذف الكوبون (${c.code})`,
                                    desc: "هل أنت متأكد من حذف هذا الكوبون نهائياً؟",
                                    action: () => {
                                      deleteCouponMutation.mutate(c.id);
                                      setConfirmModalData(null);
                                    },
                                  });
                                }}
                                className="hover:bg-rose-950/40 text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maker-Checker Requests Tab */}
        <TabsContent value="requests" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800">
              <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                قائمة التغييرات المالية بانتظار واعتماد الـ Maker-Checker
              </CardTitle>
              <CardDescription className="text-slate-400">
                أي تعديل على الأسعار أو الكوبونات يتطلب موافقة سوبر أدمن آخر (غير نفس الشخص الذي قدم الطلب) لضمان الأمان المالي.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isRequestsLoading ? (
                <div className="py-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" /> جاري التحميل...</div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-right text-slate-400">الموديل والمُعرّف</TableHead>
                      <TableHead className="text-right text-slate-400">طالب التعديل</TableHead>
                      <TableHead className="text-right text-slate-400">التغييرات المطلوبة</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-right text-slate-400">تاريخ الطلب</TableHead>
                      <TableHead className="text-left text-slate-400">الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsList.length === 0 ? (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">لا توجد طلبات تغيير معلقة حالياً.</TableCell>
                      </TableRow>
                    ) : (
                      requestsList.map((req) => (
                        <TableRow key={req.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="font-bold text-slate-200">
                            <div>{req.target_model}</div>
                            <div className="text-xs text-slate-400">ID: #{req.target_id}</div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-300">{req.requested_by_email}</TableCell>
                          <TableCell>
                            <pre className="text-xs bg-slate-950 border border-slate-800 text-slate-300 p-2 rounded max-w-xs overflow-x-auto font-mono dir-ltr text-left">
                              {JSON.stringify(req.new_value, null, 2)}
                            </pre>
                          </TableCell>
                          <TableCell>
                            {req.status === "pending" && <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-950/30">بانتظار الموافقة</Badge>}
                            {req.status === "approved" && <Badge className="bg-emerald-600 text-white">مقبول ومُنشر</Badge>}
                            {req.status === "rejected" && <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20">مرفوض</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">{new Date(req.created_at).toLocaleString("ar-EG")}</TableCell>
                          <TableCell className="text-left">
                            {req.status === "pending" && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => approveMutation.mutate(req.id)}
                                  disabled={approveMutation.isPending}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 me-1" />
                                  موافقة
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectMutation.mutate(req.id)}
                                  disabled={rejectMutation.isPending}
                                  className="text-rose-400 border-rose-800/60 hover:bg-rose-950/50 font-bold text-xs"
                                >
                                  <XCircle className="w-3.5 h-3.5 me-1" />
                                  رفض
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800">
              <CardTitle className="text-lg font-semibold text-slate-100">طلبات سحب الأرباح والمحافظ (Maker-Checker)</CardTitle>
              <CardDescription className="text-slate-400">مراجعة طلبات سحب أرباح المحاضرين والمراكز، وتأكيد التحويلات عبر إنستاباي والمحافظ البنكية.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isPayoutsLoading ? (
                <div className="py-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" /> جاري التحميل...</div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-right text-slate-400">رقم الطلب</TableHead>
                      <TableHead className="text-right text-slate-400">المستخدم / المستفيد</TableHead>
                      <TableHead className="text-right text-slate-400">المبلغ المطلوب</TableHead>
                      <TableHead className="text-right text-slate-400">وسيلة التحويل</TableHead>
                      <TableHead className="text-right text-slate-400">بيانات الحساب</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-right text-slate-400">تاريخ الطلب</TableHead>
                      <TableHead className="text-left text-slate-400">إجراءات الحوكمة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminPayoutsList.length === 0 ? (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                          لا توجد طلبات سحب أرباح مسجلة حالياً.
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminPayoutsList.map((payout: any) => (
                        <TableRow key={payout.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="font-mono font-bold text-slate-200">#{payout.id}</TableCell>
                          <TableCell className="font-semibold text-slate-200">{payout.user_email || "محاضر"}</TableCell>
                          <TableCell className="font-bold text-emerald-400">
                            {Number(payout.amount).toLocaleString("ar-EG")} ج.م
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">{payout.channel_display}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-400">
                            {JSON.stringify(payout.account_details)}
                          </TableCell>
                          <TableCell>
                            {payout.status === "disbursed" ? (
                              <Badge className="bg-emerald-600 text-white">تم التحويل</Badge>
                            ) : payout.status === "approved" ? (
                              <Badge className="bg-blue-600 text-white">معتمد</Badge>
                            ) : payout.status === "rejected" ? (
                              <Badge variant="destructive">مرفوض</Badge>
                            ) : (
                              <Badge className="bg-amber-600 text-white">قيد المراجعة</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {new Date(payout.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell className="text-left">
                            {payout.status === "pending" && (
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => approvePayoutMutation.mutate(payout.id)}
                                  disabled={approvePayoutMutation.isPending}
                                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                                >
                                  اعتماد
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectPayoutMutation.mutate(payout.id)}
                                  disabled={rejectPayoutMutation.isPending}
                                  className="text-xs font-bold"
                                >
                                  رفض
                                </Button>
                              </div>
                            )}
                            {payout.status === "approved" && (
                              <Button
                                size="sm"
                                onClick={() => disbursePayoutMutation.mutate(payout.id)}
                                disabled={disbursePayoutMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                              >
                                تأكيد التحويل والصرف
                              </Button>
                            )}
                            {(payout.status === "disbursed" || payout.status === "rejected") && (
                              <span className="text-xs text-slate-500 font-mono">مكتمل</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Academic Invoices & Center Subscriptions Tab */}
        <TabsContent value="invoices" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-100">
                  طلبات وفواتير اشتراكات السناتر والمراكز التعليمية
                </CardTitle>
                <CardDescription className="text-slate-400">
                  مراجعة عروض الأسعار المحسوبة آلياً بمحرك التسعير الأكاديمي، وتأكيد التحويلات لتفعيل الحسابات الفورية.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isInvoicesLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
                  جاري تحميل الفواتير...
                </div>
              ) : (
                <ResponsiveTable cardBelow="xl">
<Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-right text-slate-400">رقم الفاتورة</TableHead>
                      <TableHead className="text-right text-slate-400">اسم السنتر / المسؤول</TableHead>
                      <TableHead className="text-right text-slate-400">نوع الخطة والمدة</TableHead>
                      <TableHead className="text-right text-slate-400">السعة والشرائح</TableHead>
                      <TableHead className="text-right text-slate-400">المبلغ الصافي</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-right text-slate-400">تاريخ الطلب</TableHead>
                      <TableHead className="text-left text-slate-400">إجراء التفعيل المباشر</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {academicInvoicesList.length === 0 ? (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                          لا توجد طلبات فواتير مسجلة حالياً.
                        </TableCell>
                      </TableRow>
                    ) : (
                      academicInvoicesList.map((inv: any) => (
                        <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="font-mono font-bold text-emerald-400">
                            #{inv.invoice_number || inv.invoiceNumber || inv.id}
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-slate-100">{inv.institution_name || inv.institutionName || "مركز تعليمي"}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              {inv.contact_phone || inv.contactPhone} {(inv.contact_email || inv.contactEmail) && `• ${inv.contact_email || inv.contactEmail}`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold text-slate-200">
                              {(inv.plan_type || inv.planType) === "term" && "اشتراك الترم (خصم 10%)"}
                              {(inv.plan_type || inv.planType) === "full_year" && "العام الكامل (خصم 15%)"}
                              {(inv.plan_type || inv.planType) === "monthly" && "اشتراك شهري"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {inv.calculated_months || inv.calculatedMonths || 0} شهور • حتى {inv.target_end_date || inv.targetEndDate || ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs border-slate-700">
                              {inv.student_count || inv.studentCount || 0} طالب ({inv.student_tiers || inv.studentTiers || 1} شرائح)
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-black text-amber-300 font-mono text-sm">
                              {Number(inv.net_total).toLocaleString("ar-EG")} ج.م
                            </div>
                            {inv.discount_percentage > 0 && (
                              <div className="text-[10px] text-emerald-400">
                                توفير: {Number(inv.discount_amount).toLocaleString("ar-EG")} ج.م
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {inv.status === "pending_payment_confirmation" && (
                              <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-950/30">
                                بانتظار التحويل
                              </Badge>
                            )}
                            {inv.status === "approved_active" && (
                              <Badge className="bg-emerald-600 text-white">
                                مفعل ونشط
                              </Badge>
                            )}
                            {inv.status === "rejected" && (
                              <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                مرفوض
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {new Date(inv.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell className="text-left">
                            {inv.status === "pending_payment_confirmation" ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => approveInvoiceMutation.mutate(inv.id)}
                                  disabled={approveInvoiceMutation.isPending}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 me-1" />
                                  تأكيد الدفع وتفعيل الباقة
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectInvoiceMutation.mutate(inv.id)}
                                  disabled={rejectInvoiceMutation.isPending}
                                  className="text-xs font-bold"
                                >
                                  رفض
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">مكتمل ومفعّل</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
</ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Gateway (Kashier) Configuration Tab */}
        <TabsContent value="gateway" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 text-slate-100 overflow-hidden shadow-xl">
            <CardHeader className="border-b border-slate-800/80 pb-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-white flex items-center gap-2.5">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <span>إعدادات وتفعيل بوابة الدفع الإلكتروني (كاشيير / Kashier)</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400 mt-1 text-xs sm:text-sm leading-relaxed">
                    تحكم مركزي في تشغيل الدفع الإلكتروني. في حال عدم إدخال المفاتيح أو التعطيل، يظهر لجميع المستخدمين في صفحة الأسعار والكورسات خيار &quot;قريباً&quot; تلقائياً.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {gatewayConfig?.is_enabled ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-xs font-black">
                      <CheckCircle className="w-3.5 h-3.5 me-1 text-emerald-400" />
                      الدفع الإلكتروني مفعل (Live)
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-black">
                      <Clock className="w-3.5 h-3.5 me-1 text-amber-400" />
                      في وضع التأجيل (قريباً)
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Dynamic Status Alert */}
              {!gatewayConfig?.is_enabled ? (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs sm:text-sm space-y-2">
                  <div className="font-black flex items-center gap-2 text-amber-300 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>حالة بوابة الدفع حالياً: في انتظار اكتمال الاعتماد المصرفي (قريباً)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed ps-6">
                    صفحة الأسعار، أزرار شراء الكورسات، ومودال الدفع تظهر للمستخدمين الآن بعبارة <strong className="text-amber-300">&quot;الدفع بالبطاقات (قريباً)&quot;</strong> مع توجيههم للقنوات المتاحة حالياً (كود التفعيل، المحافظ، أو التحويل).
                    بمجرد الحصول على بيانات الاعتماد من كاشيير، قم بملء الحقول أدناه وحفظ الإعدادات لتتحول المنصة فوراً وتلقائياً إلى الدفع الإلكتروني الحي.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm space-y-1">
                  <div className="font-black flex items-center gap-2 text-emerald-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>الدفع الإلكتروني شغال بكفاءة 100%</span>
                  </div>
                  <p className="text-slate-300 ps-6">
                    البيانات معتمدة وكاشيير تعمل بوضع ({gatewayConfig.mode === "live" ? "الإنتاج المباشر Live" : "التجريبي Test"}). يمكن للطلاب الآن الدفع الفوري بالفيزا والماستركارد وكارت ميزة.
                  </p>
                </div>
              )}

              {/* Gateway Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80">
                {/* Switch Active */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="space-y-0.5">
                    <label className="text-sm font-black text-white">تفعيل البوابة (Active Switch)</label>
                    <p className="text-xs text-slate-400">تفعيل أو إيقاف استقبال المدفوعات عبر كاشيير مؤقتاً</p>
                  </div>
                  <Switch
                    checked={gatewayForm.is_active}
                    onCheckedChange={(checked) => setGatewayForm((prev) => ({ ...prev, is_active: checked }))}
                  />
                </div>

                {/* Operating Mode */}
                <div className="space-y-2 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <label className="text-sm font-black text-white">بيئة التشغيل (Environment Mode)</label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setGatewayForm((prev) => ({ ...prev, mode: "test" }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        gatewayForm.mode === "test"
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      تجريبي (Sandbox / Test)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewayForm((prev) => ({ ...prev, mode: "live" }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        gatewayForm.mode === "live"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      مباشر (Live / Production)
                    </button>
                  </div>
                </div>

                {/* Merchant ID */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>كود التاجر من كاشيير (Merchant ID)</span>
                  </label>
                  <Input
                    value={gatewayForm.merchant_id}
                    onChange={(e) => setGatewayForm((prev) => ({ ...prev, merchant_id: e.target.value }))}
                    placeholder="مثال: MID-XXXXX-XXX"
                    className="font-mono bg-slate-900 border-slate-800 text-white rounded-xl h-11"
                  />
                  <p className="text-[11px] text-slate-500">يتم تزويدك به في لوحة تحكم كاشيير الخاصة بحساب التاجر المعتمد.</p>
                </div>

                {/* API Key / Secret */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>المفتاح السري للربط (API Secret Key)</span>
                  </label>
                  <Input
                    type="password"
                    value={gatewayForm.api_key}
                    onChange={(e) => setGatewayForm((prev) => ({ ...prev, api_key: e.target.value }))}
                    placeholder="أدخل مفتاح الـ API السري المستلم من كاشيير"
                    className="font-mono bg-slate-900 border-slate-800 text-white rounded-xl h-11"
                  />
                  <p className="text-[11px] text-slate-500">يستخدم لتشفير التوقيع الرقمي وتأكيد العمليات (HMAC-SHA256).</p>
                </div>

                {/* Iframe Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>مفتاح الـ Iframe (Iframe Secret / API Key)</span>
                  </label>
                  <Input
                    type="password"
                    value={gatewayForm.iframe_key}
                    onChange={(e) => setGatewayForm((prev) => ({ ...prev, iframe_key: e.target.value }))}
                    placeholder="مفتاح الـ Iframe لتوليد نوافذ الدفع المنبثقة"
                    className="font-mono bg-slate-900 border-slate-800 text-white rounded-xl h-11"
                  />
                  <p className="text-[11px] text-slate-500">يستخدم لتوقيع عمليات السداد المعروضة مباشرة في المتصفح.</p>
                </div>
              </div>

              {/* Submit / Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-400">
                  آخر تحديث: {gatewayConfig?.updated_at ? new Date(gatewayConfig.updated_at).toLocaleString("ar-EG") : "لم يتم الحفظ مسبقاً"}
                </div>

                <Button
                  onClick={() => saveGatewayMutation.mutate(gatewayForm)}
                  disabled={saveGatewayMutation.isPending || isGatewayLoading}
                  className="w-full sm:w-auto px-8 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/20"
                >
                  {saveGatewayMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                      جاري حفظ الإعدادات وتحديث المنصة...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 me-2" />
                      حفظ إعدادات كاشيير ونشر التحديث
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Edit Modal */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent size="lg" className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100">
              {selectedPlan ? `تعديل خطة الأسعار (${selectedPlan.name})` : "إضافة خطة أسعار جديدة"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              يتم حفظ التعديلات مباشرة في قاعدة البيانات ونشرها فوراً على صفحة الأسعار.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 custom-scrollbar">
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">اسم الخطة:</label>
                <Input
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="مثال: الخطة الاحترافية"
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">الـ Slug (المعرّف):</label>
                <Input
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                  placeholder="مثال: pro"
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">السعر الشهري (ج.م):</label>
                <Input
                  type="number"
                  value={planForm.price_monthly}
                  onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })}
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">السعر السنوي (ج.م):</label>
                <Input
                  type="number"
                  value={planForm.price_yearly}
                  onChange={(e) => setPlanForm({ ...planForm, price_yearly: e.target.value })}
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">الوصف:</label>
              <Input
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={planForm.is_featured}
                  onChange={(e) => setPlanForm({ ...planForm, is_featured: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500"
                />
                <span>تمييز كـ "الأكثر طلباً"</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={planForm.is_active}
                  onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500"
                />
                <span>تفعيل الخطة</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSubmitPlanForm} disabled={savePlanMutation.isPending} className="w-full h-11 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white">
              {savePlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : (selectedPlan ? "حفظ وتحديث الخطة" : "إنشاء الخطة الآن")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Modal */}
      <Dialog open={isCouponModalOpen} onOpenChange={setIsCouponModalOpen}>
        <DialogContent size="lg" className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100">
              {selectedCoupon ? `تعديل الكوبون (${selectedCoupon.code})` : "إضافة كود خصم جديد"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              حدد رمز الكوبون ونوع الخصم ونسبته والشروط المطبقة.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 custom-scrollbar">
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">كود الخصم (Promo Code):</label>
                <Input
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: SAVE30"
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100 font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">نوع الخصم:</label>
                <select
                  value={couponForm.discount_type}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="percent">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (ج.م)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {couponForm.discount_type === "percent" ? "نسبة الخصم (%):" : "قيمة الخصم (ج.م):"}
                </label>
                <Input
                  type="number"
                  value={couponForm.discount_value}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">الحد الأدنى للطلب (ج.م اختياري):</label>
                <Input
                  type="number"
                  value={couponForm.minimum_amount}
                  onChange={(e) => setCouponForm({ ...couponForm, minimum_amount: e.target.value })}
                  placeholder="بدون حد"
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">أقصى عدد استخدامات إجمالي:</label>
                <Input
                  type="number"
                  value={couponForm.max_uses}
                  onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                  placeholder="غير محدود"
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">حد الاستخدام لكل مستخدم:</label>
                <Input
                  type="number"
                  value={couponForm.per_user_limit}
                  onChange={(e) => setCouponForm({ ...couponForm, per_user_limit: e.target.value })}
                  className="rounded-xl bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={couponForm.is_active}
                  onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500"
                />
                <span>تفعيل الكوبون للعمل فوراً</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSubmitCouponForm} disabled={saveCouponMutation.isPending} className="w-full h-11 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white">
              {saveCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : (selectedCoupon ? "حفظ التعديلات" : "إنشاء الكوبون")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmModalData} onOpenChange={(open) => !open && setConfirmModalData(null)}>
        <DialogContent size="sm" className="bg-slate-900 border-slate-800 text-slate-100 text-center">
          <DialogHeader className="pe-0 items-center text-center">
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-2 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-100">{confirmModalData?.title}</DialogTitle>
            <DialogDescription className="text-center text-slate-400">{confirmModalData?.desc}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setConfirmModalData(null)} className="w-full rounded-xl hover:bg-slate-800 text-slate-300">إلغاء</Button>
            <Button onClick={confirmModalData?.action} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl">تأكيد وإرسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
