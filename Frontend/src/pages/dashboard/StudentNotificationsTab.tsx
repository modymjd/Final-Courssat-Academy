import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, ExternalLink, Clock, BellOff } from "lucide-react";

export default function StudentNotificationsTab({ notifications }: { notifications: any[] }) {
  const items = notifications || [];

  return (
    <Card className="border-border/60 rounded-2xl overflow-hidden shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40 bg-muted/10">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Bell size={18} className="text-primary" />
          مركز الإشعارات والتنبيهات
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {items.length} إشعار
        </span>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {items.length === 0 ? (
          <div className="text-center py-10">
            <BellOff size={36} className="mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium text-sm">لا توجد إشعارات جديدة حالياً.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">ستصلك هنا إشعارات فورية عند نشر دروس أو اختبارات جديدة في دوراتك.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((notification) => {
              const isRead = notification.isRead ?? notification.is_read ?? false;
              const actionUrl = notification.actionUrl || notification.action_url;
              const createdAt = notification.createdAt || notification.created_at;

              const content = (
                <div
                  className={`flex items-start justify-between gap-3 p-3.5 rounded-xl transition-colors ${
                    !isRead ? "bg-primary/5 border border-primary/15" : "hover:bg-muted/40"
                  } ${actionUrl ? "cursor-pointer group" : ""}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        !isRead ? "bg-primary shadow-xs" : "bg-muted-foreground/30"
                      }`}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm leading-snug font-bold ${!isRead ? "text-foreground" : "text-muted-foreground"}`}>
                          {notification.title}
                        </p>
                        {!isRead && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4 shrink-0 font-bold">
                            جديد
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {notification.message}
                      </p>
                      {createdAt && (
                        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 pt-0.5">
                          <Clock size={11} />
                          <span>{new Date(createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {actionUrl && (
                    <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 pt-1">
                      <ExternalLink size={15} />
                    </div>
                  )}
                </div>
              );

              return actionUrl ? (
                <div key={notification.id} className="py-1">
                  <Link to={actionUrl} className="block">
                    {content}
                  </Link>
                </div>
              ) : (
                <div key={notification.id} className="py-1">
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
