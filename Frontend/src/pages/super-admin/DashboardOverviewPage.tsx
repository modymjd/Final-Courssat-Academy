import { useState, useEffect } from "react";
import { superAdminGet } from "@/lib/superAdminHttp";
import { logger } from "@/lib/logger";

import {
  Activity,
  Cpu,
  HardDrive,
  Database,
  Zap,
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OverviewData {
  server: {
    uptimeSeconds: number;
    cpuPercent: number;
    ramPercent: number;
    ramUsedGb: number;
    ramTotalGb: number;
    database: {
      status: string;
      latencyMs: number;
    };
    cache: {
      status: string;
      latencyMs: number;
    };
  };
  analytics: {
    onlineUsers: number;
    totalStudents: number;
    totalInstructors: number;
    totalPublishedCourses: number;
    revenue: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      totalAllTime: number;
    };
  };
  alerts: Array<{
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    message: string;
    timestamp: string;
  }>;
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const raw: any = await superAdminGet("/super-admin/overview/");
      const normalized: OverviewData = {
        server: {
          uptimeSeconds: Number(raw?.server?.uptime_seconds ?? raw?.server?.uptimeSeconds ?? 0),
          cpuPercent: Number(raw?.server?.cpu_percent ?? raw?.server?.cpuPercent ?? 0),
          ramPercent: Number(raw?.server?.ram_percent ?? raw?.server?.ramPercent ?? 0),
          ramUsedGb: Number(raw?.server?.ram_used_gb ?? raw?.server?.ramUsedGb ?? 0),
          ramTotalGb: Number(raw?.server?.ram_total_gb ?? raw?.server?.ramTotalGb ?? 0),
          database: {
            status: raw?.server?.database?.status ?? "unknown",
            latencyMs: Number(raw?.server?.database?.latency_ms ?? raw?.server?.database?.latencyMs ?? 0),
          },
          cache: {
            status: raw?.server?.cache?.status ?? "unknown",
            latencyMs: Number(raw?.server?.cache?.latency_ms ?? raw?.server?.cache?.latencyMs ?? 0),
          },
        },
        analytics: {
          onlineUsers: Number(raw?.analytics?.online_users ?? raw?.analytics?.onlineUsers ?? 0),
          totalStudents: Number(raw?.analytics?.total_students ?? raw?.analytics?.totalStudents ?? 0),
          totalInstructors: Number(raw?.analytics?.total_instructors ?? raw?.analytics?.totalInstructors ?? 0),
          totalPublishedCourses: Number(raw?.analytics?.total_published_courses ?? raw?.analytics?.totalPublishedCourses ?? 0),
          revenue: {
            today: Number(raw?.analytics?.revenue?.today ?? 0),
            thisWeek: Number(raw?.analytics?.revenue?.this_week ?? raw?.analytics?.revenue?.thisWeek ?? 0),
            thisMonth: Number(raw?.analytics?.revenue?.this_month ?? raw?.analytics?.revenue?.thisMonth ?? 0),
            totalAllTime: Number(raw?.analytics?.revenue?.total_all_time ?? raw?.analytics?.revenue?.totalAllTime ?? 0),
          },
        },
        alerts: Array.isArray(raw?.alerts) ? raw.alerts : [],
      };

      setData(normalized);
      setLastUpdated(new Date());
    } catch (e) {
      logger.error("Failed to load overview telemetry", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000); // 30s auto refresh
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-red-500" />
            System Operations & Telemetry Overview
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time server health, active sessions, platform KPIs, and security anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] font-mono text-slate-400">
              Refreshed: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={fetchOverview}
            disabled={loading}
            variant="outline"
            size="sm"
            className="bg-slate-900 border-slate-800 text-slate-200 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner Section */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Critical System & Security Alerts ({data.alerts.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.alerts.map((alert) => (
              <Alert
                key={alert.id}
                variant="destructive"
                className={`bg-slate-900/90 border ${
                  alert.severity === "high"
                    ? "border-red-600/80 text-red-300"
                    : "border-amber-600/70 text-amber-300"
                } p-4 rounded-xl shadow-lg`}
              >
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-sm font-bold tracking-wide">{alert.title}</AlertTitle>
                <AlertDescription className="text-xs font-mono text-slate-300 mt-1">
                  {alert.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Top Telemetry Grid: Active Users & Server Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Online Users */}
        <Card className="bg-slate-900/80 border-slate-800 text-slate-100 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Online Users (5m window)</CardTitle>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white font-mono">
              {data?.analytics.onlineUsers ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">Active user sessions right now</p>
          </CardContent>
        </Card>

        {/* CPU Load */}
        <Card className="bg-slate-900/80 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">CPU Load</CardTitle>
            <Cpu className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono">{data?.server.cpuPercent ?? 0}%</span>
              <span className="text-[11px] font-mono text-slate-400">Host Core Utilization</span>
            </div>
            <Progress value={data?.server.cpuPercent ?? 0} className="h-1.5 bg-slate-800" />
          </CardContent>
        </Card>

        {/* RAM Usage */}
        <Card className="bg-slate-900/80 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">RAM Consumption</CardTitle>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono">{data?.server.ramPercent ?? 0}%</span>
              <span className="text-[11px] font-mono text-slate-400">
                {data?.server.ramUsedGb ?? 0} GB / {data?.server.ramTotalGb ?? 0} GB
              </span>
            </div>
            <Progress value={data?.server.ramPercent ?? 0} className="h-1.5 bg-slate-800" />
          </CardContent>
        </Card>

        {/* Database & Cache Status */}
        <Card className="bg-slate-900/80 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Database & Cache Latency</CardTitle>
            <Database className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">PostgreSQL DB:</span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                {data?.server.database.latencyMs ?? 0} ms
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Redis / Cache:</span>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                {data?.server.cache.latencyMs ?? 0} ms
              </Badge>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Host Uptime:</span>
              <span className="text-slate-200">{formatUptime(data?.server.uptimeSeconds ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Counters Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 border-slate-800/80 text-slate-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Registered Students</p>
              <h3 className="text-2xl font-bold font-mono text-white mt-0.5">
                {data?.analytics.totalStudents ?? 0}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800/80 text-slate-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Active Instructors</p>
              <h3 className="text-2xl font-bold font-mono text-white mt-0.5">
                {data?.analytics.totalInstructors ?? 0}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800/80 text-slate-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Published Catalog Courses</p>
              <h3 className="text-2xl font-bold font-mono text-white mt-0.5">
                {data?.analytics.totalPublishedCourses ?? 0}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Real Revenue Widget */}
      <Card className="bg-slate-900/60 border-slate-800/80 text-slate-100">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Platform Financial Performance (Ledger Verified)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center font-mono">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Revenue Today</span>
            <div className="text-xl font-bold text-emerald-400">
              EGP {data?.analytics.revenue.today.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="space-y-1 border-l border-slate-800/60 pl-6">
            <span className="text-xs text-slate-400">Revenue This Week</span>
            <div className="text-xl font-bold text-emerald-400">
              EGP {data?.analytics.revenue.thisWeek.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="space-y-1 border-l border-slate-800/60 pl-6">
            <span className="text-xs text-slate-400">Revenue This Month</span>
            <div className="text-xl font-bold text-emerald-400">
              EGP {data?.analytics.revenue.thisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="space-y-1 border-l border-slate-800/60 pl-6">
            <span className="text-xs text-slate-400">All-Time Net Revenue</span>
            <div className="text-xl font-bold text-emerald-400">
              EGP {data?.analytics.revenue.totalAllTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
