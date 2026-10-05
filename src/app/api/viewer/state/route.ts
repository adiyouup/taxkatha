import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { getViewer } from "@/server/auth/dal";
import { db } from "@/server/db";
import { notifications, postLikes, postSaves } from "@/server/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The signed-in member's state for the posts on screen (which are liked,
 * which are saved) plus their unread notification count. Lists themselves
 * stay cacheable; this small per-viewer read is fetched by the client.
 */
export async function GET(request: Request) {
  const viewer = await getViewer();
  const empty = { signedIn: false, liked: [] as string[], saved: [] as string[], unread: 0 };
  if (!viewer) return Response.json(empty, { headers: { "Cache-Control": "private, no-store" } });

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => UUID.test(id))
    .slice(0, 60);

  const [liked, saved, unread] = await Promise.all([
    ids.length > 0
      ? db.select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, viewer.id), inArray(postLikes.postId, ids)))
      : [],
    ids.length > 0
      ? db.select({ postId: postSaves.postId }).from(postSaves).where(and(eq(postSaves.userId, viewer.id), inArray(postSaves.postId, ids)))
      : [],
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, viewer.id), isNull(notifications.readAt))),
  ]);

  return Response.json(
    { signedIn: true, liked: liked.map((r) => r.postId), saved: saved.map((r) => r.postId), unread: unread[0]?.n ?? 0 },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
