import "server-only";

import { and, count, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import type { CourtType, OutcomeSide, TaxDomain } from "@/lib/labels";
import { postTag, TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { caseLawDetails, courts, insightDetails, postStats, posts, slugHistory, topics, user } from "@/server/db/schema";

/*
 * PUBLIC reads. Everything here is safe to render for anonymous visitors and
 * to cache in the shared cache: only public columns are ever selected.
 * Gated text (background, decision, members-only bodies) is read exclusively
 * through `getCaseBody` / `getInsightBody`, which callers may invoke only
 * after verifying a session.
 */

export type PostCard = {
  id: string;
  type: "case_law" | "insight";
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  domain: TaxDomain;
  featured: boolean;
  editorNote: string | null;
  topic: { name: string; slug: string } | null;
  stats: { likes: number; comments: number; saves: number; shares: number; views: number };
  caseLaw: {
    court: { name: string; shortName: string; slug: string; type: CourtType };
    decisionDate: string;
    outcomeSide: OutcomeSide;
    remanded: boolean;
    sectionRefs: string[];
    domainLabel: string;
  } | null;
  insight: {
    coverImageUrl: string | null;
    coverImageAlt: string | null;
    readingMinutes: number;
    authorName: string | null;
    membersOnly: boolean;
  } | null;
};

const cardColumns = {
  id: posts.id,
  type: posts.type,
  slug: posts.slug,
  title: posts.title,
  excerpt: posts.excerpt,
  publishedAt: posts.publishedAt,
  domain: posts.domain,
  boostRank: posts.boostRank,
  boostUntil: posts.boostUntil,
  editorNote: posts.editorNote,
  topicName: topics.name,
  topicSlug: topics.slug,
  topicReviewed: topics.reviewed,
  likeCount: postStats.likeCount,
  commentCount: postStats.commentCount,
  saveCount: postStats.saveCount,
  shareCount: postStats.shareCount,
  viewCount: postStats.viewCount,
  courtName: courts.name,
  courtShortName: courts.shortName,
  courtSlug: courts.slug,
  courtType: courts.type,
  decisionDate: caseLawDetails.decisionDate,
  outcomeSide: caseLawDetails.outcomeSide,
  remanded: caseLawDetails.remanded,
  sectionRefs: caseLawDetails.sectionRefs,
  domainLabel: caseLawDetails.domainLabel,
  coverImageUrl: insightDetails.coverImageUrl,
  coverImageAlt: insightDetails.coverImageAlt,
  readingMinutes: insightDetails.readingMinutes,
  membersOnly: insightDetails.membersOnly,
  authorName: user.name,
};

function cardQuery() {
  return db
    .select(cardColumns)
    .from(posts)
    .leftJoin(postStats, eq(postStats.postId, posts.id))
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .leftJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .leftJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .leftJoin(insightDetails, eq(insightDetails.postId, posts.id))
    .leftJoin(user, eq(user.id, insightDetails.authorId));
}

type CardRow = Awaited<ReturnType<typeof cardQuery>>[number];

function toCard(row: CardRow, now: Date): PostCard {
  const featured = row.boostRank !== null && (row.boostUntil === null || row.boostUntil > now);
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    domain: row.domain,
    featured,
    editorNote: featured ? row.editorNote : null,
    // Unreviewed topics are internal until an admin approves them.
    topic: row.topicName && row.topicSlug && row.topicReviewed ? { name: row.topicName, slug: row.topicSlug } : null,
    stats: {
      likes: row.likeCount ?? 0,
      comments: row.commentCount ?? 0,
      saves: row.saveCount ?? 0,
      shares: row.shareCount ?? 0,
      views: row.viewCount ?? 0,
    },
    caseLaw:
      row.type === "case_law" && row.courtName && row.courtSlug && row.courtType && row.decisionDate
        ? {
            court: { name: row.courtName, shortName: row.courtShortName ?? row.courtName, slug: row.courtSlug, type: row.courtType },
            decisionDate: row.decisionDate,
            outcomeSide: row.outcomeSide ?? "unknown",
            remanded: row.remanded ?? false,
            sectionRefs: row.sectionRefs ?? [],
            domainLabel: row.domainLabel ?? "",
          }
        : null,
    insight:
      row.type === "insight"
        ? {
            coverImageUrl: row.coverImageUrl,
            coverImageAlt: row.coverImageAlt,
            readingMinutes: row.readingMinutes ?? 1,
            authorName: row.authorName,
            membersOnly: row.membersOnly ?? false,
          }
        : null,
  };
}

/** Live to the public: published, and not scheduled for the future. */
const isLive = and(eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`));

/** Newest first: a ruling by its decision date, an insight by its publication date. */
const recency = sql`coalesce(${caseLawDetails.decisionDate}::timestamptz, ${posts.publishedAt})`;

/* ------------------------------- Directory -------------------------------- */

export const DIRECTORY_SORTS = ["relevance", "latest", "discussed", "liked"] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

export type DirectoryFilters = {
  q?: string;
  type?: "case_law" | "insight";
  /** A court type, or "advance_ruling" for AAR and AAAR together. */
  forum?: CourtType | "advance_ruling";
  court?: string;
  topic?: string;
  outcome?: Exclude<OutcomeSide, "unknown">;
  remanded?: boolean;
  section?: string;
  domain?: TaxDomain;
  from?: string;
  to?: string;
  sort?: DirectorySort;
};

export const DIRECTORY_PAGE_SIZE = 20;

function directoryWhere(filters: DirectoryFilters, member: boolean) {
  const conditions: (SQL | undefined)[] = [isLive];
  const q = filters.q?.trim();
  let rank: SQL | null = null;

  if (q) {
    // Members also search the gated analysis; anonymous visitors only public text.
    const vector = member ? posts.searchMember : posts.searchPublic;
    const tsq = sql`websearch_to_tsquery('english', ${q})`;
    rank = sql`ts_rank_cd(${vector}, ${tsq}, 32)`;
    conditions.push(q.length >= 3 ? or(sql`${vector} @@ ${tsq}`, ilike(posts.title, `%${q.replace(/[%_\\]/g, "\\$&")}%`)) : sql`${vector} @@ ${tsq}`);
  }
  if (filters.type) conditions.push(eq(posts.type, filters.type));
  if (filters.forum === "advance_ruling") conditions.push(inArray(courts.type, ["aar", "aaar"]));
  else if (filters.forum) conditions.push(eq(courts.type, filters.forum));
  if (filters.court) conditions.push(eq(courts.slug, filters.court));
  if (filters.topic === "other") conditions.push(or(sql`${posts.topicId} is null`, eq(topics.reviewed, false)));
  else if (filters.topic) conditions.push(and(eq(topics.slug, filters.topic), eq(topics.reviewed, true)));
  if (filters.outcome) conditions.push(eq(caseLawDetails.outcomeSide, filters.outcome));
  if (filters.remanded) conditions.push(eq(caseLawDetails.remanded, true));
  if (filters.section) conditions.push(sql`${caseLawDetails.sectionRefs} @> ARRAY[${filters.section}]::text[]`);
  if (filters.domain) conditions.push(eq(posts.domain, filters.domain));
  if (filters.from) conditions.push(gte(caseLawDetails.decisionDate, filters.from));
  if (filters.to) conditions.push(lte(caseLawDetails.decisionDate, filters.to));

  return { where: and(...conditions), rank };
}

export async function searchPosts(
  filters: DirectoryFilters,
  options: { page: number; member: boolean; pageSize?: number },
): Promise<{ items: PostCard[]; total: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.posts);

  const pageSize = options.pageSize ?? DIRECTORY_PAGE_SIZE;
  const { where, rank } = directoryWhere(filters, options.member);
  const sort: DirectorySort = filters.sort ?? (rank ? "relevance" : "latest");

  const order: SQL[] =
    sort === "relevance" && rank
      ? [desc(rank), desc(recency)]
      : sort === "discussed"
        ? [desc(sql`coalesce(${postStats.commentCount}, 0)`), desc(recency)]
        : sort === "liked"
          ? [desc(sql`coalesce(${postStats.likeCount}, 0)`), desc(recency)]
          : [desc(recency)];

  const [totalRow] = await db
    .select({ n: count() })
    .from(posts)
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .leftJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .leftJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .where(where);

  const rows = await cardQuery()
    .where(where)
    .orderBy(...order, posts.id)
    .limit(pageSize)
    .offset((Math.max(1, options.page) - 1) * pageSize);

  const now = new Date();
  return { items: rows.map((row) => toCard(row, now)), total: totalRow?.n ?? 0 };
}

/** Admin-featured posts, in the admin's order. Expired boosts drop out on their own. */
export async function getFeaturedPosts(limit = 6): Promise<PostCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.posts, TAGS.trending);

  const rows = await cardQuery()
    .where(and(isLive, isNotNull(posts.boostRank), or(sql`${posts.boostUntil} is null`, sql`${posts.boostUntil} > now()`)))
    .orderBy(posts.boostRank, desc(recency))
    .limit(limit);
  const now = new Date();
  return rows.map((row) => toCard(row, now));
}

export async function getLatestPosts(type: "case_law" | "insight", limit: number): Promise<PostCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.posts);

  const rows = await cardQuery()
    .where(and(isLive, eq(posts.type, type)))
    .orderBy(desc(recency), posts.id)
    .limit(limit);
  const now = new Date();
  return rows.map((row) => toCard(row, now));
}

/* --------------------------------- Facets --------------------------------- */

export type DirectoryFacets = {
  total: number;
  courts: { name: string; shortName: string; slug: string; type: CourtType; count: number }[];
  topics: { name: string; slug: string; description: string | null; count: number }[];
  otherTopicCount: number;
  sections: { ref: string; count: number }[];
  outcomes: Record<OutcomeSide, number>;
  remanded: number;
  dateRange: { from: string; to: string } | null;
};

export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts, TAGS.taxonomy);

  const live = and(isLive, eq(posts.type, "case_law"));

  const [courtRows, topicRows, sectionRows, outcomeRows, totals] = await Promise.all([
    db
      .select({ name: courts.name, shortName: courts.shortName, slug: courts.slug, type: courts.type, count: count() })
      .from(caseLawDetails)
      .innerJoin(posts, eq(posts.id, caseLawDetails.postId))
      .innerJoin(courts, eq(courts.id, caseLawDetails.courtId))
      .where(live)
      .groupBy(courts.id)
      .orderBy(desc(count()), courts.name),
    db
      .select({ name: topics.name, slug: topics.slug, description: topics.description, reviewed: topics.reviewed, count: count() })
      .from(posts)
      .innerJoin(topics, eq(topics.id, posts.topicId))
      .where(live)
      .groupBy(topics.id)
      .orderBy(desc(count()), topics.name),
    db.execute<{ ref: string; count: number }>(sql`
      SELECT ref, count(*)::int AS count
      FROM case_law_details c
      JOIN posts p ON p.id = c.post_id, unnest(c.section_refs) AS ref
      WHERE p.status = 'published' AND p.published_at <= now()
      GROUP BY ref
      ORDER BY count DESC, ref
      LIMIT 60
    `),
    db
      .select({ side: caseLawDetails.outcomeSide, remanded: caseLawDetails.remanded, count: count() })
      .from(caseLawDetails)
      .innerJoin(posts, eq(posts.id, caseLawDetails.postId))
      .where(live)
      .groupBy(caseLawDetails.outcomeSide, caseLawDetails.remanded),
    db
      .select({
        total: count(),
        from: sql<string | null>`min(${caseLawDetails.decisionDate})`,
        to: sql<string | null>`max(${caseLawDetails.decisionDate})`,
      })
      .from(caseLawDetails)
      .innerJoin(posts, eq(posts.id, caseLawDetails.postId))
      .where(live),
  ]);

  const outcomes: Record<OutcomeSide, number> = { assessee: 0, revenue: 0, partly: 0, unknown: 0 };
  let remanded = 0;
  for (const row of outcomeRows) {
    outcomes[row.side] += row.count;
    if (row.remanded) remanded += row.count;
  }

  const total = totals[0]?.total ?? 0;
  const reviewedTopics = topicRows.filter((t) => t.reviewed);
  const reviewedCount = reviewedTopics.reduce((sum, t) => sum + t.count, 0);

  return {
    total,
    courts: courtRows,
    topics: reviewedTopics.map(({ name, slug, description, count: n }) => ({ name, slug, description, count: n })),
    otherTopicCount: total - reviewedCount,
    sections: sectionRows.rows.map((r) => ({ ref: r.ref, count: Number(r.count) })),
    outcomes,
    remanded,
    dateRange: totals[0]?.from && totals[0]?.to ? { from: totals[0].from, to: totals[0].to } : null,
  };
}

/* -------------------------------- Case page ------------------------------- */

export type CaseTeaser = PostCard & {
  caseLaw: NonNullable<PostCard["caseLaw"]> & { bench: string; caseNumber: string; relevantSections: string };
};

/** Everything PUBLIC about one case. Never includes background or decision. */
export async function getCaseTeaser(slug: string): Promise<CaseTeaser | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.posts, postTag(slug));

  const [row] = await db
    .select({
      ...cardColumns,
      bench: caseLawDetails.bench,
      caseNumber: caseLawDetails.caseNumber,
      relevantSections: caseLawDetails.relevantSections,
    })
    .from(posts)
    .leftJoin(postStats, eq(postStats.postId, posts.id))
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .innerJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .leftJoin(insightDetails, eq(insightDetails.postId, posts.id))
    .leftJoin(user, eq(user.id, insightDetails.authorId))
    .where(and(isLive, eq(posts.type, "case_law"), eq(posts.slug, slug)))
    .limit(1);
  if (!row) return null;

  cacheTag(postTag(row.id));
  const card = toCard(row, new Date());
  if (!card.caseLaw) return null;
  return {
    ...card,
    caseLaw: { ...card.caseLaw, bench: row.bench ?? "", caseNumber: row.caseNumber ?? "", relevantSections: row.relevantSections ?? "" },
  };
}

export type CaseBody = { background: string; decision: string };

/**
 * GATED text. Call only after verifying a session — the result is shared
 * between members, so it is cached by post id, never by user.
 */
export async function getCaseBody(postId: string): Promise<CaseBody | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.posts, postTag(postId));

  const [row] = await db
    .select({ background: caseLawDetails.background, decision: caseLawDetails.decision })
    .from(caseLawDetails)
    .innerJoin(posts, eq(posts.id, caseLawDetails.postId))
    .where(and(isLive, eq(caseLawDetails.postId, postId)))
    .limit(1);
  return row ?? null;
}

/** Other rulings on the same topic or the same sections, newest first. */
export async function getRelatedCases(postId: string, limit = 4): Promise<PostCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts, postTag(postId));

  const [self] = await db
    .select({ topicId: posts.topicId, sectionRefs: caseLawDetails.sectionRefs })
    .from(posts)
    .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .where(eq(posts.id, postId))
    .limit(1);
  if (!self) return [];

  const refs = self.sectionRefs.slice(0, 6);
  const overlap = refs.length > 0 ? sql`${caseLawDetails.sectionRefs} && ARRAY[${sql.join(refs.map((r) => sql`${r}`), sql`, `)}]::text[]` : undefined;
  const sameTopic = self.topicId ? eq(posts.topicId, self.topicId) : undefined;
  if (!overlap && !sameTopic) return [];

  // Rank: shares both topic and a section, then either one; newest first.
  const score = sql<number>`(${sameTopic ? sql`(${sameTopic})::int` : sql`0`}) + (${overlap ? sql`(${overlap})::int` : sql`0`})`;
  const rows = await cardQuery()
    .where(and(isLive, eq(posts.type, "case_law"), ne(posts.id, postId), or(sameTopic, overlap)))
    .orderBy(desc(score), desc(recency))
    .limit(limit);
  const now = new Date();
  return rows.map((row) => toCard(row, now));
}

/** If a slug was renamed, the slug it now lives at. */
export async function resolveOldSlug(slug: string): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.posts);

  const [row] = await db
    .select({ slug: posts.slug })
    .from(slugHistory)
    .innerJoin(posts, eq(posts.id, slugHistory.postId))
    .where(and(eq(slugHistory.oldSlug, slug), isLive))
    .limit(1);
  return row?.slug ?? null;
}

/** Slugs to prerender at build time; everything else renders on first visit. */
export async function getLatestSlugs(type: "case_law" | "insight", limit: number): Promise<string[]> {
  const rows = await db
    .select({ slug: posts.slug })
    .from(posts)
    .leftJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .where(and(isLive, eq(posts.type, type)))
    .orderBy(desc(recency))
    .limit(limit);
  return rows.map((r) => r.slug);
}

/* ------------------------------- Taxonomy --------------------------------- */

export async function getTopicBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.taxonomy);

  const [row] = await db
    .select({ id: topics.id, name: topics.name, slug: topics.slug, description: topics.description })
    .from(topics)
    .where(and(eq(topics.slug, slug), eq(topics.reviewed, true)))
    .limit(1);
  return row ?? null;
}

export async function getCourtBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.taxonomy);

  const [row] = await db
    .select({
      id: courts.id,
      name: courts.name,
      shortName: courts.shortName,
      slug: courts.slug,
      type: courts.type,
      location: courts.location,
      description: courts.description,
    })
    .from(courts)
    .where(eq(courts.slug, slug))
    .limit(1);
  return row ?? null;
}

/* ------------------------------- Site stats ------------------------------- */

export type SiteStats = {
  rulings: number;
  courts: number;
  topics: number;
  insights: number;
  /** Share of rulings decided for the assessee (including remands), 0–100. */
  assesseeShare: number;
  latestDecision: string | null;
};

export async function getSiteStats(): Promise<SiteStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.stats, TAGS.posts);

  const facets = await getDirectoryFacets();
  const [insightRow] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(isLive, eq(posts.type, "insight")));
  const decided = facets.outcomes.assessee + facets.outcomes.revenue + facets.outcomes.partly;
  return {
    rulings: facets.total,
    courts: facets.courts.length,
    topics: facets.topics.length,
    insights: insightRow?.n ?? 0,
    assesseeShare: decided > 0 ? Math.round((facets.outcomes.assessee / decided) * 100) : 0,
    latestDecision: facets.dateRange?.to ?? null,
  };
}

/* --------------------------------- Sitemap -------------------------------- */

export async function getSitemapPosts(): Promise<{ type: "case_law" | "insight"; slug: string; updatedAt: Date }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts);

  return db
    .select({ type: posts.type, slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(isLive)
    .orderBy(desc(posts.updatedAt))
    .limit(45_000);
}

/* -------------------------------- Trending -------------------------------- */

export type Trending = {
  posts: PostCard[];
  /** False while there is no engagement yet: the list is then simply the newest posts. */
  hasSignal: boolean;
};

/*
 * Engagement in the last 7 days, each event decaying with a 2-day half-life:
 *   view 1 · like 4 · save 5 · comment 6 · share 8
 * Shares count once per person per day, so one enthusiastic sharer cannot
 * push a post up the list. With no engagement the order falls back to recency.
 */
export async function getTrendingPosts(limit = 8): Promise<Trending> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.trending, TAGS.posts);

  const decay = (column: SQL) => sql`power(0.5, extract(epoch from (now() - ${column})) / 172800.0)`;
  const scored = await db.execute<{ id: string; score: number }>(sql`
    WITH likes AS (
      SELECT post_id, sum(${decay(sql`created_at`)}) AS s FROM post_likes
      WHERE created_at > now() - interval '7 days' GROUP BY post_id
    ), saves AS (
      SELECT post_id, sum(${decay(sql`created_at`)}) AS s FROM post_saves
      WHERE created_at > now() - interval '7 days' GROUP BY post_id
    ), talk AS (
      SELECT post_id, sum(${decay(sql`created_at`)}) AS s FROM comments
      WHERE created_at > now() - interval '7 days' AND status = 'visible' GROUP BY post_id
    ), shares AS (
      SELECT post_id, sum(${decay(sql`first_at`)}) AS s FROM (
        SELECT post_id, min(created_at) AS first_at FROM share_events
        WHERE created_at > now() - interval '7 days'
        GROUP BY post_id, coalesce(user_id, visitor_hash, id::text), created_at::date
      ) once GROUP BY post_id
    ), views AS (
      SELECT post_id, sum(views * power(0.5, (current_date - day) / 2.0)) AS s FROM post_views_daily
      WHERE day >= current_date - 7 GROUP BY post_id
    )
    SELECT p.id,
           (coalesce(views.s, 0) + 4 * coalesce(likes.s, 0) + 5 * coalesce(saves.s, 0)
             + 6 * coalesce(talk.s, 0) + 8 * coalesce(shares.s, 0))::float8 AS score
    FROM posts p
    LEFT JOIN case_law_details c ON c.post_id = p.id
    LEFT JOIN likes ON likes.post_id = p.id
    LEFT JOIN saves ON saves.post_id = p.id
    LEFT JOIN talk ON talk.post_id = p.id
    LEFT JOIN shares ON shares.post_id = p.id
    LEFT JOIN views ON views.post_id = p.id
    WHERE p.status = 'published' AND p.published_at <= now()
    ORDER BY score DESC, coalesce(c.decision_date::timestamptz, p.published_at) DESC, p.id
    LIMIT ${limit}
  `);

  const ranked = scored.rows.map((row) => ({ id: row.id, score: Number(row.score) }));
  if (ranked.length === 0) return { posts: [], hasSignal: false };

  const rows = await cardQuery().where(inArray(posts.id, ranked.map((r) => r.id)));
  const now = new Date();
  const byId = new Map(rows.map((row) => [row.id, toCard(row, now)]));
  return {
    posts: ranked.flatMap((r) => byId.get(r.id) ?? []),
    hasSignal: ranked.some((r) => r.score > 0),
  };
}

/**
 * Counters for one post, read at request time. Post pages are cached until
 * the post is edited; their counts stream in fresh with each request (see
 * `LivePostActions`). Call inside a <Suspense> boundary.
 */
export async function getLivePostStats(postId: string): Promise<PostCard["stats"]> {
  await connection();
  const [row] = await db.select().from(postStats).where(eq(postStats.postId, postId)).limit(1);
  return {
    likes: row?.likeCount ?? 0,
    comments: row?.commentCount ?? 0,
    saves: row?.saveCount ?? 0,
    shares: row?.shareCount ?? 0,
    views: row?.viewCount ?? 0,
  };
}

/** Cards for specific posts, returned in the order given. */
export async function getPostCards(ids: string[]): Promise<PostCard[]> {
  if (ids.length === 0) return [];
  const rows = await cardQuery().where(and(isLive, inArray(posts.id, ids)));
  const now = new Date();
  const byId = new Map(rows.map((row) => [row.id, toCard(row, now)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
