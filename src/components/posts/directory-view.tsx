import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX, X } from "lucide-react";

import { GoldRule } from "@/components/brand/motif";
import { CaseCard } from "@/components/posts/case-card";
import { FiltersSheet, ParamSelect } from "@/components/posts/directory-controls";
import { DirectoryFilters } from "@/components/posts/directory-filters";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { directoryHref, FORUM_OPTIONS, hasActiveFilters, type DirectoryParams } from "@/lib/directory-params";
import { formatDate, formatNumber } from "@/lib/format";
import { DOMAIN_LABEL, OUTCOME_FILTERS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  DIRECTORY_PAGE_SIZE,
  getDirectoryFacets,
  getFeaturedPosts,
  searchPosts,
  type DirectoryFacets,
  type DirectoryFilters as Filters,
} from "@/server/queries/posts";

type Hidden = ("topic" | "court" | "forum")[];

function activeChips(params: DirectoryParams, facets: DirectoryFacets, hide: Hidden) {
  const chips: { label: string; clear: Parameters<typeof directoryHref>[1] }[] = [];
  if (params.q) chips.push({ label: `“${params.q}”`, clear: { q: undefined, sort: undefined } });
  if (params.forum && !hide.includes("forum")) {
    chips.push({ label: FORUM_OPTIONS.find((f) => f.value === params.forum)?.label ?? params.forum, clear: { forum: undefined } });
  }
  if (params.court && !hide.includes("court")) {
    chips.push({ label: facets.courts.find((c) => c.slug === params.court)?.shortName ?? params.court, clear: { court: undefined } });
  }
  if (params.topic && !hide.includes("topic")) {
    chips.push({
      label: params.topic === "other" ? "Other topics" : (facets.topics.find((t) => t.slug === params.topic)?.name ?? params.topic),
      clear: { topic: undefined },
    });
  }
  if (params.outcome) chips.push({ label: OUTCOME_FILTERS.find((o) => o.value === params.outcome)?.label ?? params.outcome, clear: { outcome: undefined } });
  if (params.remanded) chips.push({ label: "Matter remanded", clear: { remanded: undefined } });
  if (params.section) chips.push({ label: params.section, clear: { section: undefined } });
  if (params.domain) chips.push({ label: DOMAIN_LABEL[params.domain], clear: { domain: undefined } });
  if (params.from) chips.push({ label: `From ${formatDate(params.from)}`, clear: { from: undefined } });
  if (params.to) chips.push({ label: `To ${formatDate(params.to)}`, clear: { to: undefined } });
  return chips;
}

function pageWindow(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...wanted].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const p of list) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push("gap");
    out.push(p);
  }
  return out;
}

/**
 * The searchable list of rulings with its filter panel. Used by the main
 * directory and by topic and court hubs (which fix one filter).
 */
