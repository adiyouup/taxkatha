import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-xs border border-transparent px-2 text-[0.6875rem] leading-none font-semibold tracking-[0.04em] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-gold-400",
        navy: "bg-navy-900 text-paper dark:bg-paper dark:text-navy-900",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-navy-100 dark:[a]:hover:bg-white/10",
        gold: "border-gold-600/35 bg-gold-50 text-gold-800 dark:border-gold-500/40 dark:bg-gold-500/12 dark:text-gold-200",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:border-gold-600 [a]:hover:bg-accent/60",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-gold-text underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
