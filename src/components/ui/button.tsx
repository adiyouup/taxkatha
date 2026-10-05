import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * TaxKatha buttons. Primary is gold with navy text (the brief's CTA);
 * corners are moderate (never pills); hover adds a warm-gold lift.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding font-sans text-sm font-semibold tracking-[0.01em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out-quart outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:-translate-y-px hover:bg-gold-400 hover:shadow-gold",
        navy: "border-transparent bg-navy-900 text-paper hover:-translate-y-px hover:bg-navy-800 hover:shadow-lift dark:bg-paper dark:text-navy-900 dark:hover:bg-white",
        outline:
          "border-navy-900/25 bg-transparent text-foreground hover:border-gold-600 hover:bg-accent/60 aria-expanded:border-gold-600 dark:border-white/35 dark:hover:border-gold-500 dark:hover:bg-accent",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-navy-100 aria-expanded:bg-navy-100 dark:hover:bg-white/10",
        ghost:
          "border-transparent text-foreground hover:bg-muted aria-expanded:bg-muted dark:hover:bg-white/8",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:outline-destructive",
        link: "h-auto rounded-none border-transparent px-0 text-gold-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 gap-1 rounded-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-[0.9375rem]",
        xl: "h-14 gap-2.5 rounded-lg px-8 text-base",
        icon: "size-10",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
