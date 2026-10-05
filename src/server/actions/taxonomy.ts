"use server";

import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/server/audit";
import { guard } from "@/server/auth/guard";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { caseLawDetails, courtAliases, courts, posts, topicAliases, topics } from "@/server/db/schema";
import { topicAliasKey } from "@/server/import/topics";
import { refreshSearchVectors } from "@/server/search/vectors";

/*
 * Topics and courts. Renames and merges change what the public directory,
 * hub pages and search show, so every action expires those caches and
 * rebuilds the search documents of the rulings involved.
 */

function expireTaxonomy() {
  updateTag(TAGS.taxonomy);
  updateTag(TAGS.posts);
  updateTag(TAGS.stats);
}

const slugSchema = z
  .string()
  .trim()
  .min(2, "Enter a web address.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single hyphens.");

/* --------------------------------- Topics --------------------------------- */

const topicSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(2, "Enter the topic name.").max(80),
  slug: slugSchema,
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
  reviewed: z.boolean(),
});

export async function saveTopic(input: z.input<typeof topicSchema>): Promise<ActionResult<{ id: string }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.", "invalid");
  const data = parsed.data;

  const [clash] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(data.id ? and(eq(topics.slug, data.slug), ne(topics.id, data.id)) : eq(topics.slug, data.slug))
    .limit(1);
  if (clash) return fail("Another topic already uses that web address.", "invalid");

  const id = await db.transaction(async (tx) => {
    let topicId: string;
    let summary: string;
    let renamed = false;
    if (data.id) {
      const [before] = await tx.select().from(topics).where(eq(topics.id, data.id)).limit(1);
      if (!before) return null;
      topicId = before.id;
      renamed = before.name !== data.name;
      await tx
        .update(topics)
        .set({ name: data.name, slug: data.slug, description: data.description || null, reviewed: data.reviewed })
        .where(eq(topics.id, topicId));
      const changes = [
        before.name !== data.name ? `renamed from “${before.name}”` : null,
        before.slug !== data.slug ? `address /topics/${data.slug}` : null,
        before.reviewed !== data.reviewed ? (data.reviewed ? "approved" : "hidden from visitors") : null,
        (before.description ?? "") !== data.description ? "description" : null,
      ].filter(Boolean);
      summary = `Updated topic “${data.name}”${changes.length ? `: ${changes.join(", ")}` : ""}`;
    } else {
      const [created] = await tx
        .insert(topics)
        .values({ name: data.name, slug: data.slug, description: data.description || null, reviewed: data.reviewed, sortOrder: 500 })
        .returning({ id: topics.id });
      topicId = created!.id;
      summary = `Added topic “${data.name}”`;
    }
    // Imports with this exact label land here.
    await tx.insert(topicAliases).values({ alias: topicAliasKey(data.name), topicId }).onConflictDoNothing();
    if (renamed) {
      const ids = await tx.select({ id: posts.id }).from(posts).where(eq(posts.topicId, topicId));
      await refreshSearchVectors(tx, ids.map((r) => r.id));
    }
    await writeAudit(tx, { actorId: auth.viewer.id, action: data.id ? "topic.update" : "topic.create", entityType: "topic", entityId: topicId, summary });
    return topicId;
  });

  if (!id) return fail("This topic no longer exists.", "not_found");
  expireTaxonomy();
  return ok({ id });
}

const mergeSchema = z.object({ sourceId: z.uuid(), targetId: z.uuid() }).refine((v) => v.sourceId !== v.targetId, "Choose a different topic to merge into.");

