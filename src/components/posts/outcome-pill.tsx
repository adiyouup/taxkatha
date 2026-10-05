import { outcomeShort, type OutcomeSide } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Outcome at a glance. Colour stays inside the brand: a filled navy pill
 * for the assessee, an outlined one for the revenue — the label carries the
 * meaning, never colour alone.
 */
export function OutcomePill({
  side,
  remanded,
  className,
}: {
  side: OutcomeSide;
  remanded: boolean;
  className?: string;
}) {
  const label = outcomeShort(side);
  if (!label && !remanded) return null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {label ? (
        <span
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-xs border px-2 text-[0.6875rem] font-semibold tracking-[0.04em] whitespace-nowrap",
            side === "assessee" && "border-transparent bg-navy-900 text-paper dark:bg-paper dark:text-navy-900",
            side === "revenue" && "border-navy-900/35 text-navy-900 dark:border-white/40 dark:text-paper",
            side === "partly" && "border-gold-600/50 bg-gold-50 text-gold-800 dark:bg-gold-500/15 dark:text-gold-200",
          )}
        >
          {side === "assessee" ? <span aria-hidden className="size-1.5 rounded-full bg-gold-500" /> : null}
          {label}
        </span>
      ) : null}
      {remanded ? (
        <span className="inline-flex h-6 items-center rounded-xs border border-gold-600/50 px-2 text-[0.6875rem] font-semibold tracking-[0.04em] whitespace-nowrap text-gold-800 dark:text-gold-300">
          Remanded
        </span>
      ) : null}
    </span>
  );
}
