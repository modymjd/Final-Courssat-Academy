import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInstructorEarnings, useInstructorCoupons } from "@/features/instructor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Ticket,
  KeyRound,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

export const InstructorEarningsTab: React.FC = () => {
  const { data: earnings, isLoading: isEarningsLoading } = useInstructorEarnings();
  const { data: coupons, isLoading: isCouponsLoading } = useInstructorCoupons();

  const transactions = useMemo(() => {
    if (!earnings) return [];
    return earnings.recent_transactions || earnings.recentTransactions || [];
  }, [earnings]);

  const couponsList = useMemo(() => {
    if (!coupons) return [];
    return Array.isArray(coupons) ? coupons : [];
  }, [coupons]);

  const availableBalance = earnings?.available_balance ?? earnings?.availableBalance ?? 0;
  const netEarnings = earnings?.net_earnings ?? earnings?.netEarnings ?? 0;
  const pendingPayout = earnings?.pending_payout ?? earnings?.pendingPayout ?? 0;
  const currency = earnings?.currency || "ج.م";

  if (isEarningsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-3xl" />
          ))}
        </div>
        <div className="h-64 bg-muted/40 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 3 Financial Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Available Balance Card */}
        <Card className="rounded-3xl border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">الرصيد المتاح للسحب</span>
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-600">
                <Wallet size={20} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {availableBalance.toLocaleString("ar-EG")} <span className="text-sm font-medium">{currency}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">جاهز للتحويل الفوري إلى محفظتك</p>
            </div>
            <Button
              asChild
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm gap-1.5"
            >
              <Link to="/instructor/earnings">
                <ArrowDownLeft size={16} />
                <span>طلب سحب أرباح (إنستاباي / محفظة)</span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Total Net Earnings Card */}
        <Card className="rounded-3xl border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">صافي الأرباح المحققة</span>
              <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {netEarnings.toLocaleString("ar-EG")} <span className="text-sm font-medium">{currency}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">إجمالي ما تم تحقيقه بعد عمولة المنصة</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl text-xs font-bold border-blue-500/30 text-blue-600 hover:bg-blue-500/10 gap-1.5"
            >
              <Link to="/instructor/earnings">
                <span>عرض كشف الحساب التفصيلي</span>
                <ArrowLeft size={14} />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Pending Payout Card */}
        <Card className="rounded-3xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">تحويلات قيد التنفيذ</span>
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600">
                <Clock size={20} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {pendingPayout.toLocaleString("ar-EG")} <span className="text-sm font-medium">{currency}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">طلبات سحب جاري مراجعتها وتحويلها</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl text-xs font-bold border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5"
            >
              <Link to="/instructor/earnings">
                <span>تتبع حالة طلبات السحب</span>
                <ArrowLeft size={14} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 2-Column Grid: Transactions & Codes/Coupons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Transactions List (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-3xl border-border/70 bg-card overflow-hidden shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-600" />
                  <span>أحدث المبيعات والعمليات المالية</span>
                </span>
                <Link
                  to="/instructor/earnings"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>كشف الحساب</span>
                  <ArrowLeft size={12} />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {transactions.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                    <DollarSign size={22} />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">لا توجد عمليات بيع مسجلة مؤخراً</h4>
                  <p className="text-[11px] text-muted-foreground">
                    عندما يقوم الطلاب بشراء دوراتك ستظهر المبالغ وتفاصيل المشترك هنا مباشرة
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-muted/25 hover:bg-muted/40 transition-colors rounded-2xl border border-border/40 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {tx.course_title || tx.courseTitle || "اشتراك كورس"}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>{tx.student_count || tx.studentCount || 1} طالب</span>
                          {tx.date && <span>• {new Date(tx.date).toLocaleDateString("ar-EG")}</span>}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          +{(tx.net_amount ?? tx.netAmount ?? tx.gross_amount ?? tx.grossAmount ?? 0).toLocaleString("ar-EG")}{" "}
                          {currency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Codes & Coupons Launcher (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Activation Codes Launcher Card */}
          <Card className="rounded-3xl border-amber-500/30 bg-card overflow-hidden shadow-sm">
            <CardHeader className="pb-3 bg-amber-500/10 border-b border-amber-500/20">
              <CardTitle className="text-sm font-bold flex items-center justify-between text-amber-700 dark:text-amber-400">
                <span className="flex items-center gap-2">
                  <KeyRound size={18} />
                  <span>كروت وأكواد التفعيل للمراكز والطلاب</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                أنشئ دفعات أكواد مطبوعة (كروت خدش) لتوزيعها في السناتر أو أكواد تفعيل مباشرة لطلابك الخاصين
                بأعلى حماية وتشفير.
              </p>
              <Button
                asChild
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm gap-1.5"
              >
                <Link to="/instructor/activation-codes">
                  <KeyRound size={16} />
                  <span>توليد وإدارة كروت الأكواد</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Active Coupons Mini List */}
          <Card className="rounded-3xl border-border/70 bg-card overflow-hidden shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
              <CardTitle className="text-xs sm:text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Ticket size={16} className="text-primary" />
                  <span>كوبونات الخصم النشطة</span>
                </span>
                <Link
                  to="/instructor/earnings"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  إدارة
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 divide-y divide-border/40">
              {couponsList.length === 0 ? (
                <div className="text-center py-4 space-y-1">
                  <p className="text-xs text-muted-foreground">لا توجد كوبونات خصم نشطة</p>
                  <Button asChild variant="link" size="sm" className="text-xs p-0 text-primary font-bold">
                    <Link to="/instructor/earnings">إنشاء أول كوبون</Link>
                  </Button>
                </div>
              ) : (
                couponsList.slice(0, 3).map((cp) => (
                  <div key={cp.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border/60">
                        {cp.code}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        استُخدم {cp.used_count || 0} مرات
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
                      {cp.discount_type === "percent" ? `${cp.discount_value}%` : `${cp.discount_value} ج.م`}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstructorEarningsTab;
