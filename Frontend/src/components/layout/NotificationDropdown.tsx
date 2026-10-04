import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  CheckCheck,
  BookOpen,
  Award,
  Clock,
  Video,
  Sparkles,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/features/notifications";
import { formatRelative } from "@/lib/format";
import type { Notification, NotificationType } from "@/types";

interface NotificationDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function getNotificationVisuals(type: NotificationType | string) {
  switch (type) {
    case "course_update":
      return {
        icon: BookOpen,
        colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
    case "assignment_due":
      return {
        icon: FileText,
        colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "grade_posted":
      return {
        icon: Award,
        colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "live_session":
      return {
        icon: Video,
        colorClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      };
    case "certificate":
      return {
        icon: Sparkles,
        colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      };
    case "new_message":
      return {
        icon: MessageSquare,
        colorClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      };
    case "system":
      return {
        icon: ShieldAlert,
        colorClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      };
    default:
      return {
        icon: Bell,
        colorClass: "bg-primary/10 text-primary",
      };
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return "";
  try {
    return formatRelative(isoString);
  } catch {
    return isoString;
  }
}

export function NotificationDropdown({
  open,
  onOpenChange,
  onMouseEnter,
  onMouseLeave,
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD">("ALL");

  const { data: notificationsData } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notificationsList = notificationsData?.data || [];
  const unreadCount =
    notificationsData?.unreadCount ??
    notificationsList.filter(
      (n) => !(n.isRead ?? (n as unknown as { is_read?: boolean }).is_read)
    ).length;

  const filteredNotifications = notificationsList.filter((notif) => {
    const isRead =
      notif.isRead ?? (notif as unknown as { is_read?: boolean }).is_read ?? false;
    if (filterTab === "UNREAD") return !isRead;
    return true;
  });

  const handleNotificationClick = (notif: Notification) => {
    const isRead =
      notif.isRead ?? (notif as unknown as { is_read?: boolean }).is_read ?? false;
    if (!isRead) {
      markReadMutation.mutate(notif.id);
    }
    const actionUrl =
      notif.actionUrl ?? (notif as unknown as { action_url?: string }).action_url;
    if (actionUrl) {
      onOpenChange(false);
      navigate(actionUrl);
    }
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative rounded-full hover:bg-muted/80 h-9 w-9 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:ring-0"
            aria-label="مركز التنبيهات والرسائل"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="absolute top-1.5 end-1.5 w-2.5 h-2.5 bg-destructive rounded-full ring-2 ring-background animate-pulse" />
            ) : null}
          </button>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent
        align="end"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="w-[calc(100vw-1.5rem)] sm:w-[390px] p-0 rounded-2xl overflow-hidden border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl outline-none focus:outline-none focus:ring-0"
      >
        {/* Header Section */}
        <div className="p-3.5 pb-2.5 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-foreground">الإشعارات</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary">
                      {unreadCount} جديدة
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">تحديثات حسابك الأكاديمي</p>
              </div>
            </div>

            {/* Header Actions */}
            <div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10 outline-none"
                  title="تحديد كافة التنبيهات كمقروءة"
                >
                  <CheckCheck size={13} />
                  <span>تحديد الكل كمقروء</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 py-1 px-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>محدّث بالكامل</span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Sub-Tabs (shown only if there are notifications) */}
          {notificationsList.length > 0 && (
            <div className="flex items-center gap-1 mt-2.5 bg-muted/50 p-1 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => setFilterTab("ALL")}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterTab === "ALL"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الكل ({notificationsList.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("UNREAD")}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterTab === "UNREAD"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                غير المقروءة ({unreadCount})
              </button>
            </div>
          )}
        </div>

        {/* Notifications List Body */}
        <div className="p-2 space-y-1 max-h-[350px] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="py-9 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground/70 mb-3 shadow-2xs">
                <BellOff size={24} strokeWidth={1.5} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">
                {filterTab === "UNREAD"
                  ? "لا توجد إشعارات غير مقروءة"
                  : "أنت على اطلاع بكل جديد!"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-[250px] leading-relaxed">
                {filterTab === "UNREAD"
                  ? "لقد قمت بقراءة جميع التنبيهات الخاصة بك بنجاح."
                  : "سنرسل لك تنبيهاً فور توفر أي تحديثات على مقرراتك الدراسية أو نتائج اختباراتك."}
              </p>
            </div>
          ) : (
            filteredNotifications.slice(0, 7).map((notif) => {
              const isRead =
                notif.isRead ??
                (notif as unknown as { is_read?: boolean }).is_read ??
                false;
              const actionUrl =
                notif.actionUrl ??
                (notif as unknown as { action_url?: string }).action_url;
              const createdAt =
                notif.createdAt ??
                (notif as unknown as { created_at?: string }).created_at;
              const { icon: IconComponent, colorClass } = getNotificationVisuals(
                notif.type
              );

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all duration-150 cursor-pointer group ${
                    !isRead
                      ? "bg-primary/[0.04] hover:bg-primary/[0.08] border border-primary/15"
                      : "hover:bg-muted/50 border border-transparent opacity-85 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}
                  >
                    <IconComponent size={15} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs font-bold truncate ${
                          !isRead
                            ? "text-foreground group-hover:text-primary"
                            : "text-foreground/85"
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 ring-4 ring-primary/15" />
                      )}
                    </div>

                    <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                        <Clock size={10} />
                        {formatTime(createdAt)}
                      </span>
                      {actionUrl && (
                        <span className="text-[10px] text-primary font-bold group-hover:underline">
                          عرض التفاصيل ←
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Section */}
        <div className="p-2 bg-muted/20 border-t border-border/50 text-center">
          <Link
            to="/notifications"
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-primary hover:text-primary/90 hover:bg-primary/5 rounded-xl transition-colors"
          >
            <span>عرض كافة الإشعارات في صفحة مخصصة</span>
            <ArrowLeft size={13} className="rtl:rotate-180" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
