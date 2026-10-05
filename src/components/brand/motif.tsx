import { cn } from "@/lib/utils";

/**
 * Recurring brand motifs derived from the logo — used instead of repeating
 * the full logo. Scale = balance/accuracy; quill = knowledge/guidance.
 */

/** The logo's divider: hairline · diamond · hairline. */
export function GoldRule({
  className,
  align = "center",
}: {
  className?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center gap-3 text-gold-500",
        align === "center" ? "justify-center" : "justify-start",
        className,
      )}
    >
      {align === "center" ? <span className="h-px w-14 bg-linear-to-r from-transparent to-current" /> : null}
      <Diamond className="size-2" />
      <span
        className={cn(
          "h-px bg-linear-to-r from-current to-transparent",
          align === "center" ? "w-14" : "w-24",
        )}
      />
    </div>
  );
}

export function Diamond({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={cn("shrink-0 fill-current", className)}>
      <rect x="1.6" y="1.6" width="6.8" height="6.8" rx="0.8" transform="rotate(45 5 5)" />
    </svg>
  );
}

/** A fine curved beam, echoing the balance scale's arm. */
export function BalanceArc({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 80"
      fill="none"
      aria-hidden
      preserveAspectRatio="none"
      className={cn("text-gold-500", className)}
    >
      <path d="M4 62 Q400 6 796 62" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="4" cy="62" r="3" fill="currentColor" />
      <circle cx="796" cy="62" r="3" fill="currentColor" />
    </svg>
  );
}

/** A feather-inspired stroke, echoing the quill's spine. */
export function QuillStroke({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 440" fill="none" aria-hidden className={cn("text-gold-500", className)}>
      <path
        d="M22 428 C58 348 98 256 146 164 C186 88 236 40 290 8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M34 420 C92 350 150 262 196 172 C226 112 258 60 290 8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

/** Concentric seal rings, from the logo's circular frame. */
export function SealRings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" fill="none" aria-hidden className={cn("text-gold-500", className)}>
      <circle cx="300" cy="300" r="296" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="300" cy="300" r="276" stroke="currentColor" strokeWidth="0.75" opacity="0.28" />
      <circle cx="300" cy="300" r="222" stroke="currentColor" strokeWidth="0.75" opacity="0.16" />
      <circle cx="4" cy="300" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="596" cy="300" r="3" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
