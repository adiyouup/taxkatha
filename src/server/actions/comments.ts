"use server";

import "server-only";

import { and, eq, lte, sql } from "drizzle-orm";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { findBlockedWord } from "@/lib/site-settings";
import { getFreshViewer } from "@/server/auth/dal";
import { COMMENT_MAX_LENGTH, EDIT_WINDOW_MS, getComment, type CommentDTO } from "@/server/comments";
import { db } from "@/server/db";
import { commentLikes, comments, notifications, postStats, posts, reports } from "@/server/db/schema";
import { rateLimitAll } from "@/server/rate-limit";
import { getSiteSettings } from "@/server/settings";

/*
 * Discussion writes. Members only; every action re-checks the session
 * against the database (so a ban or sign-out applies at once) and verifies
 * ownership before changing anything.
 */

const SIGN_IN = "Sign in to join the discussion.";
const BLOCKED = "Your comment includes a word that is not allowed in the discussion. Please rephrase it.";

/** Words an administrator has blocked in Settings → Community. */
async function hasBlockedWord(body: string): Promise<boolean> {
  const { community } = await getSiteSettings();
  return findBlockedWord(body, community.blockedWords) !== null;
}

/** Plain text only: normalise newlines, drop control characters, cap blank lines. */
function cleanBody(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍﻿]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const bodySchema = z
  .string()
  .transform(cleanBody)
  .pipe(z.string().min(1, "Write something first.").max(COMMENT_MAX_LENGTH, `Keep comments under ${COMMENT_MAX_LENGTH} characters.`));

const createSchema = z.object({ postId: z.uuid(), parentId: z.uuid().nullable(), body: bodySchema });

export async function createComment(input: { postId: string; parentId: string | null; body: string }): Promise<ActionResult<CommentDTO>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "This comment could not be posted.", "invalid");
  const { postId, parentId, body } = parsed.data;

  const viewer = await getFreshViewer();
  if (!viewer) return fail(SIGN_IN, "unauthenticated");

  const allowed = await rateLimitAll([
    { key: `comment:m:${viewer.id}`, limit: 5, windowSeconds: 60 },
    { key: `comment:d:${viewer.id}`, limit: 120, windowSeconds: 86400 },
  ]);
  if (!allowed) return fail("You are posting very quickly. Please wait a moment.", "rate_limited");
  if (await hasBlockedWord(body)) return fail(BLOCKED, "invalid");

  const id = await db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
      .limit(1);
    if (!post) return null;

    let rootId: string | null = null;
    let replyToUserId: string | null = null;
    if (parentId) {
      const [parent] = await tx
        .select({ id: comments.id, rootId: comments.rootId, postId: comments.postId, userId: comments.userId, status: comments.status })
        .from(comments)
        .where(eq(comments.id, parentId))
        .limit(1);
      if (!parent || parent.postId !== postId || parent.status !== "visible") return null;
      // Threads are one level deep: a reply to a reply joins the same thread.
      rootId = parent.rootId ?? parent.id;
      replyToUserId = parent.userId;
    }

    const [created] = await tx.insert(comments).values({ postId, userId: viewer.id, rootId, replyToUserId, body }).returning({ id: comments.id });
    await tx.insert(postStats).values({ postId, commentCount: 1 }).onConflictDoUpdate({ target: postStats.postId, set: { commentCount: sql`${postStats.commentCount} + 1` } });
    if (rootId) await tx.update(comments).set({ replyCount: sql`${comments.replyCount} + 1` }).where(eq(comments.id, rootId));

    if (replyToUserId && replyToUserId !== viewer.id) {
      await tx.insert(notifications).values({
        userId: replyToUserId,
        actorId: viewer.id,
        type: viewer.role === "user" ? "reply" : "official_reply",
        postId,
        commentId: created!.id,
      });
    }
    return created!.id;
  });

  if (!id) return fail("This discussion is no longer available.", "not_found");
  const dto = await getComment(id, viewer);
  return dto ? ok(dto) : fail("This comment could not be posted.");
}

const editSchema = z.object({ commentId: z.uuid(), body: bodySchema });

