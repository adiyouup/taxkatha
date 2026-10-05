import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { hrefWith } from "@/lib/admin-params";
import { cn } from "@/lib/utils";

/* Small server-rendered pieces shared by the admin pages. */

/** Link tabs: each tab is a URL, so the current view survives a reload. */
export function AdminTabs({ tabs, label }: { tabs: { href: string; label: string; count?: number; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto border-b">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 px-3.5 pt-1 pb-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                tab.active && "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gold-500",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.6875rem] tabular-nums",
                    tab.active ? "bg-navy-900 text-paper" : "bg-muted text-muted-foreground",
                  )}
                >
                  {formatNumber(tab.count)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Previous / next with the page window. Keeps every other filter in the URL. */
export function AdminPagination({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex h-9 items-center gap-1 rounded-md border border-input bg-card px-3 text-sm font-semibold transition-colors hover:border-gold-600";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
      <p className="type-caption text-muted-foreground">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefWith(path, params, { page: page - 1 })} className={link} rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Link>
        ) : null}
        <span className="type-caption px-1 text-muted-foreground tabular-nums">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={hrefWith(path, params, { page: page + 1 })} className={link} rel="next">
            Next <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** A KPI tile. `delta` compares with the previous period of the same length. */
export function StatTile({
  label,
  value,
  delta,
  hint,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  delta?: { current: number; previous: number } | null;
  hint?: string;
  href?: string;
  icon?: LucideIcon;
  tone?: "default" | "alert";
}) {
  const change = delta && delta.previous > 0 ? Math.round(((delta.current - delta.previous) / delta.previous) * 100) : null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="type-caption font-semibold tracking-[0.02em] text-muted-foreground">{label}</p>
        {Icon ? <Icon strokeWidth={1.5} className={cn("size-4.5", tone === "alert" ? "text-destructive" : "text-gold-700")} aria-hidden /> : null}
      </div>
      <p className={cn("type-numeral mt-3 text-[2rem] leading-none", tone === "alert" ? "text-destructive" : "text-foreground")}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="type-caption mt-2.5 flex flex-wrap items-center gap-x-2 text-muted-foreground">
        {change !== null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", change >= 0 ? "text-emerald-700" : "text-destructive")}>
            {change >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {Math.abs(change)}%
            <span className="sr-only">{change >= 0 ? "up" : "down"} on the previous period</span>
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </p>
    </>
  );
  const shell = "block rounded-xl border bg-card px-5 py-4.5 shadow-soft";
  return href ? (
    <Link href={href} className={cn(shell, "transition-[border-color,box-shadow] hover:border-gold-600/60 hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** Centered message for an empty list. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Icon strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
      <h2 className="type-display-sm mt-5">{title}</h2>
      {children ? <div className="type-small mt-2 max-w-md text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** A label/value list for detail panels. */
export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-6 py-2.5 first:pt-0 last:pb-0">
          <dt className="type-caption shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right text-sm break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