/** Moves every post and alias of one topic to another, then removes the first. */
export async function mergeTopic(input: { sourceId: string; targetId: string }): Promise<ActionResult<{ moved: number }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose the topic to merge into.", "invalid");
  const { sourceId, targetId } = parsed.data;

  const moved = await db.transaction(async (tx) => {
    const [source] = await tx.select().from(topics).where(eq(topics.id, sourceId)).limit(1);
    const [target] = await tx.select().from(topics).where(eq(topics.id, targetId)).limit(1);
    if (!source || !target) return null;

    const ids = (await tx.update(posts).set({ topicId: targetId }).where(eq(posts.topicId, sourceId)).returning({ id: posts.id })).map((r) => r.id);
    await tx.update(topicAliases).set({ topicId: targetId }).where(eq(topicAliases.topicId, sourceId));
    await tx.insert(topicAliases).values({ alias: topicAliasKey(source.name), topicId: targetId }).onConflictDoUpdate({ target: topicAliases.alias, set: { topicId: targetId } });
    await tx.delete(topics).where(eq(topics.id, sourceId));
    await refreshSearchVectors(tx, ids);
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "topic.merge",
      entityType: "topic",
      entityId: targetId,
      summary: `Merged topic “${source.name}” into “${target.name}” (${ids.length} posts moved)`,
      meta: { sourceId, sourceName: source.name, ids },
    });
    return ids.length;
  });

  if (moved === null) return fail("One of these topics no longer exists.", "not_found");
  expireTaxonomy();
  return ok({ moved });
}

/** Deletes a topic that no post uses (topics with posts must be merged instead). */
export async function deleteTopic(topicId: string): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  if (!z.uuid().safeParse(topicId).success) return fail("Unknown topic.", "invalid");

  const outcome = await db.transaction(async (tx) => {
    const [topic] = await tx.select({ name: topics.name }).from(topics).where(eq(topics.id, topicId)).limit(1);
    if (!topic) return "missing" as const;
    const [used] = await tx.select({ id: posts.id }).from(posts).where(eq(posts.topicId, topicId)).limit(1);
    if (used) return "used" as const;
    await tx.delete(topics).where(eq(topics.id, topicId));
    await writeAudit(tx, { actorId: auth.viewer.id, action: "topic.delete", entityType: "topic", entityId: topicId, summary: `Deleted topic “${topic.name}”` });
    return "ok" as const;
  });

  if (outcome === "missing") return fail("This topic no longer exists.", "not_found");
  if (outcome === "used") return fail("Posts still use this topic. Merge it into another topic instead.", "invalid");
  expireTaxonomy();
  return ok(undefined);
}

const aliasSchema = z.object({ topicId: z.uuid(), label: z.string().trim().min(2, "Enter the label as it appears in the spreadsheet.").max(80) });

/** Maps a spreadsheet label (such as "IInterest") to a topic for future imports. */
export async function addTopicAlias(input: { topicId: string; label: string }): Promise<ActionResult<{ alias: string }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = aliasSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a label.", "invalid");
  const alias = topicAliasKey(parsed.data.label);
  if (!alias) return fail("Enter a label with letters or numbers.", "invalid");

  const [topic] = await db.select({ name: topics.name }).from(topics).where(eq(topics.id, parsed.data.topicId)).limit(1);
  if (!topic) return fail("This topic no longer exists.", "not_found");
  await db.transaction(async (tx) => {
    await tx.insert(topicAliases).values({ alias, topicId: parsed.data.topicId }).onConflictDoUpdate({ target: topicAliases.alias, set: { topicId: parsed.data.topicId } });
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "topic.alias_add",
      entityType: "topic",
      entityId: parsed.data.topicId,
      summary: `Imports labelled “${parsed.data.label}” now go to “${topic.name}”`,
    });
  });
  updateTag(TAGS.taxonomy);
  return ok({ alias });
}

export async function removeTopicAlias(alias: string): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = z.string().min(1).max(120).safeParse(alias);
  if (!parsed.success) return fail("Unknown label.", "invalid");

  const [removed] = await db.delete(topicAliases).where(eq(topicAliases.alias, parsed.data)).returning({ topicId: topicAliases.topicId });
  if (!removed) return fail("That label is no longer mapped.", "not_found");
  await writeAudit(db, { actorId: auth.viewer.id, action: "topic.alias_remove", entityType: "topic", entityId: removed.topicId, summary: `Removed the import label “${parsed.data}”` });
  updateTag(TAGS.taxonomy);
  return ok(undefined);
}

