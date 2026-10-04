import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  change?: number;
  changeLabel?: string;
  className?: string;
}

export function StatCard({ title, value, icon, change, changeLabel, className }: StatCardProps) {
  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md border-border/60 rounded-2xl overflow-hidden", className)}>
      <CardContent className="p-3.5 sm:p-5 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate leading-tight">{title}</p>
            <p className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">{value}</p>
            {change !== undefined && (
              <p className={cn(
                "text-[11px] sm:text-xs font-medium flex items-center gap-1",
                change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              )}>
                <span>{change >= 0 ? "+" : ""}{change}%</span>
                {changeLabel && <span className="text-muted-foreground truncate"> {changeLabel}</span>}
              </p>
            )}
          </div>
          {icon && (
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
