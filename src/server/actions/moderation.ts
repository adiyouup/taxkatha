"use server";

import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { truncate } from "@/lib/legal-text";
import { writeAudit } from "@/server/audit";
import { guard } from "@/server/auth/guard";
import { postTag } from "@/server/cache-tags";
import { db } from "@/server/db";
import { comments, notifications, postStats, reports, user } from "@/server/db/schema";

/*
 * Comment moderation for moderators and administrators. Hiding keeps the
 * comment (its author and staff still see it, marked as hidden); deleting
 * erases the text and leaves a placeholder so replies keep their context.
 * Acting on a comment closes its open reports.
 */

const moderateSchema = z.object({ commentId: z.uuid(), action: z.enum(["hide", "unhide", "delete"]) });

export async function moderateComment(input: { commentId: string; action: string }): Promise<ActionResult> {
  const auth = await guard("moderator");
  if (!auth.ok) return auth.result;
  const parsed = moderateSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown comment.", "invalid");
  const { commentId, action } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: comments.status, body: comments.body, postId: comments.postId, rootId: comments.rootId, author: user.name })
      .from(comments)
      .leftJoin(user, eq(user.id, comments.userId))
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!row) return { error: "This comment no longer exists." };
    if (row.status === "deleted") return { error: "This comment was already deleted." };

    if (action === "hide") {
      if (row.status === "hidden") return { error: "This comment is already hidden." };
      await tx.update(comments).set({ status: "hidden" }).where(eq(comments.id, commentId));
    } else if (action === "unhide") {
      if (row.status !== "hidden") return { error: "This comment is not hidden." };
      await tx.update(comments).set({ status: "visible" }).where(eq(comments.id, commentId));
    } else {
      await tx.update(comments).set({ status: "deleted", body: "" }).where(eq(comments.id, commentId));
      await tx.update(postStats).set({ commentCount: sql`greatest(${postStats.commentCount} - 1, 0)` }).where(eq(postStats.postId, row.postId));
      if (row.rootId) await tx.update(comments).set({ replyCount: sql`greatest(${comments.replyCount} - 1, 0)` }).where(eq(comments.id, row.rootId));
      await tx.delete(notifications).where(eq(notifications.commentId, commentId));
    }
    if (action !== "unhide") {
      await tx
        .update(reports)
        .set({ status: "resolved", resolvedBy: auth.viewer.id, resolvedAt: new Date() })
        .where(and(eq(reports.commentId, commentId), eq(reports.status, "open")));
    }

    const verb = action === "hide" ? "Hid" : action === "unhide" ? "Restored" : "Deleted";
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: `comment.${action}`,
      entityType: "comment",
      entityId: commentId,
      summary: `${verb} a comment by ${row.author ?? "a former member"}: “${truncate(row.body, 80)}”`,
      meta: { postId: row.postId },
    });
    return { postId: row.postId };
  });

  if ("error" in outcome) return fail(outcome.error ?? "This comment could not be changed.", "invalid");
  // Counters shown on the post page.
  if (action === "delete") updateTag(postTag(outcome.postId));
  refresh();
  return ok(undefined);
}

/** Closes a comment's open reports without changing the comment. */
export async function dismissReports(commentId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await guard("moderator");
  if (!auth.ok) return auth.result;
  if (!z.uuid().safeParse(commentId).success) return fail("Unknown comment.", "invalid");

  const count = await db.transaction(async (tx) => {
    const closed = await tx
      .update(reports)
      .set({ status: "dismissed", resolvedBy: auth.viewer.id, resolvedAt: new Date() })
      .where(and(eq(reports.commentId, commentId), eq(reports.status, "open")))
      .returning({ id: reports.id });
    if (closed.length > 0) {
      await writeAudit(tx, {
        actorId: auth.viewer.id,
        action: "comment.dismiss_reports",
        entityType: "comment",
        entityId: commentId,
        summary: `Kept a reported comment and dismissed ${closed.length} report${closed.length === 1 ? "" : "s"}`,
      });
    }
    return closed.length;
  });

  refresh();
  return ok({ count });
}
