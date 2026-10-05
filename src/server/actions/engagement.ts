"use server";

import "server-only";

import { and, eq, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/auth/dal";
import { db } from "@/server/db";
import { postLikes, postSaves, postStats, posts, shareEvents } from "@/server/db/schema";
import { rateLimit } from "@/server/rate-limit";
import { isBot, today, visitorHash } from "@/server/visitor";

/*
 * Likes, saves and shares. Each action states the desired end state
 * ("liked: true") rather than toggling, so double-clicks and retries are
 * harmless. Counters live in post_stats and move only when a row actually
 * changed. Pages are not revalidated: the UI is optimistic, and cached
 * counts catch up on their own.
 */

const idSchema = z.uuid();

async function livePost(postId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
    .limit(1);
  return Boolean(row);
}

export async function setLike(postId: string, liked: boolean): Promise<ActionResult<{ liked: boolean; count: number }>> {
  if (!idSchema.safeParse(postId).success) return fail("Unknown post.", "invalid");
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to like rulings.", "unauthenticated");
  if (!(await rateLimit(`like:${viewer.id}`, 60, 60)).ok) return fail("You are going a little fast. Try again in a minute.", "rate_limited");
  if (!(await livePost(postId))) return fail("This post is no longer available.", "not_found");

  const count = await db.transaction(async (tx) => {
    if (liked) {
      const inserted = await tx.insert(postLikes).values({ userId: viewer.id, postId }).onConflictDoNothing().returning({ postId: postLikes.postId });
      if (inserted.length > 0) {
        await tx.insert(postStats).values({ postId, likeCount: 1 }).onConflictDoUpdate({ target: postStats.postId, set: { likeCount: sql`${postStats.likeCount} + 1` } });
      }
    } else {
      const removed = await tx.delete(postLikes).where(and(eq(postLikes.userId, viewer.id), eq(postLikes.postId, postId))).returning({ postId: postLikes.postId });
      if (removed.length > 0) {
        await tx.update(postStats).set({ likeCount: sql`greatest(${postStats.likeCount} - 1, 0)` }).where(eq(postStats.postId, postId));
      }
    }
    const [stats] = await tx.select({ likeCount: postStats.likeCount }).from(postStats).where(eq(postStats.postId, postId)).limit(1);
    return stats?.likeCount ?? 0;
  });

  return ok({ liked, count });
}

export async function setSave(postId: string, saved: boolean): Promise<ActionResult<{ saved: boolean }>> {
  if (!idSchema.safeParse(postId).success) return fail("Unknown post.", "invalid");
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to save rulings.", "unauthenticated");
  if (!(await rateLimit(`save:${viewer.id}`, 60, 60)).ok) return fail("You are going a little fast. Try again in a minute.", "rate_limited");
  if (!(await livePost(postId))) return fail("This post is no longer available.", "not_found");

  await db.transaction(async (tx) => {
    if (saved) {
      const inserted = await tx.insert(postSaves).values({ userId: viewer.id, postId }).onConflictDoNothing().returning({ postId: postSaves.postId });
      if (inserted.length > 0) {
        await tx.insert(postStats).values({ postId, saveCount: 1 }).onConflictDoUpdate({ target: postStats.postId, set: { saveCount: sql`${postStats.saveCount} + 1` } });
      }
    } else {
      const removed = await tx.delete(postSaves).where(and(eq(postSaves.userId, viewer.id), eq(postSaves.postId, postId))).returning({ postId: postSaves.postId });
      if (removed.length > 0) {
        await tx.update(postStats).set({ saveCount: sql`greatest(${postStats.saveCount} - 1, 0)` }).where(eq(postStats.postId, postId));
      }
    }
  });

  return ok({ saved });
}

const channelSchema = z.enum(["native", "whatsapp", "linkedin", "x", "telegram", "email", "copy_link", "story_card", "square_card"]);

/**
 * Records that a post was shared. Anonymous visitors may share too. A person
 * moves the public share counter at most once per post per day.
 */
export async function recordShare(postId: string, channel: string): Promise<ActionResult> {
  const parsed = channelSchema.safeParse(channel);
  if (!idSchema.safeParse(postId).success || !parsed.success) return fail("Unknown post.", "invalid");

  const requestHeaders = await headers();
  if (isBot(requestHeaders.get("user-agent"))) return ok(undefined);

  const viewer = await getViewer();
  const day = today();
  const hash = viewer ? null : visitorHash(requestHeaders, day);
  const who = viewer?.id ?? hash!;
  if (!(await rateLimit(`share:${who}`, 30, 60)).ok) return ok(undefined);
  if (!(await livePost(postId))) return fail("This post is no longer available.", "not_found");

  await db.transaction(async (tx) => {
    const [already] = await tx
      .select({ id: shareEvents.id })
      .from(shareEvents)
      .where(
        and(
          eq(shareEvents.postId, postId),
          viewer ? eq(shareEvents.userId, viewer.id) : eq(shareEvents.visitorHash, hash!),
          sql`${shareEvents.createdAt}::date = current_date`,
        ),
      )
      .limit(1);
    await tx.insert(shareEvents).values({ postId, userId: viewer?.id ?? null, visitorHash: hash, channel: parsed.data });
    if (!already) {
      await tx.insert(postStats).values({ postId, shareCount: 1 }).onConflictDoUpdate({ target: postStats.postId, set: { shareCount: sql`${postStats.shareCount} + 1` } });
    }
  });

  return ok(undefined);
}