export async function DirectoryView({
  params,
  member,
  basePath = "/case-laws",
  fixed = {},
  hide = [],
}: {
  params: DirectoryParams;
  /** Signed-in members also search the gated analysis. */
  member: boolean;
  basePath?: string;
  fixed?: Pick<Filters, "topic" | "court">;
  hide?: Hidden;
}) {
  const filters: Filters = {
    q: params.q,
    forum: params.forum,
    court: params.court,
    topic: params.topic,
    outcome: params.outcome,
    remanded: params.remanded,
    section: params.section,
    domain: params.domain,
    from: params.from,
    to: params.to,
    sort: params.sort,
    ...fixed,
    type: "case_law",
  };
  const filtered = hasActiveFilters(params);
  const showFeatured = !filtered && params.page === 1 && Object.keys(fixed).length === 0;

  const [facets, results, featured] = await Promise.all([
    getDirectoryFacets(),
    searchPosts(filters, { page: params.page, member }),
    showFeatured ? getFeaturedPosts(3) : Promise.resolve([]),
  ]);

  const chips = activeChips(params, facets, hide);
  const pages = Math.max(1, Math.ceil(results.total / DIRECTORY_PAGE_SIZE));
  const href = (patch: Parameters<typeof directoryHref>[1]) => directoryHref(params, patch, basePath);
  const featuredIds = new Set(featured.map((f) => f.id));
  const items = results.items.filter((item) => !featuredIds.has(item.id));
  const sortOptions = [
    ...(params.q ? [{ value: "relevance", label: "Most relevant" }] : []),
    { value: "latest", label: "Latest decisions" },
    { value: "discussed", label: "Most discussed" },
    { value: "liked", label: "Most liked" },
  ];
  const filterPanel = <DirectoryFilters params={params} facets={facets} basePath={basePath} hide={hide} />;

  return (
    <div className="container-wide grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7.5rem)] overflow-y-auto pr-2" data-lenis-prevent>
          {filterPanel}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-small text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{formatNumber(results.total)}</span>{" "}
            {results.total === 1 ? "ruling" : "rulings"}
            {filtered ? " found" : ""}
          </p>
          <div className="flex items-center gap-2">
            <FiltersSheet activeCount={chips.length}>{filterPanel}</FiltersSheet>
            <ParamSelect
              className="w-44"
              name="sort"
              label="Sort by"
              value={params.sort ?? (params.q ? "relevance" : "latest")}
              options={sortOptions}
              params={params}
              basePath={basePath}
            />
          </div>
        </div>

        {chips.length > 0 ? (
          <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Link
                  href={href(chip.clear)}
                  scroll={false}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xs border border-gold-600/50 bg-gold-50 pr-1.5 pl-2.5 text-xs font-semibold text-gold-800 transition-colors hover:border-gold-700"
                >
                  {chip.label}
                  <X className="size-3.5" aria-hidden />
                  <span className="sr-only">Remove filter</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href={basePath} scroll={false} className="type-caption px-1 font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Clear all
              </Link>
            </li>
          </ul>
        ) : null}

        {featured.length > 0 ? (
          <section aria-labelledby="featured-heading" className="mt-6">
            <h2 id="featured-heading" className="type-eyebrow text-[0.6875rem] text-gold-text">
              Featured by the editors
            </h2>
            <div className="mt-3 grid gap-4">
              {featured.map((post) => (
                <CaseCard key={post.id} post={post} headingLevel="h3" className="border-gold-600/45 bg-gold-50/50" />
              ))}
            </div>
            <GoldRule className="mt-8 mb-2" />
          </section>
        ) : null}

        {items.length === 0 && featured.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
            <SearchX strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
            <h2 className="type-display-sm mt-5">No rulings match these filters</h2>
            <p className="type-small mt-2 max-w-md text-muted-foreground">
              Try a broader search — a party name, a section such as “section 74”, or a subject such as “input tax credit”.
            </p>
            <Link href={basePath} className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
              Clear all filters
            </Link>
          </div>
        ) : (
          <ol aria-label="Results" className="mt-6 grid gap-4" start={(params.page - 1) * DIRECTORY_PAGE_SIZE + 1}>
            {items.map((post) => (
              <li key={post.id}>
                <CaseCard post={post} headingLevel="h2" />
              </li>
            ))}
          </ol>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4 border-t pt-6">
            {params.page > 1 ? (
              <Link href={href({ page: params.page - 1 })} rel="prev" className={buttonVariants({ variant: "outline" })}>
                <ChevronLeft /> Previous
              </Link>
            ) : (
              <span />
            )}
            <ul className="hidden items-center gap-1 sm:flex">
              {pageWindow(params.page, pages).map((p, i) =>
                p === "gap" ? (
                  <li key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
                    …
                  </li>
                ) : (
                  <li key={p}>
                    <Link
                      href={href({ page: p })}
                      aria-current={p === params.page ? "page" : undefined}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors",
                        p === params.page ? "bg-navy-900 text-paper" : "text-foreground hover:bg-muted",
                      )}
                    >
                      {p}
                    </Link>
                  </li>
                ),
              )}
            </ul>
            <p className="type-caption text-muted-foreground sm:hidden">
              Page {params.page} of {pages}
            </p>
            {params.page < pages ? (
              <Link href={href({ page: params.page + 1 })} rel="next" className={buttonVariants({ variant: "outline" })}>
                Next <ChevronRight />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

/** Placeholder with the directory's real geometry, so nothing jumps when results arrive. */
export function DirectorySkeleton() {
  return (
    <div className="container-wide grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12" aria-hidden>
      <div className="hidden space-y-6 lg:block">
        {[5, 4, 8].map((rows, i) => (
          <div key={i} className="space-y-2.5">
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: rows }).map((_, j) => (
              <Skeleton key={j} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-44" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
