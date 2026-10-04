import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  CreditCard,
  Wallet,
  Store,
  Sparkles,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { usePlatformPricing, useStudentWallet } from "@/hooks/usePlatformPricing";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    title: string;
    price: number;
    type?: "course" | "exam";
    instructorName?: string;
    imageUrl?: string;
  };
  onSuccess?: () => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  item,
  onSuccess,
}: CheckoutModalProps) {
  const { toast } = useToast();
  const { createKashierSession, isCreatingKashierSession, validateCoupon, isValidatingCoupon, gatewayStatus } = usePlatformPricing();
  const { wallet, payWithBalance, isPayingWithBalance } = useStudentWallet();

  const isGatewayActive = Boolean(gatewayStatus?.is_enabled);
  const [paymentMethod, setPaymentMethod] = useState<"kashier_card" | "kashier_wallet" | "kashier_valu" | "wallet_balance">("kashier_card");
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const finalPrice = Math.max(0, item.price - discountAmount);
  const availableBalance = wallet ? Number(wallet.available_balance) : 0;
  const isWalletSufficient = availableBalance >= finalPrice;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await validateCoupon({
        code: couponCode.trim().toUpperCase(),
        plan_id: item.id,
        billing_cycle: "monthly",
      });
      setDiscountAmount(Number(res.discount_amount));
      setAppliedCoupon(res.code);
      toast({
        title: "تم تطبيق الكوبون!",
        description: `تم خصم ${res.discount_amount} ج.م بنجاح.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "كوبون غير صالح",
        description: "تأكد من كود الخصم وصلاحيته لهذا المحتوى.",
      });
    }
  };

  const handleConfirmPurchase = async () => {
    if (paymentMethod === "wallet_balance") {
      if (!isWalletSufficient) {
        toast({
          variant: "destructive",
          title: "رصيد المحفظة غير كافٍ",
          description: "يرجى شحن رصيد محفظتك أولاً أو إدخال كود التفعيل.",
        });
        return;
      }
      try {
        await payWithBalance({ course_id: item.id });
        toast({
          title: "تم الشراء بنجاح! 🎉",
          description: `تم تسجيلك في "${item.title}" وتم خصم ${finalPrice} ج.م من رصيدك.`,
        });
        onSuccess?.();
        onClose();
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "فشل إتمام الشراء",
          description: err?.message || "حدث خطأ أثناء الخصم من المحفظة.",
        });
      }
    } else {
      // Kashier Electronic Payment Guard
      if (!isGatewayActive) {
        toast({
          variant: "destructive",
          title: "الدفع الإلكتروني متاح قريباً",
          description: "الدفع الإلكتروني بالبطاقات البنكية قيد المراجعة والاعتماد المصرفي النهائي (قريباً). يمكنك الشراء فوراً عبر رصيد المحفظة أو إدخال كود الكورس.",
        });
        return;
      }

      // Kashier Checkout Session
      try {
        const session = await createKashierSession({
          resource_type: item.type === "exam" ? "exam" : "course",
          resource_id: item.id,
          amount: finalPrice,
          coupon_code: appliedCoupon || undefined,
          return_url: window.location.href,
        });

        toast({
          title: "جاري فتح بوابة الدفع الآمنة...",
          description: "يتم تحويلك إلى نافذة الدفع بكاشيير المشفرة.",
        });

        if (session.checkout_url) {
          window.location.href = session.checkout_url;
        }
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "خطأ في بوابة الدفع",
          description: err?.message || "تعذر إنشاء جلسة الدفع عبر كاشيير. يرجى المحاولة لاحقاً.",
        });
      }
    }
  };

  const isLoading = isCreatingKashierSession || isPayingWithBalance || isValidatingCoupon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md" className="p-0 overflow-hidden dir-rtl" dir="rtl">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-primary/95 to-slate-900 text-white p-5 sm:p-6 shrink-0">
          <DialogHeader className="pe-12">
            <div className="flex justify-between items-start gap-4">
              <div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 mb-2">
                  دفع آمن عبر كاشيير
                </Badge>
                <DialogTitle className="text-xl font-bold text-white">
                  إتمام الاشتراك في المحتوى التعليمي
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-1">
                  {item.title}
                </DialogDescription>
              </div>
              <div className="text-left shrink-0">
                <span className="text-2xl font-black text-emerald-400">
                  {finalPrice.toLocaleString()}
                </span>
                <span className="text-xs text-slate-300 ms-1">ج.م</span>
                {discountAmount > 0 && (
                  <p className="text-[11px] text-slate-400 line-through">
                    {item.price.toLocaleString()} ج.م
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* Coupon Code Section */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Ticket className="w-4 h-4 text-muted-foreground absolute right-3 top-3" />
              <Input
                placeholder="أدخل كود الخصم (إن وجد)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="pe-9 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleApplyCoupon}
              disabled={isLoading || !couponCode.trim()}
              className="shrink-0 text-xs font-bold"
            >
              {isValidatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "تطبيق"}
            </Button>
          </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                اختر وسيلة الدفع المناسبة
              </Label>

              {!isGatewayActive && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">الدفع بالبطاقات البنكية قيد التفعيل حالياً ومتاح قريباً.</strong> يمكنك الشراء فوراً عبر رصيد المحفظة أو إدخال كود التفعيل المطبوع.
                  </span>
                </div>
              )}

              <RadioGroup
                value={paymentMethod}
                onValueChange={(val: any) => setPaymentMethod(val)}
                className="grid gap-3"
              >
                {/* Option 1: Kashier Cards */}
                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    paymentMethod === "kashier_card"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/70 hover:border-border"
                  }`}
                  onClick={() => setPaymentMethod("kashier_card")}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="kashier_card" id="kashier_card" />
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-sm">البطاقات البنكية وميزة</p>
                        <p className="text-xs text-muted-foreground">Visa, Mastercard, Meeza</p>
                      </div>
                    </div>
                  </div>
                  {isGatewayActive ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">
                      فوري
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-500/30">
                      قريباً
                    </Badge>
                  )}
                </div>

                {/* Option 2: Kashier Mobile Wallets */}
                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    paymentMethod === "kashier_wallet"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/70 hover:border-border"
                  }`}
                  onClick={() => setPaymentMethod("kashier_wallet")}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="kashier_wallet" id="kashier_wallet" />
                    <div className="flex items-center gap-2">
                      <Store className="w-5 h-5 text-rose-600" />
                      <div>
                        <p className="font-semibold text-sm">المحافظ الإلكترونية وإنستاباي</p>
                        <p className="text-xs text-muted-foreground">فودافون كاش، إنستاباي، أورنج، اتصالات، WE</p>
                      </div>
                    </div>
                  </div>
                  {isGatewayActive ? (
                    <Badge variant="outline" className="text-[10px] text-rose-600 bg-rose-50 dark:bg-rose-950/40">
                      الأكثر استخداماً
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-500/30">
                      قريباً
                    </Badge>
                  )}
                </div>

                {/* Option 3: ValU Installments */}
                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    paymentMethod === "kashier_valu"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/70 hover:border-border"
                  }`}
                  onClick={() => setPaymentMethod("kashier_valu")}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="kashier_valu" id="kashier_valu" />
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-semibold text-sm">تقسيط ValU</p>
                        <p className="text-xs text-muted-foreground">قسّط حتى 36 شهراً بدون فوائد مع كاشيير</p>
                      </div>
                    </div>
                  </div>
                  {isGatewayActive ? (
                    <Badge variant="outline" className="text-[10px] text-purple-600 bg-purple-50 dark:bg-purple-950/40">
                      تقسيط
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-500/30">
                      قريباً
                    </Badge>
                  )}
                </div>

              {/* Option 4: Student Internal Wallet Balance */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === "wallet_balance"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30"
                    : "border-border/70 hover:border-border"
                }`}
                onClick={() => setPaymentMethod("wallet_balance")}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="wallet_balance" id="wallet_balance" />
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-sm">رصيد محفظتي الرقمية</p>
                      <p className="text-xs text-muted-foreground">
                        الرصيد المتاح: <span className="font-bold text-emerald-600">{availableBalance} ج.م</span>
                      </p>
                    </div>
                  </div>
                </div>
                {!isWalletSufficient && (
                  <Badge variant="destructive" className="text-[10px]">
                    رصيد غير كافٍ
                  </Badge>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Trust Security Footer */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>معاملات مشفرة 256-bit عبر خوادم كاشيير المعتمدة</span>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-0 flex-row gap-2 mt-0 border-t-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleConfirmPurchase}
            disabled={isLoading || (paymentMethod === "wallet_balance" && !isWalletSufficient)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `تأكيد ودفع ${finalPrice.toLocaleString()} ج.م`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
