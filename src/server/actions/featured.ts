"use server";

import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/server/audit";
import { guard } from "@/server/auth/guard";
import { postTag, TAGS } from "@/server/cache-tags";
import { db, type DbOrTx } from "@/server/db";
import { posts } from "@/server/db/schema";

/*
 * Featured ("boosted") posts: shown first on the home page and in the
 * directory, in the order set here. Ranks are kept as 1…n.
 */

function expire(postIds: string[]) {
  updateTag(TAGS.posts);
  updateTag(TAGS.trending);
  for (const id of postIds) updateTag(postTag(id));
}

async function renumber(conn: DbOrTx) {
  await conn.execute(sql`
    UPDATE posts p SET boost_rank = r.rank
    FROM (SELECT id, row_number() OVER (ORDER BY boost_rank, id) AS rank FROM posts WHERE boost_rank IS NOT NULL) r
    WHERE p.id = r.id AND p.boost_rank IS DISTINCT FROM r.rank
  `);
}

export async function featurePost(postId: string): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  if (!z.uuid().safeParse(postId).success) return fail("Unknown post.", "invalid");

  const outcome = await db.transaction(async (tx) => {
    const [post] = await tx.select({ id: posts.id, title: posts.title, boostRank: posts.boostRank }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return "missing" as const;
    if (post.boostRank !== null) return "already" as const;
    const [top] = await tx.select({ max: sql<number>`coalesce(max(${posts.boostRank}), 0)` }).from(posts);
    await tx.update(posts).set({ boostRank: Number(top?.max ?? 0) + 1, boostUntil: null }).where(eq(posts.id, postId));
    await writeAudit(tx, { actorId: auth.viewer.id, action: "featured.add", entityType: "post", entityId: postId, summary: `Featured “${post.title}”` });
    return "ok" as const;
  });

  if (outcome === "missing") return fail("That post no longer exists.", "not_found");
  expire([postId]);
  return ok(undefined);
}

const updateSchema = z.object({
  postId: z.uuid(),
  /** Last day the post stays featured (inclusive, India time), or null for no end. */
  until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  note: z.string().trim().max(140, "Keep the note under 140 characters."),
});

export async function updateFeature(input: { postId: string; until: string | null; note: string }): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details.", "invalid");
  const { postId, until, note } = parsed.data;

  const boostUntil = until ? new Date(`${until}T23:59:59+05:30`) : null;
  if (boostUntil && boostUntil.getTime() < Date.now()) return fail("Choose an end date that is today or later.", "invalid");

  const [post] = await db
    .update(posts)
    .set({ boostUntil, editorNote: note || null })
    .where(and(eq(posts.id, postId), sql`${posts.boostRank} is not null`))
    .returning({ title: posts.title });
  if (!post) return fail("That post is no longer featured.", "not_found");
  await writeAudit(db, {
    actorId: auth.viewer.id,
    action: "featured.update",
    entityType: "post",
    entityId: postId,
    summary: `Updated featured “${post.title}”: ${until ? `until ${until}` : "no end date"}${note ? `, note “${note}”` : ""}`,
  });
  expire([postId]);
  return ok(undefined);
}

export async function reorderFeatured(ids: string[]): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = z.array(z.uuid()).max(100).safeParse(ids);
  if (!parsed.success) return fail("The new order could not be read.", "invalid");

  const outcome = await db.transaction(async (tx) => {
    const current = await tx.select({ id: posts.id }).from(posts).where(sql`${posts.boostRank} is not null`);
    const known = new Set(current.map((row) => row.id));
    // The list changed in another tab: refuse rather than drop or invent entries.
    if (known.size !== parsed.data.length || parsed.data.some((id) => !known.has(id))) return false;
    for (const [index, id] of parsed.data.entries()) {
      await tx.update(posts).set({ boostRank: index + 1 }).where(eq(posts.id, id));
    }
    await writeAudit(tx, { actorId: auth.viewer.id, action: "featured.reorder", entityType: "post", summary: "Reordered featured posts", meta: { ids: parsed.data } });
    return true;
  });

  if (!outcome) return fail("The featured list changed while you were editing. Reload the page and try again.", "invalid");
  expire([]);
  return ok(undefined);
}

export async function unfeaturePost(postId: string): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  if (!z.uuid().safeParse(postId).success) return fail("Unknown post.", "invalid");

  const removed = await db.transaction(async (tx) => {
    const [post] = await tx
      .update(posts)
      .set({ boostRank: null, boostUntil: null, editorNote: null })
      .where(and(eq(posts.id, postId), sql`${posts.boostRank} is not null`))
      .returning({ title: posts.title });
    if (!post) return null;
    await renumber(tx);
    await writeAudit(tx, { actorId: auth.viewer.id, action: "featured.remove", entityType: "post", entityId: postId, summary: `Removed “${post.title}” from featured` });
    return post;
  });

  if (!removed) return fail("That post is no longer featured.", "not_found");
  expire([postId]);
  return ok(undefined);
}

/** Drops every boost whose end date has passed. */
export async function clearExpiredFeatures(): Promise<ActionResult<{ count: number }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;

  const removed = await db.transaction(async (tx) => {
    const rows = await tx
      .update(posts)
      .set({ boostRank: null, boostUntil: null, editorNote: null })
      .where(and(sql`${posts.boostRank} is not null`, sql`${posts.boostUntil} < now()`))
      .returning({ id: posts.id });
    if (rows.length > 0) {
      await renumber(tx);
      await writeAudit(tx, {
        actorId: auth.viewer.id,
        action: "featured.clear_expired",
        entityType: "post",
        summary: `Removed ${rows.length} expired featured posts`,
        meta: { ids: rows.map((r) => r.id) },
      });
    }
    return rows.map((r) => r.id);
  });

  expire(removed);
  return ok({ count: removed.length });
}
