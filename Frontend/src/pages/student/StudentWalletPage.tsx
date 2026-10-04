import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  KeyRound,
  ShieldCheck,
  CreditCard,
  History,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useStudentWallet, usePlatformPricing } from "@/hooks/usePlatformPricing";
import { useRedeemCode } from "@/features/activation-codes";

export default function StudentWalletPage() {
  const { toast } = useToast();
  const { wallet, isLoadingWallet, ledgerEntries, isLoadingLedger, refetchWallet, refetchLedger } = useStudentWallet();
  const { createKashierSession, isCreatingKashierSession } = usePlatformPricing();
  const { mutate: redeemCode, isPending: isRedeemingCode } = useRedeemCode();

  // Top-Up Modal State
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number | string>(200);

  // Voucher Code Modal State
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherPassword, setVoucherPassword] = useState("");

  const availableBalance = wallet ? Number(wallet.available_balance) : 0;
  const currentBalance = wallet ? Number(wallet.current_balance) : 0;

  const handleStartKashierTopUp = async () => {
    const amountNum = Number(topUpAmount);
    if (!amountNum || amountNum <= 0) {
      toast({
        variant: "destructive",
        title: "مبلغ غير صحيح",
        description: "يرجى إدخال مبلغ شحن أكبر من 0 جنيه.",
      });
      return;
    }

    try {
      const session = await createKashierSession({
        resource_type: "wallet_deposit",
        resource_id: wallet?.id || 0,
        amount: amountNum,
        return_url: window.location.href,
      });

      toast({
        title: "جاري الانتقال لبوابة كاشيير...",
        description: `شحن محفظة بمبلغ ${amountNum} ج.م عبر وسائل الدفع الآمنة.`,
      });

      if (session.checkout_url) {
        window.location.href = session.checkout_url;
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل إنشاء جلسة الشحن",
        description: err?.message || "حدث خطأ أثناء الاتصال ببوابة كاشيير.",
      });
    }
  };

  const handleRedeemVoucher = () => {
    if (!voucherCode.trim() || !voucherPassword.trim()) {
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "يرجى إدخال كود التفعيل وكلمة المرور الخاصة به.",
      });
      return;
    }

    redeemCode(
      { code: voucherCode.trim(), password: voucherPassword.trim() },
      {
        onSuccess: (data: any) => {
          toast({
            title: "تم تفعيل الكود بنجاح! 🎉",
            description: data?.message || "تم شحن وتفعيل المحتوى في حسابك فورياً.",
          });
          setIsVoucherOpen(false);
          setVoucherCode("");
          setVoucherPassword("");
          refetchWallet();
          refetchLedger();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "فشل تفعيل الكود",
            description: err?.response?.data?.error || "كود التفعيل غير صالح أو منتهي الصلاحية.",
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-8 max-w-6xl space-y-8 dir-rtl" dir="rtl">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-emerald-800/40">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-400/30">
                <Wallet className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                محفظتي التعليمية الرقمية
              </h1>
            </div>
            <p className="text-emerald-200 text-sm max-w-xl leading-relaxed">
              اشحن رصيدك واستخدمه للشراء الفوري للكورسات والامتحانات، أو قم بتفعيل كروت الشحن المسبقة بالـ PIN.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsTopUpOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 shadow-lg rounded-xl h-11 px-5"
            >
              <PlusCircle className="w-4 h-4" />
              شحن الرصيد عبر كاشيير
            </Button>
            <Button
              onClick={() => setIsVoucherOpen(true)}
              variant="outline"
              className="border-emerald-400/40 text-emerald-100 hover:bg-emerald-950/60 font-semibold gap-2 rounded-xl h-11 px-5"
            >
              <KeyRound className="w-4 h-4 text-emerald-400" />
              تفعيل كود / كارت شحن
            </Button>
          </div>
        </div>

        {/* Balance KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Available Balance */}
          <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 dark:from-emerald-950/20 dark:via-card dark:to-card rounded-2xl shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  الرصيد المتاح للاستخدام
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                    {isLoadingWallet ? "..." : availableBalance.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">ج.م</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  جاهز للشراء الفوري لأي كورس بنقرة واحدة
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                <ArrowDownLeft className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Total Balance */}
          <Card className="border bg-card rounded-2xl shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  إجمالي الرصيد المحاسبي
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">
                    {isLoadingWallet ? "..." : currentBalance.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">ج.م</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  شامل كافة الإيداعات والتسويات النشطة
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
                <Wallet className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Security & Kashier Protected */}
          <Card className="border bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    محفظة مؤمنة
                  </span>
                </div>
                <p className="text-sm font-bold mt-2">دفع وتشفير معتمد عبر كاشيير</p>
                <p className="text-[11px] text-slate-300 mt-1">
                  معاملات فورية عبر البطاقات والمحافظ وInstaPay
                </p>
              </div>
              <div className="p-3 bg-white/10 text-white rounded-2xl">
                <CreditCard className="w-7 h-7 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Transactions Table */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                سجل حركات ومعاملات المحفظة
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                سجل محاسبي مزدوج دقيق لجميع عمليات الشحن والشراء والاسترداد
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchWallet();
                refetchLedger();
              }}
              className="gap-1.5 text-xs font-semibold rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث السجل
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {isLoadingLedger ? (
              <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>جاري تحميل سجل المعاملات...</span>
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <Wallet className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-semibold">لا توجد معاملات مسجلة في المحفظة حتى الآن.</p>
                <p className="text-xs text-muted-foreground">
                  ابدأ بشحن رصيدك عبر كاشيير أو تفعيل كود شحن لتظهر حركاتك المالية هنا.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-right">نوع الحركة</TableHead>
                      <TableHead className="text-right">البيان / الوصف</TableHead>
                      <TableHead className="text-right">الرقم المرجعي</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">التاريخ والوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell>
                          {entry.entry_type === "credit" ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-400/20 gap-1">
                              <ArrowDownLeft className="w-3 h-3" />
                              إيداع / شحن (+)
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-600 border-rose-400/20 gap-1">
                              <ArrowUpRight className="w-3 h-3" />
                              شراء / خصم (-)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {entry.description}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.reference_id}
                        </TableCell>
                        <TableCell className="font-bold text-sm">
                          <span
                            className={
                              entry.entry_type === "credit"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {entry.entry_type === "credit" ? "+" : "-"}
                            {Number(entry.amount).toLocaleString()} ج.م
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString("ar-EG")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal 1: Kashier Top-Up Modal */}
        <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
          <DialogContent size="md" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                شحن رصيد المحفظة عبر كاشيير
              </DialogTitle>
              <DialogDescription className="text-xs">
                اختر أو أدخل المبلغ المراد شحنه ليتم إضافته فورياً إلى رصيدك المتاح.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-5 py-4 custom-scrollbar">
              {/* Quick Amount Buttons */}
              <div>
                <Label className="text-xs font-bold text-muted-foreground mb-2 block">
                  مبالغ شحن سريعة:
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 200, 500, 1000].map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant={Number(topUpAmount) === amt ? "default" : "outline"}
                      onClick={() => setTopUpAmount(amt)}
                      className="font-bold text-sm h-10 rounded-xl"
                    >
                      {amt} ج.م
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-2">
                <Label htmlFor="topup-amount" className="text-xs font-bold text-muted-foreground">
                  أو أدخل مبلغاً مخصصاً (بالجنيه المصري):
                </Label>
                <div className="relative">
                  <Input
                    id="topup-amount"
                    type="number"
                    min="10"
                    placeholder="مثال: 350"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="text-lg font-bold pe-12 rounded-xl"
                  />
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
                    ج.م
                  </span>
                </div>
              </div>

              {/* Payment Methods Badges */}
              <div className="p-3 bg-muted/50 rounded-xl space-y-1.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">طرق الدفع المتاحة بكاشيير:</p>
                <p>• بطاقات الائتمان وميزة (Visa / Mastercard / Meeza)</p>
                <p>• المحافظ الإلكترونية (فودافون كاش، إنستاباي، أورنج، اتصالات، WE)</p>
                <p>• تقسيط ValU حتى 36 شهراً</p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTopUpOpen(false)}
                disabled={isCreatingKashierSession}
                className="flex-1 rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleStartKashierTopUp}
                disabled={isCreatingKashierSession || !Number(topUpAmount)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl"
              >
                {isCreatingKashierSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `متابعة الدفع (${Number(topUpAmount).toLocaleString()} ج.م)`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 2: Voucher Code Redemption Modal */}
        <Dialog open={isVoucherOpen} onOpenChange={setIsVoucherOpen}>
          <DialogContent size="sm" className="dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                تفعيل كارت شحن أو كود وصول
              </DialogTitle>
              <DialogDescription className="text-xs">
                أدخل كود الكارت المطبوع ورقم الـ PIN السري المرفق.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-3 custom-scrollbar">
              <div className="space-y-1.5">
                <Label htmlFor="v-code" className="text-xs font-bold text-muted-foreground">
                  كود التفعيل (ES-XXXXXXXX):
                </Label>
                <Input
                  id="v-code"
                  placeholder="ES-1234ABCD"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="font-mono font-bold uppercase rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v-pass" className="text-xs font-bold text-muted-foreground">
                  الرقم السري (PIN / Password):
                </Label>
                <Input
                  id="v-pass"
                  type="password"
                  placeholder="••••••••"
                  value={voucherPassword}
                  onChange={(e) => setVoucherPassword(e.target.value)}
                  className="font-mono rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVoucherOpen(false)}
                disabled={isRedeemingCode}
                className="flex-1 rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleRedeemVoucher}
                disabled={isRedeemingCode || !voucherCode.trim() || !voucherPassword.trim()}
                className="flex-1 bg-primary text-primary-foreground font-bold gap-2 rounded-xl"
              >
                {isRedeemingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد التفعيل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
