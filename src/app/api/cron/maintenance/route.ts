import { revalidateTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { publishScheduled, purgeExpired, reconcileCounters } from "@/server/maintenance";

/*
 * Scheduled housekeeping (Vercel Cron, see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const published = await publishScheduled();
  await purgeExpired();
  await reconcileCounters();

  if (published > 0) {
    revalidateTag(TAGS.posts, "max");
    revalidateTag(TAGS.stats, "max");
  }
  revalidateTag(TAGS.trending, "max");

  return Response.json({ ok: true, published });
}
