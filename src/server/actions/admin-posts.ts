"use server";

import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/server/audit";
import { guard } from "@/server/auth/guard";
import { postTag, TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { caseLawDetails, courts, postRevisions, postStats, posts, slugHistory, topics } from "@/server/db/schema";
import { normalizeCourt } from "@/server/import/courts";
import { similarityKeyOf, sourceKeyOf } from "@/server/import/normalize";
import { parseSectionRefs } from "@/server/import/sections";
import { cleanText, sha256, slugify } from "@/server/import/text";
import { refreshSearchVectors } from "@/server/search/vectors";

/*
 * Admin writes to case laws. Every change is audited, snapshots the previous
 * version, refreshes the search documents and expires the cached public pages.
 */

const DOMAINS = ["gst", "income_tax", "customs", "excise", "service_tax", "vat", "ibc", "other"] as const;
const OUTCOMES = ["assessee", "revenue", "partly", "unknown"] as const;

const caseSchema = z.object({
  id: z.uuid().nullable(),
  title: z.string().trim().min(3, "Enter the case name.").max(400),
  slug: z.string().trim().max(120),
  status: z.enum(["draft", "published", "archived"]),
  courtId: z.uuid({ error: "Choose the court or authority." }),
  bench: z.string().trim().max(400),
  decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the decision date."),
  caseNumber: z.string().trim().max(400),
  relevantSections: z.string().trim().max(6000),
  excerpt: z.string().trim().min(20, "Write the public summary (at least 20 characters).").max(8000),
  /** null means "unchanged" — the stored text is kept exactly as it is. */
  background: z.string().max(30000).nullable(),
  decision: z.string().max(30000).nullable(),
  outcomeSide: z.enum(OUTCOMES),
  remanded: z.boolean(),
  topicId: z.uuid().nullable(),
  domain: z.enum(DOMAINS),
  domainLabel: z.string().trim().max(60),
  lockFromImports: z.boolean(),
});

export type CaseInput = z.input<typeof caseSchema>;

/** Source-style outcome text, so exports re-import to the same outcome. */
function outcomeText(side: (typeof OUTCOMES)[number], remanded: boolean): string {
  const base =
    side === "assessee" ? "In favour of assessee" : side === "revenue" ? "In favour of revenue" : side === "partly" ? "Partly in favour of assessee" : "";
  if (!base) return remanded ? "Matter remanded" : "";
  return remanded ? `${base}/Matter remanded` : base;
}

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return value >= "1950-01-01" && date.getTime() <= Date.now() + 2 * 86_400_000;
}

