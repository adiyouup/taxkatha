"use server";

import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { docEmbeds, docToText, isAllowedImageSrc, isEmptyDoc, MAX_DOC_BYTES, readingMinutes, richDocSchema } from "@/lib/rich-text/schema";
import { writeAudit } from "@/server/audit";
import { AuthError, authorize } from "@/server/auth/dal";
import { postTag, TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { insightDetails, insightRelatedPosts, postRevisions, postStats, posts, slugHistory } from "@/server/db/schema";
import { slugify } from "@/server/import/text";
import { refreshSearchVectors } from "@/server/search/vectors";

const nullable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length ? v : null))
    .nullable();

const inputSchema = z.object({
  id: z.uuid().nullable(),
  title: z.string().trim().min(5, "Give the insight a title of at least 5 characters.").max(160),
  slug: z.string().trim().max(90),
  excerpt: z.string().trim().max(320, "Keep the standfirst under 320 characters."),
  body: richDocSchema,
  coverImageUrl: z.string().refine(isAllowedImageSrc, "Upload the cover image to TaxKatha.").nullable(),
  coverImageAlt: nullable(200),
  topicId: z.uuid().nullable(),
  domain: z.enum(["gst", "income_tax", "customs", "excise", "service_tax", "vat", "ibc", "other"]),
  seoTitle: nullable(70),
  seoDescription: nullable(170),
  membersOnly: z.boolean(),
  intent: z.enum(["draft", "publish", "schedule"]),
  publishAt: z.iso.datetime().nullable(),
});

export type InsightInput = z.input<typeof inputSchema>;

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

export async function saveInsight(input: InsightInput): Promise<ActionResult<{ id: string; slug: string; status: string }>> {
  let viewer;
  try {
    viewer = await authorize("admin");
  } catch (error) {
    if (error instanceof AuthError) return fail("Only administrators can publish insights.", error.code);
    throw error;
  }

  if (JSON.stringify(input.body ?? null).length > MAX_DOC_BYTES) return fail("This article is too long to save. Split it into two insights.", "invalid");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const inBody = issue?.path[0] === "body";
    // The path says which node was refused, without logging what the editor wrote.
    if (inBody) console.warn("insight body rejected at", issue?.path.join("."), "-", issue?.message);
    return fail(inBody ? "The article contains formatting that is not supported. Remove the last pasted content and try again." : (issue?.message ?? "Please check the form."), "invalid");
  }
  const data = parsed.data;

  const going = data.intent !== "draft";
  if (going && isEmptyDoc(data.body)) return fail("Write the article before publishing it.", "invalid");
  if (going && data.excerpt.length < 40) return fail("Add a standfirst of at least 40 characters. It is the public teaser.", "invalid");
  let scheduledFor: Date | null = null;
  if (data.intent === "schedule") {
    scheduledFor = data.publishAt ? new Date(data.publishAt) : null;
    if (!scheduledFor || scheduledFor.getTime() < Date.now() + 60_000) return fail("Choose a publication time in the future.", "invalid");
  }

  const bodyText = docToText(data.body);
  const slug = await uniqueSlug(slugify(data.slug || data.title, 80) || "insight", data.id);
  const embeds = docEmbeds(data.body);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const existing = data.id
      ? (await tx.select().from(posts).where(and(eq(posts.id, data.id), eq(posts.type, "insight"))).limit(1))[0]
      : undefined;
    if (data.id && !existing) return null;

    const status = data.intent === "publish" ? "published" : data.intent === "schedule" ? "scheduled" : "draft";
    const publishedAt =
      data.intent === "publish"
        ? existing?.status === "published" && existing.publishedAt ? existing.publishedAt : now
        : data.intent === "schedule"
          ? scheduledFor
          : (existing?.publishedAt ?? null);

    const postValues = { slug, title: data.title, excerpt: data.excerpt, status, publishedAt, topicId: data.topicId, domain: data.domain } as const;
    const detailValues = {
      bodyJson: data.body,
      bodyText,
      coverImageUrl: data.coverImageUrl,
      coverImageAlt: data.coverImageAlt,
      readingMinutes: readingMinutes(bodyText),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      membersOnly: data.membersOnly,
    };

    let id: string;
    if (existing) {
      id = existing.id;
      const [before] = await tx.select().from(insightDetails).where(eq(insightDetails.postId, id)).limit(1);
      await tx.insert(postRevisions).values({
        postId: id,
        reason: "edit",
        actorId: viewer.id,
        snapshot: { title: existing.title, excerpt: existing.excerpt, slug: existing.slug, status: existing.status, body: before?.bodyJson ?? null },
      });
      if (existing.slug !== slug) await tx.insert(slugHistory).values({ oldSlug: existing.slug, postId: id }).onConflictDoNothing();
      await tx.update(posts).set(postValues).where(eq(posts.id, id));
      await tx.update(insightDetails).set(detailValues).where(eq(insightDetails.postId, id));
    } else {
      const [created] = await tx.insert(posts).values({ ...postValues, type: "insight", createdBy: viewer.id }).returning({ id: posts.id });
      id = created!.id;
      await tx.insert(insightDetails).values({ postId: id, authorId: viewer.id, ...detailValues });
      await tx.insert(postStats).values({ postId: id }).onConflictDoNothing();
    }

    // The rulings an article embeds are its "related rulings".
    await tx.delete(insightRelatedPosts).where(eq(insightRelatedPosts.insightPostId, id));
    if (embeds.length > 0) {
      const related = await tx.select({ id: posts.id, slug: posts.slug }).from(posts).where(inArray(posts.slug, embeds));
      const rows = embeds.flatMap((embedSlug, position) => {
        const match = related.find((r) => r.slug === embedSlug);
        return match && match.id !== id ? [{ insightPostId: id, relatedPostId: match.id, position }] : [];
      });
      if (rows.length > 0) await tx.insert(insightRelatedPosts).values(rows).onConflictDoNothing();
    }

    await refreshSearchVectors(tx, [id]);
    await writeAudit(tx, {
      actorId: viewer.id,
      action: existing ? `insight.${data.intent === "draft" ? "save" : data.intent}` : "insight.create",
      entityType: "post",
      entityId: id,
      summary: `${existing ? "Updated" : "Created"} insight “${data.title}” (${status})`,
    });
    return { id, slug, status, previousSlug: existing?.slug ?? null };
  });

  if (!result) return fail("This insight no longer exists.", "not_found");

  updateTag(TAGS.posts);
  updateTag(TAGS.trending);
  updateTag(TAGS.stats);
  updateTag(postTag(result.id));
  updateTag(postTag(result.slug));
  if (result.previousSlug && result.previousSlug !== result.slug) updateTag(postTag(result.previousSlug));

  return ok({ id: result.id, slug: result.slug, status: result.status });
}

export async function deleteInsight(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Unknown insight.", "invalid");
  let viewer;
  try {
    viewer = await authorize("admin");
  } catch (error) {
    if (error instanceof AuthError) return fail("Only administrators can delete insights.", error.code);
    throw error;
  }

  const [removed] = await db.delete(posts).where(and(eq(posts.id, id), eq(posts.type, "insight"))).returning({ title: posts.title, slug: posts.slug });
  if (!removed) return fail("This insight no longer exists.", "not_found");
  await writeAudit(db, { actorId: viewer.id, action: "insight.delete", entityType: "post", entityId: id, summary: `Deleted insight “${removed.title}”` });

  updateTag(TAGS.posts);
  updateTag(TAGS.trending);
  updateTag(TAGS.stats);
  updateTag(postTag(id));
  updateTag(postTag(removed.slug));
  return ok(undefined);
}
