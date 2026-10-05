import Link from "next/link";
import { Check } from "lucide-react";

import { DateRange, ParamSelect } from "@/components/posts/directory-controls";
import { directoryHref, FORUM_OPTIONS, type DirectoryParams } from "@/lib/directory-params";
import { formatNumber } from "@/lib/format";
import { COURT_TYPE_LABEL, OUTCOME_FILTERS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { DirectoryFacets } from "@/server/queries/posts";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="type-eyebrow text-[0.6875rem] text-gold-text">{title}</h3>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** A filter value as a link: toggles on/off, shows a count, and is crawlable. */
function Option({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
        active ? "bg-navy-900 font-semibold text-paper" : "text-foreground hover:bg-muted",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {active ? <Check className="size-3.5 shrink-0 text-gold-400" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined ? (
        <span className={cn("type-caption shrink-0 tabular-nums", active ? "text-paper/70" : "text-muted-foreground")}>{formatNumber(count)}</span>
      ) : null}
    </Link>
  );
}

export function DirectoryFilters({
  params,
  facets,
  basePath = "/case-laws",
  hide = [],
}: {
  params: DirectoryParams;
  facets: DirectoryFacets;
  basePath?: string;
  /** Filters fixed by the page (a topic hub hides "topic", a court hub hides "court"). */
  hide?: ("topic" | "court" | "forum")[];
}) {
  const href = (patch: Parameters<typeof directoryHref>[1]) => directoryHref(params, patch, basePath);
  const forumCount = (forum: string) =>
    facets.courts
      .filter((c) => (forum === "advance_ruling" ? c.type === "aar" || c.type === "aaar" : c.type === forum))
      .reduce((sum, c) => sum + c.count, 0);

  const courtOptions = facets.courts.map((c) => ({
    value: c.slug,
    label: `${c.shortName} (${c.count})`,
    group: COURT_TYPE_LABEL[c.type],
  }));
  const topSections = facets.sections.slice(0, 10);
  const moreSections = facets.sections.slice(10).map((s) => ({ value: s.ref, label: `${s.ref} (${s.count})` }));

  return (
    <div>
      {hide.includes("forum") ? null : (
        <Group title="Forum">
          <div className="space-y-0.5">
            {FORUM_OPTIONS.map((option) => (
              <Option
                key={option.value}
                href={href({ forum: params.forum === option.value ? undefined : option.value, court: undefined })}
                active={params.forum === option.value}
                label={option.label}
                count={forumCount(option.value)}
              />
            ))}
          </div>
          {hide.includes("court") ? null : (
            <ParamSelect
              className="mt-3"
              name="court"
              label="Court or bench"
              allLabel="Any court or bench"
              value={params.court}
              options={courtOptions}
              params={params}
              basePath={basePath}
            />
          )}
        </Group>
      )}

      <Group title="Outcome">
        <div className="space-y-0.5">
          {OUTCOME_FILTERS.map((option) => (
            <Option
              key={option.value}
              href={href({ outcome: params.outcome === option.value ? undefined : option.value })}
              active={params.outcome === option.value}
              label={option.label}
              count={facets.outcomes[option.value]}
            />
          ))}
          <Option href={href({ remanded: params.remanded ? undefined : true })} active={Boolean(params.remanded)} label="Matter remanded" count={facets.remanded} />
        </div>
      </Group>

      {hide.includes("topic") ? null : (
        <Group title="Topic">
          <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1" data-lenis-prevent>
            {facets.topics.map((topic) => (
              <Option
                key={topic.slug}
                href={href({ topic: params.topic === topic.slug ? undefined : topic.slug })}
                active={params.topic === topic.slug}
                label={topic.name}
                count={topic.count}
              />
            ))}
            {facets.otherTopicCount > 0 ? (
              <Option
                href={href({ topic: params.topic === "other" ? undefined : "other" })}
                active={params.topic === "other"}
                label="Other"
                count={facets.otherTopicCount}
              />
            ) : null}
          </div>
        </Group>
      )}

      <Group title="Provision">
        <ul className="flex flex-wrap gap-1.5">
          {topSections.map((section) => {
            const active = params.section === section.ref;
            return (
              <li key={section.ref}>
                <Link
                  href={href({ section: active ? undefined : section.ref })}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center rounded-xs border px-2 text-xs font-medium transition-colors",
                    active ? "border-navy-900 bg-navy-900 text-paper" : "border-border text-foreground hover:border-gold-600",
                  )}
                >
                  {section.ref}
                </Link>
              </li>
            );
          })}
        </ul>
        {moreSections.length > 0 ? (
          <ParamSelect
            className="mt-3"
            name="section"
            label="More provisions"
            allLabel="More provisions…"
            value={topSections.some((s) => s.ref === params.section) ? undefined : params.section}
            options={moreSections}
            params={params}
            basePath={basePath}
          />
        ) : null}
      </Group>

      <Group title="Decision date">
        <DateRange params={params} basePath={basePath} min={facets.dateRange?.from} max={facets.dateRange?.to} />
      </Group>
    </div>
  );
}
