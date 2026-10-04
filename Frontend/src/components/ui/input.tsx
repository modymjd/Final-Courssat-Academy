import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border/80 bg-muted/25 px-3.5 py-2 text-sm text-foreground shadow-xs transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/65 hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-muted/15 dark:border-border/70 dark:hover:bg-muted/25 dark:focus-visible:bg-card dark:focus-visible:ring-primary/40 dark:focus-visible:ring-offset-card [&::-webkit-calendar-picker-indicator]:dark:invert-90 [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

