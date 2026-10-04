import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, GraduationCap } from "lucide-react";

export default function StudentGradesTab({ recentGrades }: { recentGrades: any[] }) {
  const items = recentGrades || [];

  return (
    <Card className="border-border/60 rounded-2xl overflow-hidden shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40 bg-muted/10">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Award size={18} className="text-primary" />
          سجل الدرجات والتقييمات الأخيرة
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {items.length} تقييم
        </span>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {items.length === 0 ? (
          <div className="text-center py-10">
            <GraduationCap size={36} className="mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium text-sm">لا توجد درجات مسجلة حالياً.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">عند تسليمك للواجبات أو تصحيح الاختبارات ستظهر درجاتك وملاحظات المعلمين هنا.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((grade) => {
              const assignmentTitle = grade.assignmentTitle || grade.assignment_title || grade.title || "تقييم دراسي";
              const courseName = grade.courseName || grade.course_name || grade.course?.title || "دورة تعليمية";
              const score = grade.score ?? 0;
              const maxScore = grade.maxScore || grade.max_score || 100;
              const percentage = grade.percentage ?? Math.round((Number(score) / Math.max(Number(maxScore), 1)) * 100);

              return (
                <div key={grade.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-foreground leading-snug">{assignmentTitle}</p>
                    <p className="text-xs text-muted-foreground">{courseName}</p>
                  </div>
                  <div className="text-end">
                    <span
                      className={`text-sm font-black ${
                        percentage >= 85
                          ? "text-emerald-600 dark:text-emerald-400"
                          : percentage >= 65
                          ? "text-primary"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {score} / {maxScore} ({percentage}%)
                    </span>
                    {grade.feedback && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">{grade.feedback}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
