import React, { useState, useEffect } from "react";
import { ClassroomHeader } from "./ClassroomHeader";
import { ClassroomSidebar } from "./ClassroomSidebar";
import type { Module } from "@/types/course";

interface ClassroomLayoutProps {
  courseId: number;
  courseTitle: string;
  lessonTitle: string;
  currentIndex: number;
  totalLessons: number;
  progressPercent: number;
  modules: Module[];
  currentLessonId: number;
  completedLessonIds: number[];
  prevLessonId: number | null;
  nextLessonId: number | null;
  isCurrentLessonCompleted: boolean;
  children: React.ReactNode;
}

export const ClassroomLayout: React.FC<ClassroomLayoutProps> = ({
  courseId,
  courseTitle,
  lessonTitle,
  currentIndex,
  totalLessons,
  progressPercent,
  modules,
  currentLessonId,
  completedLessonIds,
  prevLessonId,
  nextLessonId,
  isCurrentLessonCompleted,
  children,
}) => {
  // Remember desktop sidebar preference (default open)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("edusmart_classroom_sidebar");
    return saved !== null ? saved === "true" : true;
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("edusmart_classroom_sidebar", String(isSidebarOpen));
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-cairo antialiased">
      {/* 1. Slim Focused Studio Header */}
      <ClassroomHeader
        courseId={courseId}
        courseTitle={courseTitle}
        lessonTitle={lessonTitle}
        currentIndex={currentIndex}
        totalLessons={totalLessons}
        progressPercent={progressPercent}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        prevLessonId={prevLessonId}
        nextLessonId={nextLessonId}
        isCurrentLessonCompleted={isCurrentLessonCompleted}
      />

      {/* 2. Main Classroom Body (Stage + Collapsible Syllabus) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Main Stage (Video + Tabs + Actions) */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>

        {/* Collapsible Syllabus (Desktop + Mobile Sheet) */}
        <ClassroomSidebar
          courseId={courseId}
          modules={modules}
          currentLessonId={currentLessonId}
          completedLessonIds={completedLessonIds}
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>
    </div>
  );
};

export default ClassroomLayout;
