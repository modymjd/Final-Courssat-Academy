import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  PlayCircle,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  LayoutList,
  Lock,
  Award,
  GraduationCap,
} from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Module } from "@/types/course";

interface ClassroomSidebarProps {
  courseId: number;
  modules: Module[];
  currentLessonId: number;
  completedLessonIds: number[];
  isOpen: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export const ClassroomSidebar: React.FC<ClassroomSidebarProps> = ({
  courseId,
  modules,
  currentLessonId,
  completedLessonIds,
  isOpen,
  isMobileOpen,
  onMobileClose,
}) => {
  // Find index of module containing the current lesson to auto-expand it
  const activeModuleIndex = useMemo(() => {
    const idx = modules.findIndex(m => m.lessons?.some(l => l.id === currentLessonId));
    return idx >= 0 ? idx.toString() : "0";
  }, [modules, currentLessonId]);

  const allModuleIndexes = useMemo(() => {
    return modules.map((_, i) => i.toString());
  }, [modules]);

  const totalLessons = useMemo(() => {
    return modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
  }, [modules]);

  const completedCount = useMemo(() => {
    const allLessonIds = new Set(modules.flatMap(m => (m.lessons || []).map(l => l.id)));
    return completedLessonIds.filter(id => allLessonIds.has(id)).length;
  }, [modules, completedLessonIds]);

  const renderSyllabusContent = (isMobile = false) => (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full">
        {/* Sidebar Header Stats */}
        <div className="p-4 border-b border-border/70 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <LayoutList size={16} className="text-primary" />
              محتوى الدورة التدريبية
            </h2>
            <Badge variant="outline" className="text-xs font-mono">
              {completedCount}/{totalLessons}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalLessons > 0 && completedCount === totalLessons
              ? "أحسنت! أكملت جميع دروس الدورة 🎉"
              : `تبقّى ${Math.max(0, totalLessons - completedCount)} درس لإتمام الدورة`}
          </p>
        </div>

        {/* Modules List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          <Accordion type="multiple" defaultValue={[activeModuleIndex, ...allModuleIndexes]} className="w-full">
            {modules.map((module, mIdx) => {
              const moduleLessons = module.lessons || [];
              const moduleCompletedCount = moduleLessons.filter(l => completedLessonIds.includes(l.id)).length;
              const isModuleDone = moduleLessons.length > 0 && moduleCompletedCount === moduleLessons.length;
              const unitExam = module.unitExam || module.unit_exam || null;

              return (
                <AccordionItem value={mIdx.toString()} key={module.id || mIdx} className="border-b border-border/60 last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/40 hover:no-underline transition-colors">
                    <div className="flex items-center justify-between gap-2 w-full text-right pe-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isModuleDone ? (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground/40 shrink-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {mIdx + 1}
                          </div>
                        )}
                        <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {module.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                        {moduleCompletedCount}/{moduleLessons.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 bg-muted/10">
                    <ul className="flex flex-col divide-y divide-border/40">
                      {moduleLessons.map((lesson) => {
                        const isCurrent = lesson.id === currentLessonId;
                        const isDone = completedLessonIds.includes(lesson.id);
                        const isLocked = Boolean(lesson.is_locked || (lesson as any).isLocked);
                        const lockReason =
                          lesson.lock_reason ||
                          (lesson as any).lockReason ||
                          "يجب إكمال الدرس والكويز السابق أولاً بنسبة 70% على الأقل.";
                        const lessonQuiz = lesson.quiz;
                        const isQuizPassed = Boolean(lessonQuiz?.is_passed || (lessonQuiz as any)?.isPassed);

                        return (
                          <li key={lesson.id}>
                            {isLocked ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="flex items-center justify-between p-3 sm:px-4 text-xs sm:text-sm min-h-[44px] opacity-60 cursor-not-allowed bg-muted/20 border-r-4 border-transparent select-none"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <Lock size={15} className="text-amber-500 shrink-0" />
                                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                                        {lesson.type === "video" ? (
                                          <PlayCircle size={14} className="text-muted-foreground" />
                                        ) : (
                                          <FileText size={14} className="text-muted-foreground" />
                                        )}
                                        <span className="truncate text-muted-foreground">{lesson.title}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 ms-2">
                                      {lessonQuiz && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold"
                                        >
                                          كويز
                                        </Badge>
                                      )}
                                      <span className="text-[10px] text-amber-600 font-bold font-mono">مقفل</span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs max-w-xs text-right leading-relaxed font-cairo">
                                  {lockReason}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Link
                                to={`/course/${courseId}/lesson/${lesson.id}`}
                                onClick={isMobile ? onMobileClose : undefined}
                                className={`flex items-center justify-between p-3 sm:px-4 text-xs sm:text-sm transition-all min-h-[44px] ${
                                  isCurrent
                                    ? "border-r-4 border-primary bg-primary/10 text-primary font-bold shadow-xs"
                                    : "hover:bg-muted/50 text-foreground border-r-4 border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {/* Icon Status */}
                                  {isDone ? (
                                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                  ) : isCurrent ? (
                                    <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    </div>
                                  ) : (
                                    <Circle size={14} className="text-muted-foreground/60 shrink-0" />
                                  )}

                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    {lesson.type === "video" ? (
                                      <PlayCircle size={14} className={isCurrent ? "text-primary" : "text-muted-foreground"} />
                                    ) : (
                                      <FileText size={14} className={isCurrent ? "text-primary" : "text-muted-foreground"} />
                                    )}
                                    <span className="truncate">{lesson.title}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ms-2">
                                  {lessonQuiz && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1.5 py-0 font-bold shrink-0 ${
                                        isQuizPassed
                                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                          : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                      }`}
                                      title={
                                        isQuizPassed
                                          ? "تم اجتياز كويز الدرس بنجاح"
                                          : "كويز الدرس (مطلوب لفتح الدرس التالي)"
                                      }
                                    >
                                      {isQuizPassed ? "كويز ✓" : "كويز مطلوب"}
                                    </Badge>
                                  )}

                                  {lesson.duration && (
                                    <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                                      <Clock size={11} />
                                      {lesson.duration}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}
                          </li>
                        );
                      })}

                      {/* Unit Exam entry at the end of each module */}
                      {unitExam && (() => {
                        const isUnitExamPassed = Boolean(unitExam.is_passed || (unitExam as any).isPassed);
                        const attemptsCount = unitExam.attempts_count ?? (unitExam as any).attemptsCount ?? 0;
                        const attemptsAllowed = unitExam.attempts_allowed ?? (unitExam as any).attemptsAllowed ?? 3;
                        const isModuleLessonsDone = moduleLessons.length > 0 && moduleCompletedCount === moduleLessons.length;
                        const isUnitExamLocked = !isModuleLessonsDone && !isUnitExamPassed;

                        return (
                          <li className="bg-primary/5 dark:bg-primary/10 border-t border-dashed border-primary/30">
                            {isUnitExamLocked ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-between p-3 sm:px-4 text-xs sm:text-sm min-h-[46px] opacity-70 cursor-not-allowed select-none">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <Lock size={15} className="text-amber-500 shrink-0" />
                                      <div className="flex items-center gap-1.5 min-w-0 truncate text-muted-foreground font-semibold">
                                        <Award size={15} className="text-primary shrink-0" />
                                        <span className="truncate">{unitExam.title || `امتحان الوحدة ${mIdx + 1}`}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 ms-2">
                                      <Badge variant="outline" className="text-[9px] bg-primary/15 text-primary border-primary/30 font-bold">
                                        امتحان وحدة
                                      </Badge>
                                      <span className="text-[10px] text-amber-600 font-bold">مقفل</span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs max-w-xs text-right font-cairo">
                                  يجب إكمال جميع دروس هذه الوحدة أولاً لفتح امتحان الوحدة.
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Link
                                to={`/exam/${unitExam.id}`}
                                onClick={isMobile ? onMobileClose : undefined}
                                className="flex items-center justify-between p-3 sm:px-4 text-xs sm:text-sm transition-all min-h-[46px] hover:bg-primary/15 text-foreground font-bold"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {isUnitExamPassed ? (
                                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                  ) : (
                                    <Award size={16} className="text-primary shrink-0" />
                                  )}
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span className="truncate text-primary">{unitExam.title || `امتحان الوحدة ${mIdx + 1}`}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ms-2">
                                  <Badge variant="outline" className="text-[9px] bg-primary/15 text-primary border-primary/30 font-bold">
                                    امتحان وحدة
                                  </Badge>
                                  {isUnitExamPassed ? (
                                    <Badge className="text-[9px] bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                                      تم الاجتياز ✓
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[9px] font-mono text-muted-foreground">
                                      محاولة {attemptsCount} من {attemptsAllowed}
                                    </Badge>
                                  )}
                                </div>
                              </Link>
                            )}
                          </li>
                        );
                      })()}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      {isOpen && (
        <aside className="hidden lg:block w-80 xl:w-96 border-s border-border/80 bg-card shrink-0 h-[calc(100vh-56px)] sticky top-14 overflow-hidden select-none">
          {renderSyllabusContent(false)}
        </aside>
      )}

      {/* Mobile Drawer (Sheet) */}
      <Sheet open={isMobileOpen} onOpenChange={(open) => { if (!open) onMobileClose(); }}>
        <SheetContent side="right" className="p-0 w-[85vw] max-w-sm border-s border-border">
          <SheetHeader className="sr-only">
            <SheetTitle>محتويات الدورة التدريبية</SheetTitle>
          </SheetHeader>
          {renderSyllabusContent(true)}
        </SheetContent>
      </Sheet>
    </>
  );
};
