import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  KeyRound,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Menu,
  X,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth";
import { useCenterOverview } from "@/features/center";

export default function CenterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: overview } = useCenterOverview();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { label: "نظرة عامة", path: "/center/dashboard", icon: LayoutDashboard },
    { label: "المدرسين", path: "/center/instructors", icon: GraduationCap },
    { label: "أكواد التفعيل", path: "/center/activation-codes", icon: KeyRound },
    { label: "الطلاب", path: "/center/students", icon: Users },
    { label: "الباقة والاشتراك", path: "/center/subscription", icon: CreditCard },
    { label: "التقارير", path: "/center/reports", icon: BarChart3 },
    { label: "الإعدادات", path: "/center/settings", icon: Settings },
  ];

  const centerName = overview?.center_info?.institution_name || (overview as any)?.centerInfo?.institutionName || user?.full_name || "المركز التعليمي";
  const remainingQuota = overview?.kpis?.remaining_quota ?? (overview as any)?.kpis?.availableQuota ?? 0;
  const isTrial = overview?.subscription?.is_trial ?? (overview as any)?.subscription?.isTrial ?? true;
  const trialDaysLeft = overview?.subscription?.trial_days_left ?? (overview as any)?.subscription?.daysRemaining ?? 14;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans dir-rtl" dir="rtl">
      {/* Top Center Quick Status Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo / Brand */}
          <Link to="/center/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg font-bold group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wide">{centerName}</span>
                {(overview?.center_info?.is_verified || (overview as any)?.centerInfo?.isVerified) && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    موثق
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-blue-300/70 font-mono">لوحة إدارة السنتر الأكاديمي</p>
            </div>
          </Link>
        </div>

        {/* Live Status Indicators (Quota & Subscription) */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Quota Badge */}
          <Link
            to="/center/activation-codes"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/50 text-blue-200 text-xs hover:border-blue-600 transition"
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
            <span>الكوتة:</span>
            <strong className="text-white font-mono">{remainingQuota} كود</strong>
          </Link>

          {/* Subscription Badge */}
          <Link
            to="/center/subscription"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition ${
              isTrial
                ? "bg-amber-950/60 border-amber-800/50 text-amber-300 hover:border-amber-600"
                : "bg-emerald-950/60 border-emerald-800/50 text-emerald-300 hover:border-emerald-600"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTrial ? `تجربة مجانية (${trialDaysLeft} يوم)` : "باقة مفعّلة"}</span>
          </Link>

          {/* User profile / Logout */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
            <span className="hidden lg:inline text-xs text-slate-300 truncate max-w-[140px]">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-8 w-8"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop RTL Sidebar */}
        <aside className="hidden md:flex w-64 bg-slate-900/95 border-l border-slate-800 flex-col justify-between shrink-0 select-none">
          <div className="p-4 space-y-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
              القائمة الرئيسية
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path === "/center/dashboard" && location.pathname === "/center");
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 font-semibold"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronLeft className="w-4 h-4 text-blue-200" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Card in Sidebar */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
            <div className="bg-gradient-to-br from-blue-900/40 to-indigo-950/60 border border-blue-800/40 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-blue-200">
                <span className="font-semibold">كوتة الأكواد</span>
                <span className="font-mono text-white font-bold">{remainingQuota} كود</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {isTrial ? "باقة التجربة المجانية (50 كود)" : "الباقة الأساسية للمركز"}
              </p>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="w-full text-xs h-7 border-blue-700/60 text-blue-300 hover:bg-blue-600 hover:text-white"
              >
                <Link to="/center/activation-codes">
                  إدارة الأكواد
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                </Link>
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-over Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex" dir="rtl">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="relative w-72 max-w-[85vw] bg-slate-900 border-l border-slate-800 flex flex-col p-4 z-10 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-white text-sm">{centerName}</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-800">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full gap-2 text-xs"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