async function uniqueSlug(base: string, excludeId: string | null): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(excludeId ? and(eq(posts.slug, candidate), ne(posts.id, excludeId)) : eq(posts.slug, candidate))
      .limit(1);
    const [old] = await db.select({ postId: slugHistory.postId }).from(slugHistory).where(eq(slugHistory.oldSlug, candidate)).limit(1);
    if (!taken && (!old || old.postId === excludeId)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function expirePublicPages(ids: string[], slugs: string[]) {
  updateTag(TAGS.posts);
  updateTag(TAGS.trending);
  updateTag(TAGS.stats);
  for (const key of [...new Set([...ids, ...slugs])].slice(0, 120)) updateTag(postTag(key));
}

export async function saveCaseLaw(input: CaseInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const { viewer } = auth;

  const parsed = caseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.", "invalid");
  const data = parsed.data;
  if (!validDate(data.decisionDate)) return fail("The decision date is not valid.", "invalid");

  const [court] = await db.select({ id: courts.id, name: courts.name }).from(courts).where(eq(courts.id, data.courtId)).limit(1);
  if (!court) return fail("That court no longer exists. Choose another.", "invalid");
  if (data.topicId) {
    const [topic] = await db.select({ id: topics.id }).from(topics).where(eq(topics.id, data.topicId)).limit(1);
    if (!topic) return fail("That topic no longer exists. Choose another.", "invalid");
  }

  const title = cleanText(data.title);
  const excerpt = cleanText(data.excerpt);
  const relevantSections = cleanText(data.relevantSections);
  const caseNumber = cleanText(data.caseNumber);
  const bench = cleanText(data.bench);
  const background = data.background === null ? null : cleanText(data.background);
  const decision = data.decision === null ? null : cleanText(data.decision);
  const slug = await uniqueSlug(slugify(data.slug || `${slugify(title, 72)}-${data.decisionDate}`, 110) || "ruling", data.id);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    if (!data.id) {
      const rawKey = normalizeCourt(court.name)?.rawKey ?? court.name.toUpperCase();
      const sourceKey = sourceKeyOf(title, data.decisionDate, rawKey, caseNumber);
      const [duplicate] = await tx.select({ postId: caseLawDetails.postId }).from(caseLawDetails).where(eq(caseLawDetails.sourceKey, sourceKey)).limit(1);
      if (duplicate) return { error: "A ruling with the same parties, court, date and case number already exists." } as const;

      const [created] = await tx
        .insert(posts)
        .values({
          type: "case_law",
          slug,
          title,
          excerpt,
          status: data.status,
          publishedAt: data.status === "published" ? now : null,
          topicId: data.topicId,
          domain: data.domain,
          createdBy: viewer.id,
        })
        .returning({ id: posts.id });
      const id = created!.id;
      await tx.insert(caseLawDetails).values({
        postId: id,
        courtId: court.id,
        courtRaw: court.name,
        bench,
        decisionDate: data.decisionDate,
        caseNumber,
        relevantSections,
        sectionRefs: parseSectionRefs(relevantSections),
        background: background ?? "",
        decision: decision ?? "",
        outcomeSide: data.outcomeSide,
        remanded: data.remanded,
        outcomeRaw: outcomeText(data.outcomeSide, data.remanded),
        domainLabel: cleanText(data.domainLabel),
        sourceKey,
        similarityKey: similarityKeyOf(title, data.decisionDate, rawKey),
        contentHash: sha256(JSON.stringify([title, court.id, bench, data.decisionDate, caseNumber, relevantSections, background, decision, excerpt])),
        // Hand-written rulings are never overwritten by an import of the same case.
        manuallyEditedAt: now,
      });
      await tx.insert(postStats).values({ postId: id }).onConflictDoNothing();
      await refreshSearchVectors(tx, [id]);
      await writeAudit(tx, { actorId: viewer.id, action: "case.create", entityType: "post", entityId: id, summary: `Added ruling “${title}” (${data.status})` });
      return { id, slug, previousSlug: null };
    }

    const [existing] = await tx
      .select({ post: posts, detail: caseLawDetails })
      .from(posts)
      .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
      .where(and(eq(posts.id, data.id), eq(posts.type, "case_law")))
      .limit(1);
    if (!existing) return { error: "This ruling no longer exists." } as const;
    const { post, detail } = existing;

    const changed: string[] = [];
    const differs = (field: string, before: unknown, after: unknown) => {
      if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(field);
    };
    differs("title", post.title, title);
    differs("slug", post.slug, slug);
    differs("summary", post.excerpt, excerpt);
    differs("status", post.status, data.status);
    differs("topic", post.topicId, data.topicId);
    differs("domain", post.domain, data.domain);
    differs("court", detail.courtId, court.id);
    differs("bench", detail.bench, bench);
    differs("decisionDate", detail.decisionDate, data.decisionDate);
    differs("caseNumber", detail.caseNumber, caseNumber);
    differs("sections", detail.relevantSections, relevantSections);
    if (background !== null) differs("background", detail.background, background);
    if (decision !== null) differs("decision", detail.decision, decision);
    differs("outcome", [detail.outcomeSide, detail.remanded], [data.outcomeSide, data.remanded]);
    differs("domainLabel", detail.domainLabel, cleanText(data.domainLabel));
    const contentChanged = changed.some((f) => f !== "status");
    // Protected rulings are skipped by imports unless the admin chooses to overwrite them.
    const locked = data.lockFromImports ? (contentChanged ? now : (detail.manuallyEditedAt ?? now)) : null;
    differs("importLock", detail.manuallyEditedAt !== null, locked !== null);

    if (changed.length === 0) return { id: post.id, slug: post.slug, previousSlug: null, unchanged: true };

    await tx.insert(postRevisions).values({
      postId: post.id,
      reason: "edit",
      actorId: viewer.id,
      snapshot: { title: post.title, slug: post.slug, excerpt: post.excerpt, status: post.status, topicId: post.topicId, domain: post.domain, detail: { ...detail, postId: undefined } },
    });
    if (post.slug !== slug) {
      await tx.delete(slugHistory).where(and(eq(slugHistory.oldSlug, slug), eq(slugHistory.postId, post.id)));
      await tx.insert(slugHistory).values({ oldSlug: post.slug, postId: post.id }).onConflictDoNothing();
    }
    await tx
      .update(posts)
      .set({
        title,
        slug,
        excerpt,
        status: data.status,
        publishedAt: data.status === "published" ? (post.publishedAt ?? now) : post.publishedAt,
        topicId: data.topicId,
        domain: data.domain,
      })
      .where(eq(posts.id, post.id));
    const outcomeChanged = detail.outcomeSide !== data.outcomeSide || detail.remanded !== data.remanded;
    await tx
      .update(caseLawDetails)
      .set({
        courtId: court.id,
        courtRaw: detail.courtId === court.id ? detail.courtRaw : court.name,
        bench,
        decisionDate: data.decisionDate,
        caseNumber,
        relevantSections,
        sectionRefs: relevantSections === detail.relevantSections ? detail.sectionRefs : parseSectionRefs(relevantSections),
        ...(background !== null ? { background } : {}),
        ...(decision !== null ? { decision } : {}),
        outcomeSide: data.outcomeSide,
        remanded: data.remanded,
        outcomeRaw: outcomeChanged ? outcomeText(data.outcomeSide, data.remanded) : detail.outcomeRaw,
        domainLabel: cleanText(data.domainLabel),
        // The content hash keeps describing the last imported version, so
        // re-uploading the same file still reports these cases as unchanged.
        manuallyEditedAt: locked,
      })
      .where(eq(caseLawDetails.postId, post.id));
    await refreshSearchVectors(tx, [post.id]);
    await writeAudit(tx, {
      actorId: viewer.id,
      action: "case.update",
      entityType: "post",
      entityId: post.id,
      summary: `Edited “${title}”: ${changed.join(", ")}`,
      meta: { fields: changed },
    });
    return { id: post.id, slug, previousSlug: post.slug };
  });

  if ("error" in result) return fail(result.error ?? "This ruling could not be saved.", "invalid");
  expirePublicPages([result.id], [result.slug, ...(result.previousSlug ? [result.previousSlug] : [])]);
  return ok({ id: result.id, slug: result.slug });
}

const bulkSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Select at least one post.").max(200, "Select at most 200 posts at a time."),
  action: z.enum(["publish", "unpublish", "archive", "delete", "feature", "unfeature"]),
});

const BULK_VERB = {
  publish: "Published",
  unpublish: "Unpublished",
  archive: "Archived",
  delete: "Deleted",
  feature: "Featured",
  unfeature: "Removed from featured",
} as const;

/** Publish, unpublish, archive, delete or feature many posts at once. */
export async function bulkPostAction(input: { ids: string[]; action: string }): Promise<ActionResult<{ count: number }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Nothing was selected.", "invalid");
  const { ids, action } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const targets = await tx.select({ id: posts.id, slug: posts.slug, title: posts.title, boostRank: posts.boostRank }).from(posts).where(inArray(posts.id, ids));
    if (targets.length === 0) return null;
    const found = targets.map((t) => t.id);

    switch (action) {
      case "publish":
        await tx
          .update(posts)
          .set({ status: "published", publishedAt: sql`coalesce(${posts.publishedAt}, now())` })
          .where(and(inArray(posts.id, found), ne(posts.status, "published")));
        break;
      case "unpublish":
        await tx.update(posts).set({ status: "draft" }).where(inArray(posts.id, found));
        break;
      case "archive":
        await tx.update(posts).set({ status: "archived" }).where(inArray(posts.id, found));
        break;
      case "delete":
        // Comments, likes, saves, stats, revisions and old slugs go with the posts.
        await tx.delete(posts).where(inArray(posts.id, found));
        break;
      case "feature": {
        const [top] = await tx.select({ max: sql<number>`coalesce(max(${posts.boostRank}), 0)` }).from(posts);
        let rank = Number(top?.max ?? 0);
        for (const target of targets) {
          if (target.boostRank !== null) continue;
          rank += 1;
          await tx.update(posts).set({ boostRank: rank, boostUntil: null }).where(eq(posts.id, target.id));
        }
        break;
      }
      case "unfeature":
        await tx.update(posts).set({ boostRank: null, boostUntil: null, editorNote: null }).where(inArray(posts.id, found));
        await renumberFeatured(tx);
        break;
    }

    const names = targets.slice(0, 3).map((t) => `“${t.title}”`).join(", ");
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: `post.bulk_${action}`,
      entityType: "post",
      entityId: targets.length === 1 ? targets[0]!.id : null,
      summary: `${BULK_VERB[action]} ${targets.length === 1 ? names : `${targets.length} posts (${names}${targets.length > 3 ? ", …" : ""})`}`,
      meta: { ids: found },
    });
    return targets;
  });

  if (!outcome) return fail("None of the selected posts exist any more.", "not_found");
  expirePublicPages(
    outcome.map((t) => t.id),
    outcome.map((t) => t.slug),
  );
  return ok({ count: outcome.length });
}

/** Keeps featured ranks 1…n with no gaps. */
async function renumberFeatured(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  await tx.execute(sql`
    UPDATE posts p SET boost_rank = r.rank
    FROM (SELECT id, row_number() OVER (ORDER BY boost_rank, id) AS rank FROM posts WHERE boost_rank IS NOT NULL) r
    WHERE p.id = r.id AND p.boost_rank IS DISTINCT FROM r.rank
  `);
}
