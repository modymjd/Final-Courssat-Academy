import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Star, Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface InstructorCardProps {
  instructor: any;
  className?: string;
  actionText?: string;
}

/**
 * Robustly extracts the full name of an instructor regardless of whether
 * the backend returned camelCase or snake_case keys.
 */
export function getInstructorDisplayName(instructor: any): string {
  if (!instructor) return "معلم معتمد";

  const fullName = instructor.fullName || instructor.full_name;
  if (fullName && typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  const first = (instructor.firstName || instructor.first_name || "").trim();
  const last = (instructor.lastName || instructor.last_name || "").trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;

  if (instructor.name && typeof instructor.name === "string" && instructor.name.trim()) {
    return instructor.name.trim();
  }

  if (instructor.email && typeof instructor.email === "string") {
    return instructor.email.split("@")[0];
  }

  return "معلم معتمد";
}

/**
 * Extracts initials for avatar fallback (e.g. "محمد علي" -> "مع").
 */
export function getInstructorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`;
  }
  return parts[0]?.slice(0, 2) || "م";
}

/**
 * Formats numbers into human-friendly counts (e.g. 3400 -> 3.4K).
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num}`;
}

/**
 * Resolves avatar image URL properly with fallback for relative media paths.
 */
export function resolveAvatarUrl(avatar?: string | null): string | null {
  if (!avatar || typeof avatar !== "string" || !avatar.trim()) return null;
  const trimmed = avatar.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/v1\/?$/, "") || "http://127.0.0.1:8000";
  return `${apiOrigin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export const InstructorCard: React.FC<InstructorCardProps> = ({
  instructor,
  className = "",
  actionText = "عرض الملف",
}) => {
  const [imgError, setImgError] = useState(false);

  if (!instructor) return null;

  const id = instructor.id;
  const displayName = getInstructorDisplayName(instructor);
  const initials = getInstructorInitials(displayName);
  const rawAvatar = instructor.avatar || null;
  const avatarUrl = resolveAvatarUrl(rawAvatar);

  // Subtitle / Bio / Specialization
  const subtitle =
    instructor.title?.trim() ||
    instructor.specialization?.trim() ||
    instructor.teachingSubject?.trim() ||
    instructor.teaching_subject?.trim() ||
    instructor.bio?.trim() ||
    "معلم ومحاضر معتمد لمقررات منصة كورسات الذكية";

  // Metrics
  const studentsCount = Number(
    instructor.studentsCount ??
    instructor.students_count ??
    instructor.totalStudents ??
    0
  );

  const ratingAvg = Number(
    instructor.ratingAvg ??
    instructor.rating_avg ??
    instructor.rating ??
    0
  );

  const coursesCount = Number(
    instructor.coursesCount ??
    instructor.courses_count ??
    0
  );

  // Status flags
  const isVerified = instructor.isVerified ?? instructor.is_verified ?? true;
  const isFeatured = instructor.isFeatured ?? instructor.is_featured ?? false;

  // Profile URL
  const targetUrl = instructor.profileUrl || instructor.profile_url || `/instructors/${id}`;

  return (
    <div
      className={`group relative flex flex-col h-full rounded-[28px] overflow-hidden bg-[#f7f6f2] dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${className}`}
    >
      <Link to={targetUrl} className="flex flex-col h-full outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {/* Top Portrait & Blend Dissolve Section */}
        <div className="relative w-full h-60 sm:h-64 overflow-hidden bg-gradient-to-b from-stone-200/60 via-stone-200/30 to-transparent dark:from-zinc-800/50 dark:via-zinc-800/20">
          {/* Featured Badge if applicable */}
          {isFeatured && (
            <div className="absolute top-3.5 right-3.5 z-20 pointer-events-none">
              <Badge className="bg-amber-500/95 hover:bg-amber-500 text-white text-[11px] font-bold gap-1 border-0 shadow-md backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                <Sparkles size={11} /> متميّز
              </Badge>
            </div>
          )}

          {/* Photo or Stylized Monogram */}
          {avatarUrl && !imgError ? (
            <img
              src={avatarUrl}
              alt={displayName}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
              style={{
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 98%)",
                WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 98%)",
              }}
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center select-none"
              style={{
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 98%)",
                WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 98%)",
              }}
            >
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-teal-500/20 via-primary/20 to-emerald-500/30 border border-primary/20 flex items-center justify-center text-3xl font-black text-primary/80 shadow-inner group-hover:scale-105 transition-transform duration-300">
                {initials}
              </div>
            </div>
          )}

          {/* Bottom Card Blend Gradient: Seamlessly dissolves the photo into the card background */}
          <div
            className="absolute inset-x-0 bottom-0 h-28 pointer-events-none bg-gradient-to-t from-[#f7f6f2] via-[#f7f6f2]/80 to-transparent dark:from-[#18181b] dark:via-[#18181b]/80"
            aria-hidden="true"
          />
        </div>

        {/* Content Section */}
        <div className="flex flex-col flex-1 p-5 pt-1 text-right">
          {/* Name & Green Verified Badge */}
          <div className="flex items-center gap-1.5 justify-start">
            <h3 className="font-black text-lg sm:text-xl text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
              {displayName}
            </h3>
            {isVerified && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shrink-0 shadow-xs"
                title="معلم معتمد وموثق"
              >
                <Check className="w-2.5 h-2.5 stroke-[3.5]" />
              </span>
            )}
          </div>

          {/* Title / Bio / Specialization */}
          <p className="text-xs sm:text-[13px] text-muted-foreground font-normal leading-relaxed line-clamp-2 mt-1.5 mb-4">
            {subtitle}
          </p>

          {/* Footer Metrics & Action Pill Button */}
          <div className="flex items-center justify-between pt-3.5 mt-auto border-t border-black/[0.06] dark:border-white/[0.08]">
            {/* Stats */}
            <div className="flex items-center gap-3.5 text-xs font-semibold text-foreground/85">
              <div className="flex items-center gap-1.5" title={`${studentsCount.toLocaleString("ar-EG")} طالب مسجل`}>
                <Users size={14} className="text-muted-foreground" />
                <span>{formatCompactNumber(studentsCount)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-500" title={`التقييم: ${ratingAvg.toFixed(1)}`}>
                <Star size={14} className="fill-amber-500 text-amber-500" />
                <span>{ratingAvg > 0 ? ratingAvg.toFixed(1) : (coursesCount > 0 ? `${coursesCount} دورات` : "متميز")}</span>
              </div>
            </div>

            {/* Pill Action Button */}
            <span
              className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-black text-white dark:bg-white dark:text-black font-bold text-xs shadow-xs hover:opacity-90 active:scale-95 transition-all shrink-0 select-none"
            >
              {actionText}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default InstructorCard;