export async function editComment(input: { commentId: string; body: string }): Promise<ActionResult<CommentDTO>> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "This comment could not be saved.", "invalid");

  const viewer = await getFreshViewer();
  if (!viewer) return fail(SIGN_IN, "unauthenticated");
  if (await hasBlockedWord(parsed.data.body)) return fail(BLOCKED, "invalid");

  const [row] = await db.select({ userId: comments.userId, status: comments.status, createdAt: comments.createdAt }).from(comments).where(eq(comments.id, parsed.data.commentId)).limit(1);
  if (!row || row.status !== "visible") return fail("This comment is no longer available.", "not_found");
  if (row.userId !== viewer.id) return fail("You can only edit your own comments.", "forbidden");
  if (Date.now() - row.createdAt.getTime() > EDIT_WINDOW_MS) return fail("Comments can be edited for 15 minutes after posting.", "forbidden");

  await db.update(comments).set({ body: parsed.data.body, editedAt: new Date() }).where(eq(comments.id, parsed.data.commentId));
  const dto = await getComment(parsed.data.commentId, viewer);
  return dto ? ok(dto) : fail("This comment could not be saved.");
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(commentId).success) return fail("Unknown comment.", "invalid");
  const viewer = await getFreshViewer();
  if (!viewer) return fail(SIGN_IN, "unauthenticated");

  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx.select({ userId: comments.userId, status: comments.status, rootId: comments.rootId, postId: comments.postId }).from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!row || row.status === "deleted") return "missing" as const;
    if (row.userId !== viewer.id && viewer.role === "user") return "forbidden" as const;

    // Soft delete: the text is erased, the slot stays so replies keep their context.
    await tx.update(comments).set({ status: "deleted", body: "" }).where(eq(comments.id, commentId));
    await tx.update(postStats).set({ commentCount: sql`greatest(${postStats.commentCount} - 1, 0)` }).where(eq(postStats.postId, row.postId));
    if (row.rootId) await tx.update(comments).set({ replyCount: sql`greatest(${comments.replyCount} - 1, 0)` }).where(eq(comments.id, row.rootId));
    await tx.delete(notifications).where(eq(notifications.commentId, commentId));
    return "ok" as const;
  });

  if (outcome === "forbidden") return fail("You can only delete your own comments.", "forbidden");
  return ok(undefined);
}

export async function setCommentLike(commentId: string, liked: boolean): Promise<ActionResult<{ liked: boolean; count: number }>> {
  if (!z.uuid().safeParse(commentId).success) return fail("Unknown comment.", "invalid");
  const viewer = await getFreshViewer();
  if (!viewer) return fail(SIGN_IN, "unauthenticated");
  if (!(await rateLimitAll([{ key: `clike:${viewer.id}`, limit: 60, windowSeconds: 60 }]))) return fail("You are going a little fast.", "rate_limited");

  const count = await db.transaction(async (tx) => {
    const [row] = await tx.select({ userId: comments.userId, status: comments.status, postId: comments.postId }).from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!row || row.status !== "visible") return null;

    if (liked) {
      const inserted = await tx.insert(commentLikes).values({ userId: viewer.id, commentId }).onConflictDoNothing().returning({ commentId: commentLikes.commentId });
      if (inserted.length > 0) {
        await tx.update(comments).set({ likeCount: sql`${comments.likeCount} + 1` }).where(eq(comments.id, commentId));
        if (row.userId && row.userId !== viewer.id) {
          await tx.insert(notifications).values({ userId: row.userId, actorId: viewer.id, type: "comment_like", postId: row.postId, commentId });
        }
      }
    } else {
      const removed = await tx.delete(commentLikes).where(and(eq(commentLikes.userId, viewer.id), eq(commentLikes.commentId, commentId))).returning({ commentId: commentLikes.commentId });
      if (removed.length > 0) {
        await tx.update(comments).set({ likeCount: sql`greatest(${comments.likeCount} - 1, 0)` }).where(eq(comments.id, commentId));
        await tx
          .delete(notifications)
          .where(and(eq(notifications.commentId, commentId), eq(notifications.actorId, viewer.id), eq(notifications.type, "comment_like")));
      }
    }
    const [current] = await tx.select({ likeCount: comments.likeCount }).from(comments).where(eq(comments.id, commentId)).limit(1);
    return current?.likeCount ?? 0;
  });

  if (count === null) return fail("This comment is no longer available.", "not_found");
  return ok({ liked, count });
}

const reportSchema = z.object({
  commentId: z.uuid(),
  reason: z.enum(["spam", "abuse", "misinformation", "off_topic", "other"]),
  note: z.string().trim().max(500).optional(),
});

export async function reportComment(input: { commentId: string; reason: string; note?: string }): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a reason for the report.", "invalid");
  const viewer = await getFreshViewer();
  if (!viewer) return fail(SIGN_IN, "unauthenticated");
  if (!(await rateLimitAll([{ key: `report:${viewer.id}`, limit: 10, windowSeconds: 3600 }]))) return fail("You have sent several reports. Please try again later.", "rate_limited");

  const [row] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, parsed.data.commentId)).limit(1);
  if (!row) return fail("This comment is no longer available.", "not_found");

  // One report per member per comment; a repeat simply succeeds.
  await db
    .insert(reports)
    .values({ commentId: parsed.data.commentId, reporterId: viewer.id, reason: parsed.data.reason, note: parsed.data.note || null })
    .onConflictDoNothing();
  return ok(undefined);
}
