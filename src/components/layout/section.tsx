import { GoldRule } from "@/components/brand/motif";
import { cn } from "@/lib/utils";

/**
 * Page rhythm is NAVY → LIGHT → NAVY. `tone="navy"` flips every semantic
 * token for the subtree, so the same components work on both surfaces.
 */
export function Section({
  tone = "light",
  tint = false,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { tone?: "light" | "navy"; tint?: boolean }) {
  return (
    <section
      className={cn(
        "section-y relative",
        tone === "navy" ? "theme-navy grain" : tint ? "bg-paper-2" : "bg-background",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  as: Tag = "h2",
  className,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
  action?: React.ReactNode;
}) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        centered ? "items-center text-center" : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {eyebrow ? <p className="type-eyebrow text-gold-text">{eyebrow}</p> : null}
        <Tag className={cn("type-display-lg text-foreground", eyebrow && "mt-4")}>{title}</Tag>
        <GoldRule align={centered ? "center" : "start"} className="mt-6" />
        {description ? <p className="type-lede mt-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * The navy band that opens every non-landing page. It clears the fixed
 * header and keeps the brand rhythm consistent.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("theme-navy grain relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_26rem_at_88%_-12%,rgb(212_175_55/0.11),transparent_62%)]"
      />
      <div className="container-wide relative pt-32 pb-12 sm:pt-36 sm:pb-16">
        {eyebrow ? <p className="type-eyebrow text-gold-500">{eyebrow}</p> : null}
        <h1 className={cn("type-display-xl max-w-4xl text-paper", eyebrow && "mt-5")}>{title}</h1>
        {description ? <p className="type-lede mt-6 max-w-2xl text-muted-foreground">{description}</p> : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
      <div className="h-px bg-linear-to-r from-transparent via-gold-500/50 to-transparent" />
    </div>
  );
}
