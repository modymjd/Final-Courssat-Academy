import React from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAuth } from "@/features/auth";
import { useInstructorDailyBrief } from "@/features/instructor";
import { InstructorHeader } from "./instructor/InstructorHeader";
import { InstructorKpiBar } from "./instructor/InstructorKpiBar";
import { InstructorOverviewTab } from "./instructor/tabs/InstructorOverviewTab";
import { InstructorCoursesTab } from "./instructor/tabs/InstructorCoursesTab";
import { InstructorGradingTab } from "./instructor/tabs/InstructorGradingTab";
import { InstructorEarningsTab } from "./instructor/tabs/InstructorEarningsTab";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Wallet,
} from "lucide-react";

type ValidTab = "overview" | "courses" | "grading" | "earnings";

export default function InstructorDashboard() {
  const { user } = useAuth();
  const { data: brief, isLoading } = useInstructorDailyBrief();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get("tab") as ValidTab) || "overview";
  const activeTab: ValidTab = ["overview", "courses", "grading", "earnings"].includes(currentTab)
    ? currentTab
    : "overview";

  const handleTabChange = (val: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", val);
        return next;
      },
      { replace: true }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 dir-rtl">
          <div className="h-28 bg-muted/60 animate-pulse rounded-3xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-muted/50 animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="h-12 w-full max-w-md bg-muted/60 animate-pulse rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 bg-muted/50 animate-pulse rounded-3xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const kpis = brief?.kpis || {
    total_students: 0,
    active_courses: 0,
    total_courses: 0,
    avg_rating: 4.8,
    total_revenue: 0,
    avg_completion_rate: 0,
  };

  const pendingGradingCount = brief?.morning_brief?.pending_grading_count ?? 0;

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 dir-rtl space-y-6">
        <ErrorBoundary>
          {/* 1. Header with Name & Quick Actions Menu */}
          <InstructorHeader userName={user?.firstName || user?.fullName || user?.username} />

          {/* 2. Global KPIs Bar */}
          <InstructorKpiBar kpis={kpis} />

          {/* 3. 4-Tabs Command Center */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <div className="overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
              <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/60 h-auto gap-1 inline-flex sm:flex w-full max-w-3xl justify-start">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  <LayoutDashboard size={16} className="text-primary" />
                  <span>غرفة العمليات ونظرة عامة</span>
                </TabsTrigger>

                <TabsTrigger
                  value="courses"
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  <BookOpen size={16} className="text-emerald-500" />
                  <span>إدارة الكورسات</span>
                  {kpis.total_courses > 0 && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold">
                      {kpis.total_courses}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="grading"
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  <GraduationCap size={16} className="text-indigo-500" />
                  <span>التصحيح ورصد الطلاب</span>
                  {pendingGradingCount > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] py-0 px-1.5 font-black rounded-full">
                      {pendingGradingCount}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="earnings"
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  <Wallet size={16} className="text-emerald-600" />
                  <span>المالية والأكواد</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1 Content: Overview */}
            <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
              <ErrorBoundary>
                <InstructorOverviewTab brief={brief ?? null} />
              </ErrorBoundary>
            </TabsContent>

            {/* Tab 2 Content: Courses */}
            <TabsContent value="courses" className="mt-0 focus-visible:outline-none">
              <ErrorBoundary>
                <InstructorCoursesTab />
              </ErrorBoundary>
            </TabsContent>

            {/* Tab 3 Content: Grading & Students */}
            <TabsContent value="grading" className="mt-0 focus-visible:outline-none">
              <ErrorBoundary>
                <InstructorGradingTab />
              </ErrorBoundary>
            </TabsContent>

            {/* Tab 4 Content: Earnings & Codes */}
            <TabsContent value="earnings" className="mt-0 focus-visible:outline-none">
              <ErrorBoundary>
                <InstructorEarningsTab />
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </ErrorBoundary>
      </div>
    </Layout>
  );
}
