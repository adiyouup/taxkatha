import { and, eq, lte, sql } from "drizzle-orm";

import { getViewer } from "@/server/auth/dal";
import { getThread, listComments, type CommentSort } from "@/server/comments";
import { db } from "@/server/db";
import { posts } from "@/server/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store" };

/*
 * Discussion reads for "load more" and "view replies". Members only — the
 * discussion is gated content, so anonymous requests get 401 and no data.
 *   GET /api/comments?post=<id>&sort=top|new&offset=15
 *   GET /api/comments?thread=<rootCommentId>
 */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthenticated" }, { status: 401, headers: noStore });

  const params = new URL(request.url).searchParams;
  const thread = params.get("thread");
  if (thread) {
    if (!UUID.test(thread)) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
    const result = await getThread(thread, viewer);
    return result ? Response.json(result, { headers: noStore }) : Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  }

  const postId = params.get("post") ?? "";
  if (!UUID.test(postId)) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
    .limit(1);
  if (!post) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });

  const sort: CommentSort = params.get("sort") === "new" ? "new" : "top";
  const offset = Math.min(Math.max(Number.parseInt(params.get("offset") ?? "0", 10) || 0, 0), 5000);
  return Response.json(await listComments(postId, viewer, { sort, offset }), { headers: noStore });
}
