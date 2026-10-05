import { COURT_TYPE_LABEL, DOMAIN_LABEL, type CourtType, type TaxDomain } from "@/lib/labels";

/*
 * The directory's state lives entirely in the URL, so every search and
 * filter combination is a shareable, crawlable link.
 */

export type DirectorySort = "relevance" | "latest" | "discussed" | "liked";

export type DirectoryParams = {
  q?: string;
  forum?: CourtType | "advance_ruling";
  court?: string;
  topic?: string;
  outcome?: "assessee" | "revenue" | "partly";
  remanded?: boolean;
  section?: string;
  domain?: TaxDomain;
  from?: string;
  to?: string;
  sort?: DirectorySort;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9-]{1,90}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SORTS: DirectorySort[] = ["relevance", "latest", "discussed", "liked"];
const OUTCOMES = ["assessee", "revenue", "partly"] as const;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined ? undefined : v.trim() || undefined;
}

/** Reads and validates URL params. Unknown or malformed values are dropped, never trusted. */
export function parseDirectoryParams(raw: Raw): DirectoryParams {
  const forum = one(raw.forum);
  const outcome = one(raw.outcome);
  const sort = one(raw.sort);
  const domain = one(raw.domain);
  const court = one(raw.court);
  const topic = one(raw.topic);
  const from = one(raw.from);
  const to = one(raw.to);
  const page = Number.parseInt(one(raw.page) ?? "1", 10);

  return {
    q: one(raw.q)?.slice(0, 200),
    forum: forum === "advance_ruling" || (forum && forum in COURT_TYPE_LABEL) ? (forum as DirectoryParams["forum"]) : undefined,
    court: court && SLUG.test(court) ? court : undefined,
    topic: topic && SLUG.test(topic) ? topic : undefined,
    outcome: OUTCOMES.includes(outcome as (typeof OUTCOMES)[number]) ? (outcome as DirectoryParams["outcome"]) : undefined,
    remanded: one(raw.remanded) === "1" ? true : undefined,
    section: one(raw.section)?.slice(0, 60),
    domain: domain && domain in DOMAIN_LABEL ? (domain as TaxDomain) : undefined,
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    sort: SORTS.includes(sort as DirectorySort) ? (sort as DirectorySort) : undefined,
    page: Number.isFinite(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

const ORDER = ["q", "forum", "court", "topic", "outcome", "remanded", "section", "domain", "from", "to", "sort", "page"] as const;

/** Builds a directory URL from the current params plus a patch. Changing a filter resets the page. */
export function directoryHref(
  current: DirectoryParams,
  patch: Partial<Record<(typeof ORDER)[number], string | number | boolean | undefined>> = {},
  basePath = "/case-laws",
): string {
  const merged: Record<string, string | number | boolean | undefined> = { ...current, ...patch };
  if (!("page" in patch)) merged.page = 1;

  const params = new URLSearchParams();
  for (const key of ORDER) {
    const value = merged[key];
    if (value === undefined || value === false || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    params.set(key, value === true ? "1" : String(value));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function hasActiveFilters(p: DirectoryParams): boolean {
  return Boolean(p.q || p.forum || p.court || p.topic || p.outcome || p.remanded || p.section || p.domain || p.from || p.to);
}

/** The forum groups offered as quick filters, in display order. */
export const FORUM_OPTIONS: { value: NonNullable<DirectoryParams["forum"]>; label: string }[] = [
  { value: "supreme_court", label: "Supreme Court" },
  { value: "high_court", label: "High Courts" },
  { value: "gstat", label: "GSTAT" },
  { value: "advance_ruling", label: "Advance rulings" },
];
