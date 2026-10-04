import React from "react";
import {
  BarChart2,
  TrendingDown,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCourseAnalytics } from "@/features/instructor/academicToolsHooks";

interface CourseAnalyticsModalProps {
  courseId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CourseAnalyticsModal({ courseId, isOpen, onClose }: CourseAnalyticsModalProps) {
  const { data: analytics, isLoading, isError, refetch } = useCourseAnalytics(courseId ?? 0);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent size="xl" className="dir-rtl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            تحليلات نسبة الإكمال ونسب مشاهدة الفيديو (Video Drop-off)
          </DialogTitle>
          <DialogDescription>
            {analytics?.course_title || "متابعة التفاعل وفنل إتمام الدورة التعليمية"}
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 space-y-4 text-center">
            <div className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
            <div className="h-40 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-700">تعذر تحميل تحليلات الدورة</p>
            <Button size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Main Analytics View */}
        {!isLoading && !isError && analytics && (
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 py-2 custom-scrollbar">
            {/* Completion Funnel */}
            <Card className="border shadow-sm">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  قمع الإكمال والتقدم (Completion Funnel)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {(analytics.funnel ?? []).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{item.stage}</span>
                      <span className="text-blue-600 font-bold">{item.count} طالب ({item.pct}%)</span>
                    </div>
                    <Progress value={item.pct} className="h-2.5" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Video Drop-off Analytics */}
            <Card className="border shadow-sm">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-600" />
                  معدل التخلي أثناء مشاهدة الفيديو (Video Drop-off)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {(analytics.video_drop_off ?? (analytics as any).videoDropOff ?? []).map((marker: any, idx: number) => {
                    const retentionPct = marker.retention_pct ?? marker.retentionPct ?? 0;
                    const dropCount = marker.drop_count ?? marker.dropCount ?? 0;
                    return (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                        <div className="text-xs font-semibold text-gray-500">{marker.marker}</div>
                        <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">
                          {retentionPct}%
                        </div>
                        <div className="text-[10px] text-rose-500 mt-1 font-semibold flex items-center justify-center gap-0.5">
                          <TrendingDown className="w-3 h-3" />
                          توقف {dropCount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
