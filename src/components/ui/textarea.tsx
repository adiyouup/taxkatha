import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-card px-3.5 py-3 text-base leading-relaxed text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-navy-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[0.9375rem] dark:bg-white/5 dark:hover:border-white/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
