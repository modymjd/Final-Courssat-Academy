import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Shield, GraduationCap, Award, Building2 } from "lucide-react";

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  role?: "student" | "instructor" | "center" | "guardian" | "admin" | "super_admin" | string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "hero";
  className?: string;
  ring?: boolean;
  showRoleBadge?: boolean;
  alt?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-24 h-24 text-3xl",
  hero: "w-28 h-28 sm:w-32 sm:h-32 text-3xl sm:text-4xl",
};

const BADGE_SIZE_MAP = {
  xs: "w-2.5 h-2.5 p-0.5",
  sm: "w-3 h-3 p-0.5",
  md: "w-3.5 h-3.5 p-0.5",
  lg: "w-4 h-4 p-0.5",
  xl: "w-5 h-5 p-1",
  "2xl": "w-6 h-6 p-1",
  hero: "w-7 h-7 p-1.5",
};

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "م";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  role,
  size = "md",
  className,
  ring = true,
  showRoleBadge = false,
  alt,
}) => {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(name);
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const badgeSizeClass = BADGE_SIZE_MAP[size] || BADGE_SIZE_MAP.md;

  // Resolve media URL if relative
  const normalizedSrc = React.useMemo(() => {
    if (!src || hasError) return undefined;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:")) {
      return src;
    }
    // Relative media path: can be accessed via local backend host or proxy
    const baseUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "")
      : "http://127.0.0.1:8000";
    return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
  }, [src, hasError]);

  const roleStyles = React.useMemo(() => {
    switch (role) {
      case "instructor":
        return {
          ring: "ring-teal-500/20 border-teal-500/30",
          bg: "bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-700 dark:text-teal-300",
          badgeBg: "bg-teal-600 text-white",
          BadgeIcon: Award,
        };
      case "admin":
      case "super_admin":
        return {
          ring: "ring-rose-500/20 border-rose-500/30",
          bg: "bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-700 dark:text-rose-300",
          badgeBg: "bg-rose-600 text-white",
          BadgeIcon: Shield,
        };
      case "center":
        return {
          ring: "ring-purple-500/20 border-purple-500/30",
          bg: "bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300",
          badgeBg: "bg-purple-600 text-white",
          BadgeIcon: Building2,
        };
      case "student":
      default:
        return {
          ring: "ring-primary/20 border-primary/30",
          bg: "bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
          badgeBg: "bg-primary text-primary-foreground",
          BadgeIcon: GraduationCap,
        };
    }
  }, [role]);

  return (
    <div className="relative inline-block shrink-0">
      <Avatar
        className={cn(
          sizeClass,
          "transition-all duration-200 overflow-hidden select-none",
          ring && `ring-2 ${roleStyles.ring}`,
          className
        )}
      >
        {normalizedSrc && !hasError ? (
          <AvatarImage
            src={normalizedSrc}
            alt={alt || name || "User Avatar"}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : null}
        <AvatarFallback
          className={cn(
            "w-full h-full flex items-center justify-center font-black tracking-wider uppercase",
            roleStyles.bg
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {showRoleBadge && (
        <span
          className={cn(
            "absolute -bottom-0.5 -end-0.5 rounded-full flex items-center justify-center shadow-xs ring-1 ring-background",
            badgeSizeClass,
            roleStyles.badgeBg
          )}
          title={`الدور: ${role}`}
        >
          <roleStyles.BadgeIcon className="w-full h-full" />
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
