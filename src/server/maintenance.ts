import { sql } from "drizzle-orm";

import { db } from "./db";

/*
 * Housekeeping run by the daily cron (and by the e2e test clean-up).
 * No "server-only" import: scripts and tests load this too.
 */

/** Recomputes every denormalised counter from the source rows. Safe to run at any time. */
export async function reconcileCounters(): Promise<void> {
  await db.execute(sql`
    INSERT INTO post_stats (post_id) SELECT id FROM posts ON CONFLICT (post_id) DO NOTHING
  `);
  await db.execute(sql`
    UPDATE post_stats s SET
      like_count = (SELECT count(*) FROM post_likes l WHERE l.post_id = s.post_id),
      save_count = (SELECT count(*) FROM post_saves v WHERE v.post_id = s.post_id),
      comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = s.post_id AND c.status <> 'deleted'),
      view_count = (SELECT coalesce(sum(views), 0) FROM post_views_daily d WHERE d.post_id = s.post_id),
      share_count = (
        SELECT count(*) FROM (
          SELECT 1 FROM share_events e WHERE e.post_id = s.post_id
          GROUP BY coalesce(e.user_id, e.visitor_hash, e.id::text), e.created_at::date
        ) once
      )
  `);
  await db.execute(sql`
    UPDATE comments c SET
      like_count = (SELECT count(*) FROM comment_likes l WHERE l.comment_id = c.id),
      reply_count = (SELECT count(*) FROM comments r WHERE r.root_id = c.id AND r.status <> 'deleted')
  `);
}

/** Drops short-lived rows that are no longer needed. */
export async function purgeExpired(): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`);
  await db.execute(sql`DELETE FROM view_dedupe WHERE day < current_date - 2`);
  await db.execute(sql`DELETE FROM import_batches WHERE status = 'previewed' AND created_at < now() - interval '14 days'`);
  await db.execute(sql`DELETE FROM notifications WHERE created_at < now() - interval '180 days'`);
}

/** Publishes posts whose scheduled time has arrived. Returns how many went live. */
export async function publishScheduled(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE posts SET status = 'published' WHERE status = 'scheduled' AND published_at <= now() RETURNING id
  `);
  return result.rows.length;
}
