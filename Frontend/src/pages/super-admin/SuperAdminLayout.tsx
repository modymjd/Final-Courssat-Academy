import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { superAdminTokenStore } from "@/lib/superAdminTokenStore";
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  Settings,
  History,
  LogOut,
  Menu,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Overview", path: "/super-admin/dashboard", icon: LayoutDashboard },
  { label: "User Management", path: "/super-admin/users", icon: Users },
  { label: "Content & Theme", path: "/super-admin/content", icon: FileText },
  { label: "Code Quota Contracts", path: "/super-admin/quota-contracts", icon: Ticket },
  { label: "Financials", path: "/super-admin/finance", icon: DollarSign },
  { label: "Technical Settings", path: "/super-admin/settings", icon: Settings },
  { label: "Security & Audit Logs", path: "/super-admin/audit-logs", icon: History },
];

// Keep in sync with Tailwind's `lg` breakpoint (the sidebar is docked from here up).
const DESKTOP_QUERY = "(min-width: 1024px)";

function Brand() {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white shadow-lg font-bold">
        CA
      </div>
      <div className="min-w-0">
        <h2 className="font-bold text-sm text-white tracking-wide truncate">Courssat Academy</h2>
        <p className="text-[11px] text-slate-400 font-mono truncate">Super Admin Console</p>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  pathname: string;
  onLogout: () => void;
  /** Rendered in the brand row (the mobile drawer uses it for its close button). */
  brandAction?: React.ReactNode;
}

function SidebarContent({ pathname, onLogout, brandAction }: SidebarContentProps) {
  return (
    <>
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between gap-3">
        <Brand />
        {brandAction}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-3.5 py-3 lg:py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-red-600/15 text-red-400 border border-red-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-red-400" : "text-slate-500"}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="truncate font-mono">Courssat Super Admin</span>
          <span className="shrink-0 text-[10px] bg-red-950 text-red-400 border border-red-800/60 px-1.5 py-0.5 rounded font-mono">
            SUPER
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onLogout}
          className="w-full text-xs bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/50"
        >
          <LogOut className="w-3.5 h-3.5 me-2" />
          Terminate Session
        </Button>
      </div>
    </>
  );
}

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    superAdminTokenStore.clear();
    navigate("/super-admin/login");
  };

  // Close the drawer after navigating.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close the drawer if the viewport grows to the docked-sidebar breakpoint.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const activeItem = navItems.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <div className="bg-red-950/80 border-b border-red-800/60 px-3 sm:px-4 py-2 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-red-200">
        <div className="flex items-center gap-2 font-mono min-w-0">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
          <span className="truncate">PROTECTED SESSION: SUPER ADMIN CONSOLE</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 font-mono text-[11px]">
          <span className="hidden sm:inline">SECURITY LOGGING</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> AUDIT TRAIL ENABLED
          </span>
        </div>
      </div>

      {/* Tablet / mobile top bar with the drawer trigger (hidden once the sidebar is docked) */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-3 sm:px-4 h-14 bg-slate-900/95 backdrop-blur border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="shrink-0 w-10 h-10 -ms-1 rounded-xl flex items-center justify-center text-slate-300 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-[11px] font-bold">
            CA
          </div>
          <span className="truncate text-sm font-semibold text-white">
            {activeItem?.label ?? "Super Admin Console"}
          </span>
        </div>
      </div>

      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="lg:hidden fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <Dialog.Content
            aria-describedby={undefined}
            className="lg:hidden fixed inset-y-0 start-0 z-50 w-[85vw] max-w-72 bg-slate-900 border-e border-slate-800 text-slate-100 flex flex-col shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out duration-200 ltr:data-[state=open]:slide-in-from-left ltr:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-right"
          >
            <Dialog.Title className="sr-only">Super Admin navigation</Dialog.Title>
            <SidebarContent
              pathname={location.pathname}
              onLogout={handleLogout}
              brandAction={
                <Dialog.Close
                  aria-label="Close navigation"
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                >
                  <X className="w-5 h-5" />
                </Dialog.Close>
              }
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-64 shrink-0 self-start sticky top-0 h-screen flex-col bg-slate-900/90 border-e border-slate-800/80">
          <SidebarContent pathname={location.pathname} onLogout={handleLogout} />
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
