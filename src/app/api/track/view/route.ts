import { and, eq, lte, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { postStats, postViewsDaily, posts, viewDedupe } from "@/server/db/schema";
import { rateLimit } from "@/server/rate-limit";
import { isBot, today, visitorHash } from "@/server/visitor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * View beacon. Pages are served from cache, so views are counted by a tiny
 * client beacon instead of the render. One view per visitor per post per
 * day; bots are ignored. Always answers 204 — it never reveals anything.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  try {
    if (isBot(request.headers.get("user-agent"))) return done;

    const body = (await request.json().catch(() => null)) as { postId?: unknown } | null;
    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!UUID.test(postId)) return done;

    const day = today();
    const hash = visitorHash(request.headers, day);
    if (!(await rateLimit(`view:${hash}`, 120, 60)).ok) return done;

    await db.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
        .limit(1)
        // Holds off a concurrent delete of the post until the view is recorded.
        .for("share");
      if (!post) return;

      const first = await tx.insert(viewDedupe).values({ postId, day, visitorHash: hash }).onConflictDoNothing().returning({ postId: viewDedupe.postId });
      if (first.length === 0) return;

      await tx
        .insert(postViewsDaily)
        .values({ postId, day, views: 1 })
        .onConflictDoUpdate({ target: [postViewsDaily.postId, postViewsDaily.day], set: { views: sql`${postViewsDaily.views} + 1` } });
      await tx
        .insert(postStats)
        .values({ postId, viewCount: 1 })
        .onConflictDoUpdate({ target: postStats.postId, set: { viewCount: sql`${postStats.viewCount} + 1` } });
    });
  } catch (error) {
    console.error("view beacon failed", error);
  }
  return done;
}
