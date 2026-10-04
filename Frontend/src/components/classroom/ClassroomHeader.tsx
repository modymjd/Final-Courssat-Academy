import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, ChevronLeft, LayoutList, Maximize2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface ClassroomHeaderProps {
  courseId: number;
  courseTitle: string;
  lessonTitle: string;
  currentIndex: number;
  totalLessons: number;
  progressPercent: number;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  prevLessonId: number | null;
  nextLessonId: number | null;
  isCurrentLessonCompleted: boolean;
}

export const ClassroomHeader: React.FC<ClassroomHeaderProps> = ({
  courseId,
  courseTitle,
  lessonTitle,
  currentIndex,
  totalLessons,
  progressPercent,
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileSidebar,
  prevLessonId,
  nextLessonId,
  isCurrentLessonCompleted,
}) => {
  return (
    <TooltipProvider delayDuration={200}>
      <header className="h-14 border-b border-border/80 bg-card/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-2 z-30 shrink-0 select-none">
        {/* Right side (RTL start): Back to course + titles */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/course/${courseId}`}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0"
                aria-label="العودة لصفحة الدورة الرئيسية"
              >
                <ArrowRight size={18} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">العودة لتفاصيل الدورة</TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-border/80 shrink-0 hidden sm:block" />

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <span className="truncate max-w-[140px] sm:max-w-[200px] font-medium">{courseTitle}</span>
              {totalLessons > 0 && (
                <>
                  <span>•</span>
                  <span className="shrink-0 font-mono text-[11px]">
                    الدرس {currentIndex + 1} من {totalLessons}
                  </span>
                </>
              )}
              {isCurrentLessonCompleted && (
                <Badge variant="outline" className="hidden md:inline-flex items-center gap-1 py-0 px-1.5 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                  <CheckCircle2 size={10} />
                  مكتمل
                </Badge>
              )}
            </div>
            <h1 className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-md lg:max-w-lg">
              {lessonTitle}
            </h1>
          </div>
        </div>

        {/* Center: Progress indicator on medium+ screens */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-muted/40 hover:bg-muted/60 transition-colors rounded-full border border-border/60 max-w-xs shrink-0 cursor-help">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span>الإنجاز:</span>
                <span className="font-mono text-foreground font-bold">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-24">
                <Progress value={progressPercent} className="h-1.5" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs text-right leading-relaxed font-cairo">
            نسبة التقدم المعتمدة: تحتسب إكمال مشاهدة الدروس واجتياز كويزات الدروس وامتحانات الوحدات المقررة.
          </TooltipContent>
        </Tooltip>

        {/* Left side (RTL end): Prev / Next and Sidebar toggles */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Previous Lesson quick button */}
          {prevLessonId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to={`/course/${courseId}/lesson/${prevLessonId}`}>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="الدرس السابق">
                    <ChevronRight size={18} />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">الدرس السابق</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl opacity-30 cursor-not-allowed" disabled aria-label="الدرس السابق">
              <ChevronRight size={18} />
            </Button>
          )}

          {/* Next Lesson quick button */}
          {nextLessonId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to={`/course/${courseId}/lesson/${nextLessonId}`}>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="الدرس التالي">
                    <ChevronLeft size={18} />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">الدرس التالي</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl opacity-30 cursor-not-allowed" disabled aria-label="الدرس التالي">
              <ChevronLeft size={18} />
            </Button>
          )}

          {/* Mobile Syllabus Sheet Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMobileSidebar}
            className="lg:hidden h-9 px-2.5 rounded-xl gap-1.5 text-xs font-bold border-border/80"
            aria-label="عرض قائمة الدروس"
          >
            <LayoutList size={15} />
            <span className="hidden xs:inline">المنهج</span>
          </Button>

          {/* Desktop Theater Mode (Toggle Sidebar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isSidebarOpen ? "ghost" : "secondary"}
                size="icon"
                onClick={onToggleSidebar}
                className="hidden lg:flex h-9 w-9 rounded-xl transition-colors"
                aria-label={isSidebarOpen ? "توسيع الشاشة (وضع المسرح)" : "إظهار قائمة الدروس"}
              >
                <Maximize2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSidebarOpen ? "وضع المسرح (إخفاء القائمة)" : "إظهار قائمة الدروس"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
};
