import "server-only";

import { and, count, desc, eq, or, sql, type SQL } from "drizzle-orm";

import type { CourtType, OutcomeSide } from "@/lib/labels";
import { db } from "@/server/db";
import { auditLog, caseLawDetails, courts, importBatches, postStats, posts, topics, user } from "@/server/db/schema";

export type PostPick = {
  id: string;
  slug: string;
  type: "case_law" | "insight";
  title: string;
  status: "draft" | "scheduled" | "published" | "archived";
  court: string | null;
  decisionDate: string | null;
};

/**
 * Finds posts by title, slug or link for admin pickers (embedding a ruling,
 * featuring a post). Callers must have checked the role. Public fields only.
 */
export async function pickPosts(query: string, options: { type?: "case_law" | "insight"; limit?: number } = {}): Promise<PostPick[]> {
  const q = query.trim().slice(0, 160);
  if (q.length < 2) return [];

  // A pasted link or path: match on its last segment.
  const tail = q.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
  const slug = /^[a-z0-9-]{3,160}$/.test(tail) ? tail : null;
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const matches: SQL[] = [sql`${posts.title} ilike ${pattern}`, sql`${posts.searchPublic} @@ websearch_to_tsquery('english', ${q})`];
  if (slug) matches.push(eq(posts.slug, slug));
  const where = and(options.type ? eq(posts.type, options.type) : undefined, sql`(${sql.join(matches, sql` or `)})`);

  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      type: posts.type,
      title: posts.title,
      status: posts.status,
      court: courts.shortName,
      decisionDate: caseLawDetails.decisionDate,
    })
    .from(posts)
    .leftJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .leftJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .where(where)
    .orderBy(
      // An exact link match first, then titles containing the words as typed, then the closest titles.
      ...(slug ? [sql`(${posts.slug} = ${slug}) desc`] : []),
      sql`(${posts.title} ilike ${pattern}) desc`,
      sql`similarity(${posts.title}, ${q}) desc`,
      desc(posts.publishedAt),
    )
    .limit(Math.min(options.limit ?? 8, 20));
}

/* ------------------------------- Case laws -------------------------------- */

export const ADMIN_CASES_PAGE_SIZE = 40;
export const CASE_STATUSES = ["published", "draft", "archived"] as const;
export const CASE_SORTS = ["decided", "updated", "views", "comments"] as const;
export const CASE_FLAGS = ["featured", "edited", "unreviewed_topic", "no_topic", "unknown_outcome"] as const;

export type AdminCaseFilters = {
  q?: string;
  status?: (typeof CASE_STATUSES)[number];
  forum?: CourtType;
  topic?: string;
  flag?: (typeof CASE_FLAGS)[number];
  batch?: string;
  sort?: (typeof CASE_SORTS)[number];
};

export type AdminCaseRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "scheduled" | "published" | "archived";
  updatedAt: Date;
  decisionDate: string;
  court: string;
  topic: string | null;
  topicReviewed: boolean;
  outcomeSide: OutcomeSide;
  remanded: boolean;
  featured: boolean;
  edited: boolean;
  views: number;
  likes: number;
  comments: number;
};

function caseWhere(filters: AdminCaseFilters) {
  const conditions: (SQL | undefined)[] = [eq(posts.type, "case_law")];
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const tail = q.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
    conditions.push(
      or(
        sql`${posts.title} ilike ${pattern}`,
        sql`${caseLawDetails.caseNumber} ilike ${pattern}`,
        eq(posts.slug, tail),
        /^[0-9a-f-]{36}$/i.test(q) ? eq(posts.id, q) : undefined,
      ),
    );
  }
  if (filters.status) conditions.push(eq(posts.status, filters.status));
  if (filters.forum) conditions.push(eq(courts.type, filters.forum));
  if (filters.topic) conditions.push(eq(posts.topicId, filters.topic));
  if (filters.flag === "featured") conditions.push(sql`${posts.boostRank} is not null`);
  if (filters.flag === "edited") conditions.push(sql`${caseLawDetails.manuallyEditedAt} is not null`);
  if (filters.flag === "unreviewed_topic") conditions.push(eq(topics.reviewed, false));
  if (filters.flag === "no_topic") conditions.push(sql`${posts.topicId} is null`);
  if (filters.flag === "unknown_outcome") conditions.push(and(eq(caseLawDetails.outcomeSide, "unknown"), eq(caseLawDetails.remanded, false)));
  if (filters.batch) conditions.push(eq(caseLawDetails.importBatchId, filters.batch));
  return and(...conditions);
}

