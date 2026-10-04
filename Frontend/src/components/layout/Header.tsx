import React, { useRef, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ChevronDown,
  LayoutGrid,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  User,
  Users,
  X,
  CreditCard,
  School,
  FileCheck,
  Info,
  BookOpen,
  BookMarked,
  Gift,
  Building2,
  GraduationCap,
  Ticket,
  BarChart3,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import ThemeToggle from "../theme/ThemeToggle";
import { useAuth } from "@/features/auth";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { ExploreMegaMenu } from "./ExploreMegaMenu";
import { NotificationDropdown } from "./NotificationDropdown";

export default function Header(): React.ReactElement {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>("stages");
  const { user, isAuthenticated, logout } = useAuth();
  const { data: themeData } = usePlatformTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [headerSearch, setHeaderSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifTimeout = useRef<ReturnType<typeof setTimeout>>();
  const profileTimeout = useRef<ReturnType<typeof setTimeout>>();
  const exploreTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Close menus on route change
  useEffect(() => {
    setExploreOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Smooth Hover Handlers for Explore Mega Menu
  const handleExploreEnter = () => {
    clearTimeout(exploreTimeout.current);
    setExploreOpen(true);
  };

  const handleExploreLeave = () => {
    exploreTimeout.current = setTimeout(() => {
      setExploreOpen(false);
    }, 120);
  };

  // Notifications Hover Handlers
  const openNotif = () => {
    clearTimeout(notifTimeout.current);
    setNotifOpen(true);
  };
  const closeNotif = () => {
    notifTimeout.current = setTimeout(() => setNotifOpen(false), 150);
  };

  // Profile Hover Handlers
  const openProfile = () => {
    clearTimeout(profileTimeout.current);
    setProfileOpen(true);
  };
  const closeProfile = () => {
    profileTimeout.current = setTimeout(() => setProfileOpen(false), 150);
  };

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerSearch.trim()) {
      navigate(`/courses?search=${encodeURIComponent(headerSearch.trim())}`);
    } else {
      navigate("/courses");
    }
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`
    : "";
  const rawSiteName = themeData?.site_name ? themeData.site_name.replace(" - EduSmart", "") : "كورسات";
  const logoSrc = themeData?.logoUrl && !themeData.logoUrl.endsWith("/logo.png") && themeData.logoUrl !== "/logo.png"
    ? themeData.logoUrl
    : "/logo-icon.png";

  return (
    <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 transition-all shadow-2xs">
      <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Right Section: Brand & Explore Button */}
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0 min-w-0">
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-muted text-foreground shrink-0 transition-colors outline-none focus:outline-none focus:ring-0"
              aria-label={mobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}

          {/* Logo with Creative Arabic Calligraphy Typography & Optical Symmetry */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group select-none">
            <div className="relative flex items-center justify-center shrink-0 w-8 h-8 sm:w-10 sm:h-10">
              <img
                src={logoSrc}
                alt={rawSiteName}
                className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105 drop-shadow-xs"
              />
            </div>
            <span className="font-calligraphy text-2xl sm:text-3xl font-bold text-primary tracking-normal leading-none select-none transition-colors group-hover:text-primary/90 whitespace-nowrap shrink-0">
              {rawSiteName}
            </span>
          </Link>

          {/* Desktop Explore Button (Hover activated + smooth micro-interaction) */}
          {!isMobile && (
            <div
              className="relative"
              onMouseEnter={handleExploreEnter}
              onMouseLeave={handleExploreLeave}
            >
              <button
                type="button"
                onClick={() => setExploreOpen((v) => !v)}
                aria-label="استكشف"
                className={`group flex items-center gap-2 px-3 lg:px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-colors duration-150 outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 select-none ${
                  exploreOpen
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20"
                }`}
                aria-expanded={exploreOpen}
                aria-haspopup="dialog"
              >
                <LayoutGrid size={16} className={`transition-transform duration-200 ${exploreOpen ? "rotate-90 text-primary-foreground" : "group-hover:rotate-45"}`} />
                <span className="font-bold hidden lg:inline">استكشف</span>
                <ChevronDown
                  size={14}
                  className={`hidden lg:block transition-transform duration-200 ${exploreOpen ? "rotate-180" : ""}`}
                />
              </button>

              <ExploreMegaMenu
                isOpen={exploreOpen}
                onClose={() => setExploreOpen(false)}
                onMouseEnter={handleExploreEnter}
                onMouseLeave={handleExploreLeave}
              />
            </div>
          )}
        </div>

        {/* Center Section: Creative Minimalist Search Pill (Desktop) */}
        <form
          onSubmit={handleHeaderSearch}
          className="hidden md:flex items-center relative flex-1 min-w-0 md:max-w-64 lg:max-w-80 xl:max-w-96"
        >
          <Search
            className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            size={16}
          />
          <Input
            placeholder="ابحث عن مادة، مرحلة، أو دورة تعليمية..."
            value={headerSearch}
            onChange={(e) => setHeaderSearch(e.target.value)}
            className="w-full ps-4 pe-10 h-10 text-xs font-medium rounded-full bg-muted/40 hover:bg-muted/60 border-border/70 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-0 outline-none focus:outline-none transition-all"
          />
        </form>

        {/* Left Section: Theme Toggle & Clean Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <ThemeToggle />

          {!isAuthenticated ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-full font-bold text-xs h-8 sm:h-9 px-2.5 sm:px-3.5 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors shrink-0 outline-none focus:outline-none focus:ring-0"
              >
                <Link to="/login" className="flex items-center gap-1 sm:gap-1.5">
                  <User size={14} className="shrink-0" />
                  <span className="hidden sm:inline">تسجيل الدخول</span>
                  <span className="sm:hidden">دخول</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="hidden sm:inline-flex rounded-full font-bold text-xs h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 shrink-0"
              >
                <Link to="/register" className="flex items-center gap-1.5">
                  <Sparkles size={14} className="shrink-0" />
                  <span>حساب جديد</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Notifications */}
              <NotificationDropdown
                open={notifOpen}
                onOpenChange={setNotifOpen}
                onMouseEnter={openNotif}
                onMouseLeave={closeNotif}
              />

              {/* Profile Menu */}
              <DropdownMenu modal={false} open={profileOpen} onOpenChange={setProfileOpen}>
                <div onMouseEnter={openProfile} onMouseLeave={closeProfile}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 sm:gap-2 rounded-full p-1 sm:px-2.5 sm:py-1 h-8 sm:h-9 hover:bg-muted/70 border border-border/60 transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 select-none shrink-0"
                    >
                      <Avatar className="w-6 h-6 sm:w-7 sm:h-7 border border-primary/30 shrink-0">
                        <AvatarImage src={user?.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden lg:inline font-bold text-xs max-w-[120px] truncate text-foreground">
                        {user?.fullName}
                      </span>
                      <ChevronDown size={13} className="text-muted-foreground hidden lg:inline" />
                    </button>
                  </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent
                  align="end"
                  onMouseEnter={openProfile}
                  onMouseLeave={closeProfile}
                  className="w-[calc(100vw-1.5rem)] max-w-[280px] p-2 rounded-2xl border border-border/80 shadow-xl bg-card text-card-foreground outline-none focus:outline-none"
                >
                  {/* User Card Header */}
                  <div className="p-3 mb-1.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-primary/30 shrink-0">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-sm truncate text-foreground">{user?.fullName}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {user?.email || "حساب تعليمي"}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit bg-primary/10 text-primary">
                        {user?.role === "center" && <Building2 size={11} />}
                        {user?.role === "instructor" && <GraduationCap size={11} />}
                        {user?.role === "admin" && <ShieldCheck size={11} />}
                        {user?.role === "super_admin" && <ShieldCheck size={11} />}
                        {user?.role === "guardian" && <Users size={11} />}
                        {user?.role === "student" && <Sparkles size={11} />}
                        <span>
                          {user?.role === "admin"
                            ? "مدير النظام"
                            : user?.role === "super_admin"
                            ? "Super Admin"
                            : user?.role === "instructor"
                            ? "محاضر"
                            : user?.role === "center"
                            ? "مركز تعليمي (سنتر)"
                            : user?.role === "guardian"
                            ? "ولي أمر"
                            : "طالب"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="my-1" />

                  {/* Role-Specific Navigation */}
                  <div className="space-y-0.5">
                    {user?.role === "center" && (
                      <>
                        <Link to="/center/dashboard">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <LayoutDashboard size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">لوحة تحكم السنتر</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/center/students">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Users size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">شُعب وطلاب السنتر</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/center/activation-codes">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                              <Ticket size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">أكواد الاشتراكات</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/center/reports">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                              <BarChart3 size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">التقارير والمبيعات</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/center/settings">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              <Settings size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">إعدادات السنتر</span>
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}

                    {user?.role === "instructor" && (
                      <>
                        <Link to="/instructor/dashboard">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <LayoutDashboard size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">لوحة تحكم المحاضر</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/instructor/courses">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <BookOpen size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">إدارة الدورات والدروس</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/instructor/students">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Users size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">متابعة الطلاب</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/instructor/earnings">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                              <Wallet size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">المحفظة والأرباح</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/profile">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              <User size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">الملف التعريفي</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/settings">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              <Settings size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">إعدادات الحساب</span>
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}

                    {(user?.role === "admin" || user?.role === "super_admin") && (
                      <>
                        <Link to="/admin/dashboard">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <LayoutDashboard size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">لوحة الإدارة</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/admin/users">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Users size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">إدارة المستخدمين</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/admin/settings">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              <Settings size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">إعدادات المنصة</span>
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}

                    {user?.role !== "center" && user?.role !== "instructor" && user?.role !== "admin" && user?.role !== "super_admin" && (
                      <>
                        <Link to="/dashboard">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <LayoutDashboard size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">لوحة دراستي</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/student/wallet">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                              <Wallet size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">محفظتي ونقاطي</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/student/notebook">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <BookMarked size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">مذكراتي وملاحظاتي</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/profile">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              <User size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">الملف الشخصي</span>
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/settings">
                          <DropdownMenuItem className="rounded-xl cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-muted/70">
                            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                              <Settings size={14} />
                            </div>
                            <span className="font-semibold text-xs text-foreground">الإعدادات</span>
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}
                  </div>

                  <DropdownMenuSeparator className="my-1.5" />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="rounded-xl text-destructive cursor-pointer py-2 px-2.5 gap-2.5 outline-none focus:bg-destructive/10"
                  >
                    <div className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                      <LogOut size={14} />
                    </div>
                    <span className="font-bold text-xs">تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer (Clean, Responsive, Fast with Hardware Acceleration) */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-background border-b border-border px-4 py-4 max-h-[85vh] overflow-y-auto overflow-x-hidden"
            dir="rtl"
          >
            {/* Guest / User Status Card for Quick Mobile Access */}
            {!isAuthenticated ? (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 mb-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-foreground truncate">مرحباً بك في كورسات</h4>
                      <p className="text-[10px] text-muted-foreground truncate">انضم لأكثر من 50,000 طالب ومتعلم</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm" className="w-full rounded-xl font-bold text-xs h-9">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <User size={13} className="me-1.5" />
                      <span>تسجيل الدخول</span>
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="w-full rounded-xl font-bold text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Sparkles size={13} className="me-1.5" />
                      <span>حساب جديد</span>
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="w-9 h-9 border border-primary/30 shrink-0">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-foreground truncate">{user?.fullName}</h4>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs font-bold text-primary hover:bg-primary/10 h-8 px-2.5 shrink-0">
                  <Link
                    to={
                      user?.role === "center"
                        ? "/center/dashboard"
                        : user?.role === "instructor"
                        ? "/instructor/dashboard"
                        : user?.role === "admin" || user?.role === "super_admin"
                        ? "/admin/dashboard"
                        : "/dashboard"
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    لوحة التحكم ←
                  </Link>
                </Button>
              </div>
            )}

            {/* Mobile Search */}
            <form onSubmit={handleHeaderSearch} className="relative mb-4">
              <Search
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                size={17}
              />
              <Input
                placeholder="ابحث عن مادة، مرحلة، أو دورة..."
                className="w-full ps-3 pe-10 h-10 rounded-full text-xs bg-muted/40 outline-none focus:outline-none focus-visible:ring-0"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
              />
            </form>

            {/* Clean Mobile Exploration Container */}
            <div className="mb-4 rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-primary">
                  <LayoutGrid size={16} />
                  <span>دليل الاستكشاف الشامل</span>
                </div>
                <Link
                  to="/courses"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  تصفح الكل
                </Link>
              </div>

              {/* Stages */}
              <div className="border-b border-border/60">
                <button
                  type="button"
                  onClick={() =>
                    setMobileAccordion((curr) => (curr === "stages" ? null : "stages"))
                  }
                  className="w-full p-3 text-xs font-bold flex items-center justify-between hover:bg-muted/50 text-foreground transition-colors outline-none focus:outline-none"
                >
                  <span>المراحل الدراسية الرسمية</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${mobileAccordion === "stages" ? "rotate-180 text-primary" : "text-muted-foreground"}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {mobileAccordion === "stages" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 grid grid-cols-2 gap-2 text-xs">
                        <Link
                          to="/courses?educational_stage=secondary&educational_grade=secondary_3"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          تالتة ثانوي (شهادة)
                        </Link>
                        <Link
                          to="/courses?educational_stage=secondary"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          المرحلة الثانوية
                        </Link>
                        <Link
                          to="/courses?educational_stage=prep"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          المرحلة الإعدادية
                        </Link>
                        <Link
                          to="/courses?educational_stage=primary"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          المرحلة الابتدائية
                        </Link>
                        <Link
                          to="/courses?educational_stage=baccalaureate"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors col-span-2 text-center"
                        >
                          البكالوريا المصرية (المسارات الحديثة) 🎓
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Core Subjects */}
              <div className="border-b border-border/60">
                <button
                  type="button"
                  onClick={() =>
                    setMobileAccordion((curr) => (curr === "subjects" ? null : "subjects"))
                  }
                  className="w-full p-3 text-xs font-bold flex items-center justify-between hover:bg-muted/50 text-foreground transition-colors outline-none focus:outline-none"
                >
                  <span>المواد الدراسية المقررة</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${mobileAccordion === "subjects" ? "rotate-180 text-primary" : "text-muted-foreground"}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {mobileAccordion === "subjects" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 grid grid-cols-2 gap-2 text-xs">
                        <Link
                          to="/courses?subject=math"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          الرياضيات
                        </Link>
                        <Link
                          to="/courses?subject=physics"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          الفيزياء
                        </Link>
                        <Link
                          to="/courses?subject=chemistry"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          الكيمياء والأحياء
                        </Link>
                        <Link
                          to="/courses?subject=arabic"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          اللغة العربية
                        </Link>
                        <Link
                          to="/courses?subject=english"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          اللغات الأجنبية
                        </Link>
                        <Link
                          to="/courses?subject=computer"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          الحاسب والذكاء
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Careers */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setMobileAccordion((curr) => (curr === "careers" ? null : "careers"))
                  }
                  className="w-full p-3 text-xs font-bold flex items-center justify-between hover:bg-muted/50 text-foreground transition-colors outline-none focus:outline-none"
                >
                  <span>الكورسات والمسارات المهنية</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${mobileAccordion === "careers" ? "rotate-180 text-primary" : "text-muted-foreground"}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {mobileAccordion === "careers" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 grid grid-cols-2 gap-2 text-xs">
                        <Link
                          to="/courses?category=البرمجة-وتطوير-الويب"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          البرمجة والويب
                        </Link>
                        <Link
                          to="/courses?category=الذكاء-الاصطناعي"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          الذكاء الاصطناعي
                        </Link>
                        <Link
                          to="/courses?category=التصميم-وتجربة-المستخدم"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          التصميم UI/UX
                        </Link>
                        <Link
                          to="/courses?category=إدارة-الأعمال-والتسويق"
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-2 rounded-xl bg-muted/50 font-semibold hover:bg-primary/10 hover:text-primary"
                        >
                          التسويق والإدارة
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Quick Platform Services */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs font-semibold">
              <Link
                to="/courses?is_free=true"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-card border border-border/80 hover:bg-muted/60 flex items-center gap-2 transition-colors"
              >
                <Gift size={16} className="text-emerald-500" />
                <span>الدورات المجانية</span>
              </Link>
              <Link
                to="/verify-certificate"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-card border border-border/80 hover:bg-muted/60 flex items-center gap-2 transition-colors"
              >
                <FileCheck size={16} className="text-primary" />
                <span>التحقق من شهادة</span>
              </Link>
              <Link
                to="/instructors"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-card border border-border/80 hover:bg-muted/60 flex items-center gap-2 transition-colors"
              >
                <School size={16} className="text-primary" />
                <span>المعلمون</span>
              </Link>
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-card border border-border/80 hover:bg-muted/60 flex items-center gap-2 transition-colors"
              >
                <CreditCard size={16} className="text-primary" />
                <span>خطط الأسعار</span>
              </Link>
            </div>

            {/* Quick Logout for Mobile Drawer when Logged In */}
            {isAuthenticated && (
              <div className="pt-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full justify-start text-destructive hover:bg-destructive/10 rounded-xl text-xs font-bold gap-2 h-10"
                >
                  <LogOut size={15} />
                  <span>تسجيل الخروج من الحساب</span>
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
