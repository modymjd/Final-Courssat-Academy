import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[90px] w-full rounded-xl border border-border/80 bg-muted/25 px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-all duration-200 placeholder:text-muted-foreground/65 hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-muted/15 dark:border-border/70 dark:hover:bg-muted/25 dark:focus-visible:bg-card dark:focus-visible:ring-primary/40 dark:focus-visible:ring-offset-card",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

