import "server-only";

import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/server/db";
import { comments, notifications, postSaves, posts, user } from "@/server/db/schema";

/* Reads for the signed-in member's own pages. Callers pass the verified viewer id. */

/** Ids of the member's saved posts, most recently saved first. */
export async function listSavedPostIds(userId: string, limit = 100): Promise<string[]> {
  const rows = await db
    .select({ postId: postSaves.postId })
    .from(postSaves)
    .innerJoin(posts, eq(posts.id, postSaves.postId))
    .where(and(eq(postSaves.userId, userId), eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
    .orderBy(desc(postSaves.createdAt))
    .limit(limit);
  return rows.map((r) => r.postId);
}

export type NotificationItem = {
  id: string;
  type: "reply" | "comment_like" | "official_reply";
  createdAt: Date;
  unread: boolean;
  actorName: string;
  actorImage: string | null;
  postTitle: string;
  href: string;
  excerpt: string;
};

const actor = alias(user, "actor");

export async function listNotifications(userId: string, limit = 50): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorName: actor.name,
      actorImage: actor.image,
      postType: posts.type,
      postSlug: posts.slug,
      postTitle: posts.title,
      commentId: comments.id,
      rootId: comments.rootId,
      commentBody: sql<string>`left(${comments.body}, 160)`,
      commentStatus: comments.status,
    })
    .from(notifications)
    .innerJoin(actor, eq(actor.id, notifications.actorId))
    .innerJoin(posts, eq(posts.id, notifications.postId))
    .innerJoin(comments, eq(comments.id, notifications.commentId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const base = `/${row.postType === "case_law" ? "case-laws" : "insights"}/${row.postSlug}`;
    return {
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      unread: row.readAt === null,
      actorName: row.actorName,
      actorImage: row.actorImage && !row.actorImage.startsWith("data:") ? row.actorImage : null,
      postTitle: row.postTitle,
      href: `${base}/thread/${row.rootId ?? row.commentId}#comment-${row.commentId}`,
      excerpt: row.commentStatus === "visible" ? row.commentBody : "",
    };
  });
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)));
}
