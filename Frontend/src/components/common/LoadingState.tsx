import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import InstructorCardSkeleton from "@/components/instructor/InstructorCardSkeleton";

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label="جاري التحميل">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <span className="sr-only">جاري التحميل...</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card animate-pulse overflow-hidden shadow-xs min-h-[360px] flex flex-col" aria-hidden="true">
      <div className="aspect-video bg-muted/70 rounded-t-xl" />
      <div className="p-5 space-y-3 flex-1 flex flex-col">
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-muted/80 rounded-md" />
          <div className="h-5 w-20 bg-muted/80 rounded-md" />
        </div>
        <div className="h-5 w-3/4 bg-muted/90 rounded-md" />
        <div className="h-4 w-full bg-muted/60 rounded-md" />
        <div className="h-4 w-1/2 bg-muted/60 rounded-md" />
        <div className="border-t border-border/40 pt-4 mt-auto flex items-center justify-between">
          <div className="h-4 w-20 bg-muted/80 rounded-md" />
          <div className="h-4 w-16 bg-muted/80 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6 animate-pulse shadow-xs min-h-[110px]" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 bg-muted/80 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-4 w-24 bg-muted/70 rounded-md" />
          <div className="h-7 w-20 bg-muted/90 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3 animate-pulse min-h-[360px]" aria-hidden="true">
      <div className="h-10 bg-muted/60 rounded-xl w-full" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-14 bg-card border border-border/40 rounded-xl w-full flex items-center justify-between px-4 gap-4">
          <div className="h-4 w-1/4 bg-muted/70 rounded" />
          <div className="h-4 w-1/3 bg-muted/60 rounded" />
          <div className="h-4 w-1/6 bg-muted/50 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * GenericPageSkeleton / PageLoading:
 * يحاكي هيكل الصفحة المعياري (Header + Breadcrumb/Title + Grid of cards) بدلاً من السبينر المقتضب القديم
 */
export function PageLoading() {
  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل الصفحة..."
    >
      {/* Top Header Placeholder */}
      <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 py-2.5">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-7 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-20 h-9 rounded-xl" />
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded" />
        </div>

        {/* Dynamic Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

/**
 * CoursesPageSkeleton:
 * يحاكي صفحة استعراض الكورسات بالكامل (فلاتر المرحلة الدراسية، شريط البحث، وشبكة الكروت)
 */
export function CoursesPageSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل الكورسات..."
    >
      <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 py-2.5">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-7 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-20 h-9 rounded-xl" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Banner / Title Header */}
        <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 rounded-3xl border border-border/50 text-center space-y-4">
          <Skeleton className="h-6 w-36 rounded-full mx-auto" />
          <Skeleton className="h-10 w-72 sm:w-96 rounded-2xl mx-auto" />
          <Skeleton className="h-4 w-80 max-w-full rounded mx-auto" />

          {/* Search bar skeleton */}
          <div className="max-w-2xl mx-auto pt-4">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        {/* Filter Pills / Tabs Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full shrink-0" />
          ))}
        </div>

        {/* Course Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

/**
 * CourseDetailSkeleton:
 * يحاكي صفحة تفاصيل الكورس (مشغل الفيديو، تفاصيل الكورس، المحاضر، وقائمة المحاضرات)
 */
export function CourseDetailSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل تفاصيل الدورة..."
    >
      <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 py-2.5">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-7 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-20 h-9 rounded-xl" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main 2-column details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-10 w-4/5 rounded-2xl" />
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </div>

            {/* Video Player / Media Aspect ratio placeholder */}
            <div className="aspect-video w-full rounded-2xl bg-muted/70 animate-pulse border border-border/50" />

            {/* Tabs placeholder */}
            <div className="flex gap-3 border-b border-border/40 pb-3">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>

            {/* Content blocks */}
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>

          {/* Sticky Sidebar Pricing & Actions Card */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm space-y-6 sticky top-24">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-28 rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-3 pt-4 border-t border-border/40">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * DashboardSkeleton:
 * يحاكي لوحة التحكم (الترحيب، بطاقات الإحصائيات الأربع، وجداول/بطاقات النشاط الحديث)
 */
export function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل لوحة التحكم..."
    >
      <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 py-2.5">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-7 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-20 h-9 rounded-xl" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 flex-1 space-y-8">
        {/* Welcome & Streak Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
          <div className="space-y-2">
            <Skeleton className="h-8 sm:h-9 w-56 rounded-xl" />
            <Skeleton className="h-4 w-72 max-w-full rounded" />
          </div>
          <Skeleton className="h-10 w-36 rounded-2xl" />
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>

        {/* Tabs & Content Cards */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * InstructorsPageSkeleton:
 * يحاكي صفحة المعلمين والمدربين
 */
export function InstructorsPageSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل قائمة المدربين..."
    >
      <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 py-2.5">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-7 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-20 h-9 rounded-xl" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-6 w-40 rounded-full mx-auto" />
          <Skeleton className="h-10 w-80 rounded-2xl mx-auto" />
          <Skeleton className="h-4 w-full rounded mx-auto" />
          <div className="max-w-xl mx-auto pt-2">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <InstructorCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