/* --------------------------------- Courts --------------------------------- */

const COURT_TYPES = ["supreme_court", "high_court", "gstat", "cestat", "itat", "aaar", "aar", "naa", "tribunal", "other"] as const;

const courtSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(3, "Enter the full name.").max(160),
  shortName: z.string().trim().min(2, "Enter a short name.").max(60),
  type: z.enum(COURT_TYPES),
  location: z.string().trim().max(80),
  slug: slugSchema,
  description: z.string().trim().max(600, "Keep the description under 600 characters."),
});

export async function saveCourt(input: z.input<typeof courtSchema>): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = courtSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.", "invalid");
  const data = parsed.data;

  const [clash] = await db.select({ id: courts.id }).from(courts).where(and(eq(courts.slug, data.slug), ne(courts.id, data.id))).limit(1);
  if (clash) return fail("Another court already uses that web address.", "invalid");

  const outcome = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(courts).where(eq(courts.id, data.id)).limit(1);
    if (!before) return false;
    await tx
      .update(courts)
      .set({ name: data.name, shortName: data.shortName, type: data.type, location: data.location || null, slug: data.slug, description: data.description || null })
      .where(eq(courts.id, data.id));
    if (before.name !== data.name || before.shortName !== data.shortName) {
      const ids = await tx.select({ id: caseLawDetails.postId }).from(caseLawDetails).where(eq(caseLawDetails.courtId, data.id));
      await refreshSearchVectors(tx, ids.map((r) => r.id));
    }
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "court.update",
      entityType: "court",
      entityId: data.id,
      summary: before.name !== data.name ? `Renamed court “${before.name}” to “${data.name}”` : `Updated court “${data.name}”`,
    });
    return true;
  });

  if (!outcome) return fail("This court no longer exists.", "not_found");
  expireTaxonomy();
  return ok(undefined);
}

const courtMergeSchema = z.object({ sourceId: z.uuid(), targetId: z.uuid() }).refine((v) => v.sourceId !== v.targetId, "Choose a different court to merge into.");

/**
 * Moves every ruling of one court to another and removes the first. Its key
 * becomes an alias, so the next import does not bring it back.
 */
export async function mergeCourt(input: { sourceId: string; targetId: string }): Promise<ActionResult<{ moved: number }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = courtMergeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose the court to merge into.", "invalid");
  const { sourceId, targetId } = parsed.data;

  const moved = await db.transaction(async (tx) => {
    const [source] = await tx.select().from(courts).where(eq(courts.id, sourceId)).limit(1);
    const [target] = await tx.select().from(courts).where(eq(courts.id, targetId)).limit(1);
    if (!source || !target) return null;

    const ids = (await tx.update(caseLawDetails).set({ courtId: targetId }).where(eq(caseLawDetails.courtId, sourceId)).returning({ id: caseLawDetails.postId })).map(
      (r) => r.id,
    );
    await tx.update(courtAliases).set({ courtId: targetId }).where(eq(courtAliases.courtId, sourceId));
    await tx.insert(courtAliases).values({ key: source.key, courtId: targetId }).onConflictDoUpdate({ target: courtAliases.key, set: { courtId: targetId } });
    await tx.delete(courts).where(eq(courts.id, sourceId));
    await refreshSearchVectors(tx, ids);
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "court.merge",
      entityType: "court",
      entityId: targetId,
      summary: `Merged court “${source.name}” into “${target.name}” (${ids.length} rulings moved)`,
      meta: { sourceId, sourceKey: source.key, ids },
    });
    return ids.length;
  });

  if (moved === null) return fail("One of these courts no longer exists.", "not_found");
  expireTaxonomy();
  return ok({ moved });
}
