import Link from "next/link";

import { cn } from "@/lib/utils";

/** Statute tags ("CGST S.74"). Each links to the directory filtered by that provision. */
export function SectionChips({
  refs,
  max = 4,
  linked = true,
  className,
}: {
  refs: string[];
  max?: number;
  linked?: boolean;
  className?: string;
}) {
  if (refs.length === 0) return null;
  const shown = refs.slice(0, max);
  const extra = refs.length - shown.length;
  const chip =
    "inline-flex h-6 items-center rounded-xs border border-border px-2 text-[0.6875rem] font-medium tracking-[0.02em] whitespace-nowrap text-muted-foreground";

  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((ref) => (
        <li key={ref}>
          {linked ? (
            <Link
              href={`/case-laws?section=${encodeURIComponent(ref)}`}
              className={cn(chip, "relative z-10 transition-colors hover:border-gold-600 hover:text-foreground")}
            >
              {ref}
            </Link>
          ) : (
            <span className={chip}>{ref}</span>
          )}
        </li>
      ))}
      {extra > 0 ? <li className="text-[0.6875rem] font-medium text-muted-foreground">+{extra}</li> : null}
    </ul>
  );
}
