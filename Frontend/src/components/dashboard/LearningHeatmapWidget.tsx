import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Flame } from "lucide-react";

interface LearningHeatmapWidgetProps {
  activityMatrix: Record<string, number>; // "YYYY-MM-DD" -> minutes
}

export const LearningHeatmapWidget: React.FC<LearningHeatmapWidgetProps> = ({ activityMatrix }) => {
  // Generate past 52 weeks (364 days) grouped into weeks of 7 days
  const days: { dateStr: string; minutes: number }[] = [];
  const today = new Date();

  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      dateStr,
      minutes: activityMatrix[dateStr] || 0,
    });
  }

  const getIntensityClass = (minutes: number) => {
    if (minutes === 0) return "bg-muted/40 border-border/30";
    if (minutes < 15) return "bg-teal-900/40 border-teal-700/50 text-teal-200";
    if (minutes < 45) return "bg-teal-600/70 border-teal-500 text-white";
    if (minutes < 90) return "bg-teal-500 border-teal-400 text-white shadow-xs";
    return "bg-amber-500 border-amber-400 text-white shadow-sm animate-pulse";
  };

  return (
    <Card className="glass border-border/60 rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          نشاط التعلم السنوي (52 اسبوع)
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>أقل</span>
          <div className="w-3 h-3 rounded-xs bg-muted/40" />
          <div className="w-3 h-3 rounded-xs bg-teal-900/50" />
          <div className="w-3 h-3 rounded-xs bg-teal-600" />
          <div className="w-3 h-3 rounded-xs bg-amber-500" />
          <span>أكثر</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-rows-7 grid-flow-col gap-1 w-max">
            {days.map(d => (
              <div
                key={d.dateStr}
                title={`${d.dateStr}: ${d.minutes} دقيقة مذاكرة`}
                className={`w-3 h-3 rounded-xs border transition-all duration-150 ${getIntensityClass(d.minutes)}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
