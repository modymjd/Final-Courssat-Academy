import React from "react";

export const InstructorCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full rounded-[28px] overflow-hidden bg-[#f7f6f2] dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-sm animate-pulse">
      {/* Top Blend Portrait Skeleton */}
      <div className="relative w-full h-60 sm:h-64 bg-muted/60 flex items-center justify-center">
        <div className="w-28 h-28 rounded-full bg-muted/90" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f7f6f2] dark:from-[#18181b] to-transparent" />
      </div>

      {/* Content Section Skeleton */}
      <div className="flex flex-col flex-1 p-5 pt-2 space-y-3">
        {/* Name Skeleton with badge */}
        <div className="flex items-center gap-2">
          <div className="h-5 w-32 bg-muted rounded-md" />
          <div className="w-4 h-4 rounded-full bg-muted" />
        </div>

        {/* Subtitle / Bio Skeleton */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full bg-muted/80 rounded" />
          <div className="h-3.5 w-3/4 bg-muted/60 rounded" />
        </div>

        {/* Footer Metrics & Pill Button Skeleton */}
        <div className="flex items-center justify-between pt-4 mt-auto border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="h-4 w-12 bg-muted rounded" />
            <div className="h-4 w-10 bg-muted rounded" />
          </div>
          <div className="h-7 w-20 bg-muted rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default InstructorCardSkeleton;
