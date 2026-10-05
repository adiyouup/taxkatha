import "server-only";

import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { professionShort } from "@/lib/professions";
import type { Viewer } from "@/server/auth/dal";
import { highestRole } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { commentLikes, comments, user } from "@/server/db/schema";

/*
 * Discussion reads. MEMBERS ONLY: every caller must have verified a session
 * first — the discussion is part of the gated content.
 *
 * The text of hidden or deleted comments is never sent to members; they see
 * a placeholder so the thread still reads coherently.
 */

export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const COMMENTS_PAGE_SIZE = 15;
export const REPLIES_PREVIEW = 2;
export const COMMENT_MAX_LENGTH = 2000;

export type CommentSort = "top" | "new";

export type CommentDTO = {
  id: string;
  postId: string;
  rootId: string | null;
  body: string;
  state: "visible" | "hidden" | "deleted";
  createdAt: string;
  edited: boolean;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  author: { id: string; name: string; image: string | null; badge: string | null; staff: boolean };
  replyTo: string | null;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** For top-level comments: the first few replies. */
  replies: CommentDTO[];
};

const replyUser = alias(user, "reply_user");

const columns = {
  id: comments.id,
  postId: comments.postId,
  rootId: comments.rootId,
  body: comments.body,
  status: comments.status,
  createdAt: comments.createdAt,
  editedAt: comments.editedAt,
  likeCount: comments.likeCount,
  replyCount: comments.replyCount,
  userId: comments.userId,
  authorName: user.name,
  authorImage: user.image,
  authorProfession: user.profession,
  authorRole: user.role,
  replyToName: replyUser.name,
};

function baseQuery() {
  return db
    .select(columns)
    .from(comments)
    .leftJoin(user, eq(user.id, comments.userId))
    .leftJoin(replyUser, eq(replyUser.id, comments.replyToUserId));
}

type Row = Awaited<ReturnType<typeof baseQuery>>[number];

function toDTO(row: Row, viewer: Viewer, liked: Set<string>, now: number): CommentDTO {
  const authorRole = highestRole(row.authorRole);
  const staffViewer = viewer.role !== "user";
  const mine = row.userId !== null && row.userId === viewer.id;
  const visible = row.status === "visible";
  return {
    id: row.id,
    postId: row.postId,
    rootId: row.rootId,
    // Staff and the author can still read a hidden comment; nobody gets a deleted one.
    body: visible || (row.status === "hidden" && (staffViewer || mine)) ? row.body : "",
    state: row.status,
    createdAt: row.createdAt.toISOString(),
    edited: row.editedAt !== null,
    likeCount: row.likeCount,
    replyCount: row.replyCount,
    liked: liked.has(row.id),
    author: {
      id: row.userId ?? "",
      name: row.authorName ?? "Former member",
      image: row.authorImage && !row.authorImage.startsWith("data:") ? row.authorImage : null,
      badge: authorRole !== "user" ? "TaxKatha" : professionShort(row.authorProfession),
      staff: authorRole !== "user",
    },
    replyTo: row.rootId ? row.replyToName : null,
    mine,
    canEdit: mine && visible && now - row.createdAt.getTime() < EDIT_WINDOW_MS,
    canDelete: (mine || staffViewer) && row.status !== "deleted",
    replies: [],
  };
}

async function likedBy(viewerId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ commentId: commentLikes.commentId })
    .from(commentLikes)
    .where(and(eq(commentLikes.userId, viewerId), inArray(commentLikes.commentId, ids)));
  return new Set(rows.map((r) => r.commentId));
}

/** A deleted comment stays in the thread only while it still has replies under it. */
const shown = or(ne(comments.status, "deleted"), gt(comments.replyCount, 0));

export async function listComments(
  postId: string,
  viewer: Viewer,
  options: { sort: CommentSort; offset: number },
): Promise<{ comments: CommentDTO[]; hasMore: boolean; total: number }> {
  const order =
    options.sort === "top"
      ? [desc(sql`${comments.likeCount} * 2 + ${comments.replyCount}`), desc(comments.createdAt)]
      : [desc(comments.createdAt)];

  const roots = await baseQuery()
    .where(and(eq(comments.postId, postId), isNull(comments.rootId), shown))
    .orderBy(...order)
    .limit(COMMENTS_PAGE_SIZE + 1)
    .offset(options.offset);

  const hasMore = roots.length > COMMENTS_PAGE_SIZE;
  const page = roots.slice(0, COMMENTS_PAGE_SIZE);
  if (page.length === 0) return { comments: [], hasMore: false, total: 0 };

  // Counted live: the cached teaser's count can lag behind a fresh comment.
  const [totalRow] = await db
    .select({ n: count() })
    .from(comments)
    .where(and(eq(comments.postId, postId), ne(comments.status, "deleted")));

  // The first few replies of each thread, oldest first.
  const preview = await db.execute<{ id: string }>(sql`
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY root_id ORDER BY created_at) AS position
      FROM comments
      WHERE root_id IN ${page.map((r) => r.id)} AND status <> 'deleted'
    ) ranked
    WHERE position <= ${REPLIES_PREVIEW}
  `);
  const replyIds = preview.rows.map((r) => r.id);
  const replies = replyIds.length > 0 ? await baseQuery().where(inArray(comments.id, replyIds)).orderBy(asc(comments.createdAt)) : [];

  const liked = await likedBy(viewer.id, [...page.map((r) => r.id), ...replyIds]);
  const now = Date.now();
  const byRoot = new Map<string, CommentDTO[]>();
  for (const reply of replies) {
    const list = byRoot.get(reply.rootId!) ?? [];
    list.push(toDTO(reply, viewer, liked, now));
    byRoot.set(reply.rootId!, list);
  }

  return {
    comments: page.map((root) => ({ ...toDTO(root, viewer, liked, now), replies: byRoot.get(root.id) ?? [] })),
    hasMore,
    total: totalRow?.n ?? 0,
  };
}

/** One thread: the top-level comment and every reply, oldest first. */
export async function getThread(rootId: string, viewer: Viewer): Promise<{ root: CommentDTO; replies: CommentDTO[] } | null> {
  const [rootRow] = await baseQuery().where(and(eq(comments.id, rootId), isNull(comments.rootId))).limit(1);
  if (!rootRow) return null;

  const replyRows = await baseQuery()
    .where(and(eq(comments.rootId, rootId), ne(comments.status, "deleted")))
    .orderBy(asc(comments.createdAt))
    .limit(500);

  const liked = await likedBy(viewer.id, [rootRow.id, ...replyRows.map((r) => r.id)]);
  const now = Date.now();
  return { root: toDTO(rootRow, viewer, liked, now), replies: replyRows.map((r) => toDTO(r, viewer, liked, now)) };
}

export async function getComment(id: string, viewer: Viewer): Promise<CommentDTO | null> {
  const [row] = await baseQuery().where(eq(comments.id, id)).limit(1);
  if (!row) return null;
  return toDTO(row, viewer, await likedBy(viewer.id, [id]), Date.now());
}