/** The case-law table in the admin. Callers must have checked the admin role. */
export async function listCasesAdmin(filters: AdminCaseFilters, page: number): Promise<{ rows: AdminCaseRow[]; total: number }> {
  const where = caseWhere(filters);
  const order =
    filters.sort === "updated"
      ? [desc(posts.updatedAt)]
      : filters.sort === "views"
        ? [desc(sql`coalesce(${postStats.viewCount}, 0)`)]
        : filters.sort === "comments"
          ? [desc(sql`coalesce(${postStats.commentCount}, 0)`)]
          : [desc(caseLawDetails.decisionDate)];

  const [totalRow] = await db
    .select({ n: count() })
    .from(posts)
    .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .innerJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .where(where);
  const rows = await db
    .select({
    id: posts.id,
    slug: posts.slug,
    title: posts.title,
    status: posts.status,
    updatedAt: posts.updatedAt,
    decisionDate: caseLawDetails.decisionDate,
    court: courts.shortName,
    topic: topics.name,
    topicReviewed: topics.reviewed,
    outcomeSide: caseLawDetails.outcomeSide,
    remanded: caseLawDetails.remanded,
    boostRank: posts.boostRank,
    editedAt: caseLawDetails.manuallyEditedAt,
    views: postStats.viewCount,
    likes: postStats.likeCount,
    comments: postStats.commentCount,
  })
    .from(posts)
    .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .innerJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .leftJoin(postStats, eq(postStats.postId, posts.id))
    .where(where)
    .orderBy(...order, desc(posts.createdAt), posts.id)
    .limit(ADMIN_CASES_PAGE_SIZE)
    .offset((page - 1) * ADMIN_CASES_PAGE_SIZE);

  return {
    total: totalRow?.n ?? 0,
    rows: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt,
      decisionDate: row.decisionDate,
      court: row.court,
      topic: row.topic,
      topicReviewed: row.topicReviewed ?? false,
      outcomeSide: row.outcomeSide,
      remanded: row.remanded,
      featured: row.boostRank !== null,
      edited: row.editedAt !== null,
      views: row.views ?? 0,
      likes: row.likes ?? 0,
      comments: row.comments ?? 0,
    })),
  };
}

/** Case laws per status, for the tabs above the table. */
export async function countCasesByStatus(): Promise<Record<"all" | (typeof CASE_STATUSES)[number], number>> {
  const rows = await db.select({ status: posts.status, n: count() }).from(posts).where(eq(posts.type, "case_law")).groupBy(posts.status);
  const result = { all: 0, published: 0, draft: 0, archived: 0 };
  for (const row of rows) {
    result.all += row.n;
    if (row.status in result) result[row.status as keyof typeof result] += row.n;
  }
  return result;
}

/**
 * Rows for the round-trip spreadsheet export: the same columns as the import
 * template plus the TaxKatha ID, which lets a re-upload update these cases.
 * Includes GATED text — admin only.
 */
export async function exportCasesAdmin(filters: AdminCaseFilters, limit = 5000) {
  return db
    .select({
    id: posts.id,
    title: posts.title,
    excerpt: posts.excerpt,
    courtRaw: caseLawDetails.courtRaw,
    bench: caseLawDetails.bench,
    decisionDate: caseLawDetails.decisionDate,
    caseNumber: caseLawDetails.caseNumber,
    relevantSections: caseLawDetails.relevantSections,
    background: caseLawDetails.background,
    decision: caseLawDetails.decision,
    outcomeRaw: caseLawDetails.outcomeRaw,
    outcomeSide: caseLawDetails.outcomeSide,
    remanded: caseLawDetails.remanded,
    domainLabel: caseLawDetails.domainLabel,
  })
    .from(posts)
    .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .innerJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .where(caseWhere(filters))
    .orderBy(desc(caseLawDetails.decisionDate), posts.id)
    .limit(limit);
}

