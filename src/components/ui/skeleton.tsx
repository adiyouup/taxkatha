import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-navy-900/8 dark:bg-white/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
