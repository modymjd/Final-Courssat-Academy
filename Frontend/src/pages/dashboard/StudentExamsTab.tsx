import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, ShieldAlert, Award, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export default function StudentExamsTab({ examsData }: { examsData: any[] }) {
  return (
    <Card className="border-border/60 rounded-2xl overflow-hidden shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40 bg-muted/10">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          الاختبارات والتقييمات الأكاديمية
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {examsData?.length || 0} اختبار
        </span>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {!examsData || examsData.length === 0 ? (
          <div className="text-center py-10">
            <ShieldAlert size={36} className="mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium text-sm">لا توجد اختبارات مطلوب أداؤها حالياً.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">عند نشر معلميك لاختبارات جديدة ستظهر نتائجها ومواعيدها هنا مباشرة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examsData.map((exam) => {
              const isGraded = exam.status === "graded";
              const isSubmitted = exam.status === "submitted";
              const isInProgress = exam.status === "in_progress";
              const hasScore = exam.score !== null && exam.score !== undefined;
              const attemptsAllowed = Number(exam.attemptsAllowed) || 1;
              const attemptNumber = Number(exam.attemptNumber) || 0;
              const attemptsLeft = Math.max(0, attemptsAllowed - attemptNumber);

              return (
                <Card key={exam.id} className="border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-200 rounded-2xl bg-card overflow-hidden">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="font-bold text-sm sm:text-base leading-snug hover:text-primary transition-colors">
                        {exam.title}
                      </h4>
                      {isGraded ? (
                        <Badge
                          variant={exam.isPassed ? "secondary" : "destructive"}
                          className={
                            exam.isPassed
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs shrink-0 font-bold"
                              : "text-xs shrink-0 font-bold"
                          }
                        >
                          {exam.isPassed ? "ناجح" : "لم يجتز"} ({exam.percentage ?? Math.round(exam.score)}%)
                        </Badge>
                      ) : isSubmitted ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs shrink-0 font-bold">
                          قيد التصحيح
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="animate-pulse text-xs shrink-0 font-bold">
                          مطلوب
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                      {exam.description}
                    </p>

                    {/* Result of latest attempt */}
                    {hasScore && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs mb-3">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Award size={13} className="text-primary" /> نتيجة آخر محاولة:
                        </span>
                        <span className="font-bold text-foreground">
                          {exam.score} من {exam.maxScore} ({exam.percentage}%)
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock size={12} /> {exam.durationMinutes} دقيقة
                      </span>
                      <span className="text-[11px] font-medium">
                        {attemptNumber > 0
                          ? `المحاولة ${attemptNumber} من ${attemptsAllowed}`
                          : `متاح ${attemptsAllowed} ${attemptsAllowed === 1 ? "محاولة" : "محاولات"}`}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      {isGraded ? (
                        <>
                          <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs font-semibold h-9" asChild>
                            <Link to={`/exam/${exam.id}/result`}>
                              عرض النتيجة
                            </Link>
                          </Button>
                          {attemptsLeft > 0 && (
                            <Button size="sm" className="flex-1 rounded-xl text-xs font-bold h-9" asChild>
                              <Link to={`/exam/${exam.id}`}>
                                إعادة الاختبار ({attemptsLeft} متبقية)
                              </Link>
                            </Button>
                          )}
                        </>
                      ) : isInProgress ? (
                        <Button className="w-full rounded-xl text-xs font-bold h-9 bg-primary hover:bg-primary/90" asChild>
                          <Link to={`/exam/${exam.id}/session`}>
                            متابعة أداء الاختبار
                          </Link>
                        </Button>
                      ) : (
                        <Button className="w-full rounded-xl text-xs font-bold h-9" asChild>
                          <Link to={`/exam/${exam.id}`}>
                            بدء الاختبار
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