/** Everything about one case for the editor, including GATED text. Admin only. */
export async function getCaseForEdit(id: string) {
  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      createdAt: posts.createdAt,
      topicId: posts.topicId,
      domain: posts.domain,
      boostRank: posts.boostRank,
      courtId: caseLawDetails.courtId,
      courtRaw: caseLawDetails.courtRaw,
      bench: caseLawDetails.bench,
      decisionDate: caseLawDetails.decisionDate,
      caseNumber: caseLawDetails.caseNumber,
      relevantSections: caseLawDetails.relevantSections,
      sectionRefs: caseLawDetails.sectionRefs,
      background: caseLawDetails.background,
      decision: caseLawDetails.decision,
      outcomeSide: caseLawDetails.outcomeSide,
      remanded: caseLawDetails.remanded,
      outcomeRaw: caseLawDetails.outcomeRaw,
      domainLabel: caseLawDetails.domainLabel,
      manuallyEditedAt: caseLawDetails.manuallyEditedAt,
      importBatchId: caseLawDetails.importBatchId,
      importFilename: importBatches.filename,
      importedAt: importBatches.committedAt,
      views: postStats.viewCount,
      likes: postStats.likeCount,
      comments: postStats.commentCount,
      saves: postStats.saveCount,
      shares: postStats.shareCount,
    })
    .from(posts)
    .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .leftJoin(importBatches, eq(importBatches.id, caseLawDetails.importBatchId))
    .leftJoin(postStats, eq(postStats.postId, posts.id))
    .where(and(eq(posts.id, id), eq(posts.type, "case_law")))
    .limit(1);
  return row ?? null;
}

/** Recent changes to a post: revisions taken before edits and imports, and audit entries. */
export async function getPostHistory(postId: string, limit = 12) {
  return db
    .select({ id: auditLog.id, action: auditLog.action, summary: auditLog.summary, createdAt: auditLog.createdAt, actor: user.name })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(or(and(eq(auditLog.entityType, "post"), eq(auditLog.entityId, postId)), sql`${auditLog.meta} -> 'ids' ? ${postId}`))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

export async function listCourtOptions() {
  return db.select({ id: courts.id, name: courts.name, shortName: courts.shortName, type: courts.type }).from(courts).orderBy(courts.type, courts.name);
}

export async function listAllTopicOptions() {
  return db.select({ id: topics.id, name: topics.name, reviewed: topics.reviewed }).from(topics).orderBy(desc(topics.reviewed), topics.name);
}

/* -------------------------------- Featured -------------------------------- */

export type FeaturedRow = {
  id: string;
  slug: string;
  type: "case_law" | "insight";
  title: string;
  /** Published and past its publication time. */
  live: boolean;
  /** The end date has passed. */
  expired: boolean;
  boostRank: number;
  /** Last featured day in India time (YYYY-MM-DD), or null. */
  until: string | null;
  editorNote: string | null;
  court: string | null;
  decisionDate: string | null;
};

/** Every boosted post in the admin's order, including expired and unpublished ones. */
export async function listFeaturedAdmin(): Promise<FeaturedRow[]> {
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      type: posts.type,
      title: posts.title,
      live: sql<boolean>`(${posts.status} = 'published' and ${posts.publishedAt} <= now())`,
      expired: sql<boolean>`coalesce(${posts.boostUntil} < now(), false)`,
      boostRank: posts.boostRank,
      until: sql<string | null>`to_char(${posts.boostUntil} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
      editorNote: posts.editorNote,
      court: courts.shortName,
      decisionDate: caseLawDetails.decisionDate,
    })
    .from(posts)
    .leftJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
    .leftJoin(courts, eq(courts.id, caseLawDetails.courtId))
    .where(sql`${posts.boostRank} is not null`)
    .orderBy(posts.boostRank, posts.id);
  return rows.map((row) => ({ ...row, boostRank: row.boostRank ?? 0 }));
}
