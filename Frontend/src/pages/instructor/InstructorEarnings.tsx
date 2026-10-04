import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import {
  Wallet,
  DollarSign,
  TrendingUp,
  CreditCard,
  Percent,
  Plus,
  RefreshCw,
  AlertTriangle,
  Receipt,
  Ticket,
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
  useInstructorEarnings,
  useInstructorCoupons,
  useCreateInstructorCoupon,
  usePayouts,
} from "@/features/instructor/academicToolsHooks";
import { useToast } from "@/components/ui/use-toast";

type PayoutChannel = "instapay" | "mobile_wallet" | "bank_wire";
type PayoutAccountDetails = Record<string, string>;

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("ar-EG");
  } catch {
    return "-";
  }
}

export default function InstructorEarnings() {
  const { toast } = useToast();
  const {
    data: earnings,
    isLoading: isEarningsLoading,
    isError: isEarningsError,
    refetch: refetchEarnings,
  } = useInstructorEarnings();
  const {
    data: rawCoupons = [],
    isLoading: isCouponsLoading,
  } = useInstructorCoupons();
  const coupons: any[] = Array.isArray(rawCoupons) ? rawCoupons : [];

  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("15");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");

  const createCouponMutation = useCreateInstructorCoupon();

  const handleCreateCoupon = () => {
    if (!newCouponCode.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال كود الكوبون.", variant: "destructive" });
      return;
    }
    createCouponMutation.mutate(
      {
        code: newCouponCode.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: newCouponDiscount,
        is_active: true,
      },
      {
        onSuccess: () => {
          toast({ title: "تم بنجاح", description: "تم إنشاء الكوبون بنجاح!" });
          setIsCouponDialogOpen(false);
          setNewCouponCode("");
        },
        onError: (error) => {
          toast({
            title: "خطأ",
            description: error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الكوبون.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutChannel, setPayoutChannel] = useState<PayoutChannel>("instapay");
  const [instapayAddress, setInstapayAddress] = useState("");
  const [walletPhone, setWalletPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");

  const {
    payouts: rawPayouts = [],
    isLoadingPayouts,
    requestPayout,
    isRequestingPayout,
    refetchPayouts,
  } = usePayouts();
  const payouts: any[] = Array.isArray(rawPayouts) ? rawPayouts : [];

  const handleCreatePayout = async () => {
    const amt = Number(payoutAmount);
    if (!amt || amt < 500) {
      toast({
        variant: "destructive",
        title: "المبلغ غير صالح",
        description: "الحد الأدنى لطلب سحب الأرباح هو 500 ج.م.",
      });
      return;
    }

    const available = Number(earnings?.available_balance ?? (earnings as any)?.availableBalance ?? 0);
    if (earnings && amt > available) {
      toast({
        variant: "destructive",
        title: "رصيد غير كافٍ",
        description: "المبلغ المطلوب يتجاوز الرصيد المتاح للسحب حالياً.",
      });
      return;
    }

    const accountDetails: PayoutAccountDetails = {};
    if (payoutChannel === "instapay") {
      if (!instapayAddress.trim()) {
        toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى إدخال عنوان إنستاباي (IPA) أو رقم الهاتف المسجل." });
        return;
      }
      accountDetails.instapay_address = instapayAddress.trim();
    } else if (payoutChannel === "mobile_wallet") {
      if (!walletPhone.trim()) {
        toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى إدخال رقم محفظة المحمول." });
        return;
      }
      accountDetails.phone = walletPhone.trim();
    } else {
      if (!bankIban.trim() || !bankName.trim()) {
        toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى إدخال اسم البنك ورقم الآيبان (IBAN)." });
        return;
      }
      accountDetails.bank_name = bankName.trim();
      accountDetails.iban = bankIban.trim();
    }

    try {
      await requestPayout({
        amount: amt,
        channel: payoutChannel,
        account_details: accountDetails,
      });
      toast({
        title: "تم إرسال طلب السحب بنجاح! 🎉",
        description: `تم حجز ${Number(amt || 0).toLocaleString()} ج.م وسيتم التحويل بعد مراجعة الإدارة (خلال 24-48 ساعة).`,
      });
      setIsPayoutDialogOpen(false);
      setPayoutAmount("");
      await Promise.all([refetchEarnings(), refetchPayouts()]);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "فشل إرسال طلب السحب",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء معالجة طلب السحب.",
      });
    }
  };

  const availableBalance = Number(earnings?.available_balance ?? (earnings as any)?.availableBalance ?? 0);
  const grossRevenue = Number(earnings?.gross_revenue ?? (earnings as any)?.grossRevenue ?? 0);
  const pendingPayout = Number(earnings?.pending_payout ?? (earnings as any)?.pendingPayout ?? 0);
  const currency = earnings?.currency || "ج.م";

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 space-y-6 dir-rtl" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/20 shadow-sm">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3 text-foreground">
              <Wallet className="w-8 h-8 text-primary" />
              الأرباح والتحصيلات المالية
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              متابعة المبيعات، المحفظة المالية، دورة تجميد الأمان (14-Day Escrow)، وطلبات السحب عبر إنستاباي والمحافظ الإلكترونية.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsPayoutDialogOpen(true)}
              disabled={!earnings || availableBalance < 500}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              طلب سحب الأرباح (حد أدنى 500 ج.م)
            </Button>
          </div>
        </div>

        {isEarningsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {isEarningsError && !isEarningsLoading && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">تعذر تحميل المحفظة المالية</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
              حدث خطأ أثناء جلب تفاصيل المبيعات والأرباح.
            </p>
            <Button onClick={() => refetchEarnings()} variant="outline" className="gap-2 border-amber-400">
              <RefreshCw className="w-4 h-4" /> إعادة المحاولة
            </Button>
          </Card>
        )}

        {!isEarningsLoading && !isEarningsError && earnings && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">إجمالي المبيعات</p>
                  <h3 className="text-2xl font-black mt-1 text-foreground">
                    {grossRevenue.toLocaleString()} {currency}
                  </h3>
                </div>
                <div className="p-3 bg-sky-100 dark:bg-sky-950/50 text-sky-600 rounded-xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">الرصيد المتاح للسحب</p>
                  <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {availableBalance.toLocaleString()} {currency}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">جاهز للتحويل الفوري</p>
                </div>
                <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-xl">
                  <Wallet className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">رصيد الأمان المعلق</p>
                  <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {pendingPayout.toLocaleString()} {currency}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">يتحرر بعد دورة الأمان</p>
                </div>
                <div className="p-3 bg-amber-500/20 text-amber-600 rounded-xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">نسبة المحاضر / المنصة</p>
                  <h3 className="text-2xl font-black text-primary mt-1">
                    {(() => {
                      const sharePct = earnings.instructor_share_pct ?? (earnings as any).instructorSharePct;
                      const commPct = earnings.platform_commission_pct ?? (earnings as any).platformCommissionPct;
                      if (sharePct == null) return "غير محددة";
                      return `${sharePct}%${commPct != null ? ` / ${commPct}%` : ""}`;
                    })()}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">وفق العقد المالي للمنصة</p>
                </div>
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <Percent className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="transactions" className="gap-2 text-xs sm:text-sm">
              <Receipt className="w-4 h-4" /> سجل المبيعات
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2 text-xs sm:text-sm">
              <Ticket className="w-4 h-4" /> الكوبونات
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2 text-xs sm:text-sm">
              <CreditCard className="w-4 h-4" /> طلبات السحب
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-lg font-bold">آخر المعاملات المالية للدورات</CardTitle>
                <CardDescription>تفاصيل المبيعات وصافي الأرباح لكل دورة تعليمية</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  const recentTransactions = earnings?.recent_transactions ?? (earnings as any)?.recentTransactions ?? [];
                  return recentTransactions.length > 0 ? (
                    <>
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead className="text-right">اسم الدورة</TableHead>
                              <TableHead className="text-right">عدد الطلاب</TableHead>
                              <TableHead className="text-right">إجمالي المبيعات</TableHead>
                              <TableHead className="text-right">صافي أرباح المحاضر</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recentTransactions.map((tx: any) => {
                              const gross = Number(tx.gross_amount ?? tx.grossAmount ?? 0);
                              const net = tx.net_amount ?? tx.netAmount;
                              return (
                                <TableRow key={tx.id} className="hover:bg-muted/40">
                                  <TableCell className="font-semibold">{tx.course_title || tx.courseTitle}</TableCell>
                                  <TableCell>{tx.student_count ?? tx.studentCount ?? 0} طالب</TableCell>
                                  <TableCell className="font-bold">
                                    {gross.toLocaleString()} ج.م
                                  </TableCell>
                                  <TableCell className="font-bold text-emerald-600">
                                    {net == null ? "غير متاح" : `${Number(net).toLocaleString()} ج.م`}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="md:hidden p-4 space-y-3">
                        {recentTransactions.map((tx: any) => {
                          const gross = Number(tx.gross_amount ?? tx.grossAmount ?? 0);
                          const net = tx.net_amount ?? tx.netAmount;
                          return (
                            <div key={tx.id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
                              <h4 className="font-bold text-sm">{tx.course_title || tx.courseTitle}</h4>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>الطلاب: {tx.student_count ?? tx.studentCount ?? 0}</span>
                                <span>المبيعات: {gross.toLocaleString()} ج.م</span>
                              </div>
                              <div className="pt-2 border-t flex justify-between items-center text-xs">
                                <span className="font-semibold">صافي أرباحك:</span>
                                <span className="font-bold text-emerald-600 text-sm">
                                  {net == null ? "غير متاح" : `${Number(net).toLocaleString()} ج.م`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">لا توجد معاملات مدفوعة سابقة.</div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coupons" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">كوبونات الخصم</CardTitle>
                  <CardDescription>إنشاء وتتبع كودات الخصم لطلابك</CardDescription>
                </div>
                <Button onClick={() => setIsCouponDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-4 h-4" /> إنشاء كوبون جديد
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isCouponsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">جاري تحميل الكوبونات...</div>
                ) : coupons.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="text-right">كود الكوبون</TableHead>
                            <TableHead className="text-right">نوع الخصم</TableHead>
                            <TableHead className="text-right">قيمة الخصم</TableHead>
                            <TableHead className="text-right">الاستخدامات</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {coupons.map((coupon: any) => {
                            const discountType = coupon.discount_type ?? coupon.discountType ?? "percent";
                            const discountValue = coupon.discount_value ?? coupon.discountValue ?? "0";
                            const usedCount = coupon.used_count ?? coupon.usedCount ?? 0;
                            const maxUses = coupon.max_uses ?? coupon.maxUses;
                            const isActive = Boolean(coupon.is_active ?? coupon.isActive ?? false);
                            return (
                              <TableRow key={coupon.id} className="hover:bg-muted/40">
                                <TableCell className="font-mono font-bold text-primary">{coupon.code}</TableCell>
                                <TableCell>{discountType === "percent" ? "نسبة مئوية (%)" : "مبلغ ثابت (ج.م)"}</TableCell>
                                <TableCell className="font-bold">
                                  {discountValue} {discountType === "percent" ? "%" : "ج.م"}
                                </TableCell>
                                <TableCell>{usedCount} / {maxUses ?? "غير محدود"}</TableCell>
                                <TableCell>
                                  {isActive ? (
                                    <Badge className="bg-emerald-600 text-white">نشط</Badge>
                                  ) : (
                                    <Badge variant="outline">معطل</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden p-4 space-y-3">
                      {coupons.map((coupon: any) => {
                        const discountType = coupon.discount_type ?? coupon.discountType ?? "percent";
                        const discountValue = coupon.discount_value ?? coupon.discountValue ?? "0";
                        const usedCount = coupon.used_count ?? coupon.usedCount ?? 0;
                        const maxUses = coupon.max_uses ?? coupon.maxUses;
                        const isActive = Boolean(coupon.is_active ?? coupon.isActive ?? false);
                        return (
                          <div key={coupon.id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-base text-primary">{coupon.code}</span>
                              {isActive ? (
                                <Badge className="bg-emerald-600 text-white text-[11px]">نشط</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px]">معطل</Badge>
                              )}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>الخصم: {discountValue} {discountType === "percent" ? "%" : "ج.م"}</span>
                              <span>الاستخدام: {usedCount} / {maxUses ?? "∞"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">لم تقم بإنشاء أي كوبونات خصم بعد.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            <Card className="border shadow-sm">
              <CardHeader className="py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">سجل طلبات سحب الأرباح</CardTitle>
                  <CardDescription>متابعة حالة التحويلات البنكية ومحافظ المحمول وإنستاباي</CardDescription>
                </div>
                <Button
                  onClick={() => setIsPayoutDialogOpen(true)}
                  disabled={!earnings || availableBalance < 500}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4" /> طلب سحب جديد
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingPayouts ? (
                  <div className="p-8 text-center text-muted-foreground">جاري تحميل طلبات السحب...</div>
                ) : payouts.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="text-right">رقم الطلب</TableHead>
                            <TableHead className="text-right">المبلغ المطلوب</TableHead>
                            <TableHead className="text-right">وسيلة التحويل</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                            <TableHead className="text-right">الرقم المرجعي</TableHead>
                            <TableHead className="text-right">تاريخ الطلب</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payouts.map((p: any) => {
                            const amount = Number(p.amount ?? 0);
                            const channelDisplay = p.channel_display || p.channelDisplay || p.channel || "—";
                            const transactionRef = p.transaction_reference || p.transactionReference || "—";
                            const createdAt = p.created_at || p.createdAt;
                            return (
                              <TableRow key={p.id} className="hover:bg-muted/40">
                                <TableCell className="font-mono font-bold">#{p.id}</TableCell>
                                <TableCell className="font-bold text-emerald-600">{amount.toLocaleString()} ج.م</TableCell>
                                <TableCell><Badge variant="outline" className="font-semibold">{channelDisplay}</Badge></TableCell>
                                <TableCell>
                                  {p.status === "disbursed" ? (
                                    <Badge className="bg-emerald-600 text-white">تم التحويل</Badge>
                                  ) : p.status === "approved" ? (
                                    <Badge className="bg-sky-600 text-white">معتمد (جاري الصرف)</Badge>
                                  ) : p.status === "rejected" ? (
                                    <Badge variant="destructive">مرفوض</Badge>
                                  ) : (
                                    <Badge className="bg-amber-500 text-white">قيد المراجعة</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{transactionRef}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{formatDateSafe(createdAt)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden p-4 space-y-3">
                      {payouts.map((p: any) => {
                        const amount = Number(p.amount ?? 0);
                        const channelDisplay = p.channel_display || p.channelDisplay || p.channel || "—";
                        const createdAt = p.created_at || p.createdAt;
                        return (
                          <div key={p.id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-foreground">طلب #{p.id}</span>
                              {p.status === "disbursed" ? (
                                <Badge className="bg-emerald-600 text-white text-[11px]">تم التحويل</Badge>
                              ) : p.status === "approved" ? (
                                <Badge className="bg-sky-600 text-white text-[11px]">معتمد</Badge>
                              ) : p.status === "rejected" ? (
                                <Badge variant="destructive" className="text-[11px]">مرفوض</Badge>
                              ) : (
                                <Badge className="bg-amber-500 text-white text-[11px]">قيد المراجعة</Badge>
                              )}
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-emerald-600 text-sm">{amount.toLocaleString()} ج.م</span>
                              <Badge variant="outline" className="text-[11px]">{channelDisplay}</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">التاريخ: {formatDateSafe(createdAt)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">لا توجد طلبات سحب سابقة.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payout Modal */}
        <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
          <DialogContent size="md" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                طلب سحب الأرباح المستحقة
              </DialogTitle>
              <DialogDescription className="text-xs">
                الحد الأدنى للسحب 500 ج.م. الرصيد المتاح حالياً:{" "}
                <strong className="text-emerald-600">{availableBalance.toLocaleString()} ج.م</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-3 custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">المبلغ المراد سحبه (ج.م)</label>
                <Input
                  type="number"
                  min="500"
                  max={availableBalance}
                  placeholder="500 كحد أدنى"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="text-lg font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">وسيلة استلام الأرباح</label>
                <select
                  value={payoutChannel}
                  onChange={(e) => setPayoutChannel(e.target.value as PayoutChannel)}
                  className="w-full h-10 px-3 rounded-xl border border-input text-sm font-semibold bg-background"
                >
                  <option value="instapay">إنستاباي (InstaPay)</option>
                  <option value="mobile_wallet">محفظة إلكترونية (فودافون كاش / أورنج / اتصالات / وي)</option>
                  <option value="bank_wire">تحويل بنكي (IBAN)</option>
                </select>
              </div>

              {payoutChannel === "instapay" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground block">عنوان إنستاباي (IPA) أو رقم الهاتف المسجل</label>
                  <Input placeholder="username@instapay أو 010xxxxxxxx" value={instapayAddress} onChange={(e) => setInstapayAddress(e.target.value)} />
                </div>
              )}

              {payoutChannel === "mobile_wallet" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground block">رقم محفظة المحمول المسجلة</label>
                  <Input placeholder="010xxxxxxxx / 011xxxxxxxx / 012xxxxxxxx" value={walletPhone} onChange={(e) => setWalletPhone(e.target.value)} />
                </div>
              )}

              {payoutChannel === "bank_wire" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">اسم البنك والفرع</label>
                    <Input placeholder="مثال: البنك الأهلي المصري - فرع المهندسين" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">رقم الآيبان (IBAN) أو رقم الحساب</label>
                    <Input placeholder="EG0000000000000000000000000" value={bankIban} onChange={(e) => setBankIban(e.target.value)} className="font-mono" />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setIsPayoutDialogOpen(false)}>إلغاء</Button>
              <Button
                onClick={handleCreatePayout}
                disabled={isRequestingPayout || !payoutAmount || Number(payoutAmount) < 500}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              >
                {isRequestingPayout ? "جاري إرسال الطلب..." : "تأكيد طلب السحب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Coupon Modal */}
        <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
          <DialogContent size="md" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                إنشاء كوبون خصم جديد
              </DialogTitle>
              <DialogDescription>حدد كود الكوبون وقيمة الخصم لتوفير عروض لطلابك.</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 custom-scrollbar">
              <div>
                <label className="text-sm font-semibold mb-1 block">كود الكوبون (الرمز)</label>
                <Input placeholder="مثال: START2026" value={newCouponCode} onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())} className="font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">نوع الخصم</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")} className="w-full h-10 px-3 rounded-md border text-sm bg-background">
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">قيمة الخصم</label>
                  <Input type="number" placeholder="15" value={newCouponDiscount} onChange={(e) => setNewCouponDiscount(e.target.value)} />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setIsCouponDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleCreateCoupon} disabled={createCouponMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {createCouponMutation.isPending ? "جاري الإنشاء..." : "حفظ وإنشاء الكوبون"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
