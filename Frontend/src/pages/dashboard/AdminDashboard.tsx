import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/common/StatCard";
import { useAuth } from "@/features/auth";
import { useAdminDashboard } from "@/features/dashboard";
import {
  Users, BookOpen, DollarSign, TrendingUp,
  ShieldCheck, FileText, AlertTriangle,
  ArrowLeft, Clock, Activity, Settings,
} from "lucide-react";

const STAT_ICONS: Record<string, React.ReactNode> = {
  Users: <Users size={20} />,
  BookOpen: <BookOpen size={20} />,
  DollarSign: <DollarSign size={20} />,
  TrendingUp: <TrendingUp size={20} />,
};

const APPROVAL_ICONS: Record<string, React.ReactNode> = {
  instructor_application: <ShieldCheck size={16} className="text-primary" />,
  course_review: <FileText size={16} className="text-info" />,
  content_report: <AlertTriangle size={16} className="text-warning" />,
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const { data, isLoading } = useAdminDashboard();

  if (isLoading || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="h-8 w-56 bg-muted animate-pulse rounded mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {[1, 2].map(i => (
              <div key={i} className="h-72 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const stats = data.stats || [];
  const pendingApprovals = data.pendingApprovals || data.pending_approvals || [];
  const recentActivity = data.recentActivity || data.recent_activity || [];
  const enrollmentTrend = data.enrollmentTrend || data.enrollment_trend || [];
  const revenueTrend = data.revenueTrend || data.revenue_trend || [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              لوحة التحكم
            </h1>
            <p className="text-muted-foreground mt-1">
              مرحباً {user?.firstName} — إليك نظرة عامة على المنصة
            </p>
          </div>
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <Button variant="default" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 font-bold" asChild>
              <Link to="/super-admin/pricing">
                <DollarSign size={16} />
                الحوكمة المالية والأسعار
              </Link>
            </Button>
            <Button variant="outline" className="gap-1.5" asChild>
              <Link to="/admin/settings">
                <Settings size={16} />
                إعدادات المنصة
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp}>
              <StatCard
                title={stat.label}
                value={stat.value}
                change={stat.change}
                changeLabel={stat.changeLabel}
                icon={STAT_ICONS[stat.icon ?? ""] ?? <TrendingUp size={20} />}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Charts */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {/* Enrollment Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                التسجيلات الشهرية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={enrollmentTrend}>
                    <defs>
                      <linearGradient id="enrollGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(175, 84%, 32%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(175, 84%, 32%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(168, 16%, 90%)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(168, 16%, 90%)",
                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                        fontSize: "13px",
                      }}
                      formatter={(value: number) => [`${value} تسجيل`, "التسجيلات"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(175, 84%, 32%)"
                      strokeWidth={2.5}
                      fill="url(#enrollGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign size={18} className="text-achievement" />
                الإيرادات الشهرية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(168, 16%, 90%)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(168, 16%, 90%)",
                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                        fontSize: "13px",
                      }}
                      formatter={(value: number) => [`${value.toLocaleString("ar-EG")} ج.م`, "الإيرادات"]}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="hsl(21, 90%, 48%)"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Row: Approvals + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Pending Approvals */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={18} className="text-warning" />
                    بانتظار المراجعة
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {pendingApprovals.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">لا توجد طلبات معلقة</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="mt-0.5 shrink-0">
                          {APPROVAL_ICONS[item.type] ?? <FileText size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock size={11} />
                            {item.date}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0" asChild>
                          <Link to="/admin/approvals">مراجعة</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    النشاط الأخير
                  </CardTitle>
                  <Link
                    to="/admin/users"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    عرض الكل <ArrowLeft size={12} />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Activity size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">{activity.user}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
