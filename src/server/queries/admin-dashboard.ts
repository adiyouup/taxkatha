import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/db";

/* The admin dashboard. Staff only; aggregates plus the latest activity. */

const utcToday = sql`(now() at time zone 'utc')::date`;

export async function getDashboard() {
  const [kpis, series, top, recent, lastImport, scheduled] = await Promise.all([
    db.execute<Record<string, number>>(sql`
      SELECT
        (SELECT count(*) FROM posts WHERE type = 'case_law' AND status = 'published')::int AS cases,
        (SELECT count(*) FROM posts WHERE type = 'case_law' AND status <> 'published')::int AS cases_hidden,
        (SELECT count(*) FROM posts WHERE type = 'insight' AND status = 'published')::int AS insights,
        (SELECT count(*) FROM posts WHERE type = 'insight' AND status IN ('draft', 'scheduled'))::int AS insights_pending,
        (SELECT count(*) FROM "user")::int AS members,
        (SELECT count(*) FROM "user" WHERE created_at > now() - interval '7 days')::int AS members_7,
        (SELECT count(*) FROM "user" WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days')::int AS members_prev,
        (SELECT coalesce(sum(views), 0) FROM post_views_daily WHERE day > ${utcToday} - 7)::int AS views_7,
        (SELECT coalesce(sum(views), 0) FROM post_views_daily WHERE day > ${utcToday} - 14 AND day <= ${utcToday} - 7)::int AS views_prev,
        (SELECT count(*) FROM comments WHERE created_at > now() - interval '7 days' AND status <> 'deleted')::int AS comments_7,
        (SELECT count(*) FROM comments WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days' AND status <> 'deleted')::int AS comments_prev,
        (SELECT count(*) FROM post_likes WHERE created_at > now() - interval '7 days')::int AS likes_7,
        (SELECT count(*) FROM post_likes WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days')::int AS likes_prev,
        (SELECT count(*) FROM share_events WHERE created_at > now() - interval '7 days')::int AS shares_7,
        (SELECT count(*) FROM share_events WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days')::int AS shares_prev,
        (SELECT count(DISTINCT comment_id) FROM reports WHERE status = 'open')::int AS open_reports,
        (SELECT count(*) FROM topics WHERE reviewed IS FALSE)::int AS unreviewed_topics,
        (SELECT count(*) FROM posts WHERE boost_rank IS NOT NULL AND boost_until < now())::int AS expired_features
    `),
    db.execute<{ day: string; views: number; members: number; comments: number }>(sql`
      WITH days AS (SELECT generate_series(${utcToday} - 29, ${utcToday}, interval '1 day')::date AS day)
      SELECT d.day::text AS day,
        coalesce((SELECT sum(views) FROM post_views_daily v WHERE v.day = d.day), 0)::int AS views,
        coalesce((SELECT count(*) FROM "user" u WHERE (u.created_at at time zone 'utc')::date = d.day), 0)::int AS members,
        coalesce((SELECT count(*) FROM comments c WHERE (c.created_at at time zone 'utc')::date = d.day AND c.status <> 'deleted'), 0)::int AS comments
      FROM days d ORDER BY d.day
    `),
    db.execute<{ id: string; slug: string; type: "case_law" | "insight"; title: string; views: number; likes: number; comments: number }>(sql`
      SELECT p.id, p.slug, p.type, p.title, coalesce(v.n, 0)::int AS views, coalesce(l.n, 0)::int AS likes, coalesce(c.n, 0)::int AS comments
      FROM posts p
      LEFT JOIN (SELECT post_id, sum(views) AS n FROM post_views_daily WHERE day > ${utcToday} - 7 GROUP BY post_id) v ON v.post_id = p.id
      LEFT JOIN (SELECT post_id, count(*) AS n FROM post_likes WHERE created_at > now() - interval '7 days' GROUP BY post_id) l ON l.post_id = p.id
      LEFT JOIN (SELECT post_id, count(*) AS n FROM comments WHERE created_at > now() - interval '7 days' AND status <> 'deleted' GROUP BY post_id) c ON c.post_id = p.id
      WHERE p.status = 'published' AND (v.n > 0 OR l.n > 0 OR c.n > 0)
      ORDER BY coalesce(v.n, 0) + 4 * coalesce(l.n, 0) + 6 * coalesce(c.n, 0) DESC, p.title
      LIMIT 6
    `),
    db.execute<{ id: string; root_id: string | null; body: string; status: string; created_at: string | Date; author: string | null; post_title: string; post_slug: string; post_type: string }>(sql`
      SELECT c.id, c.root_id, c.body, c.status, c.created_at, u.name AS author, p.title AS post_title, p.slug AS post_slug, p.type AS post_type
      FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN "user" u ON u.id = c.user_id
      WHERE c.status <> 'deleted'
      ORDER BY c.created_at DESC LIMIT 6
    `),
    db.execute<{ id: string; filename: string; status: string; created_at: string | Date; counts: { new: number; changed: number; total: number } }>(sql`
      SELECT id, filename, status, created_at, counts FROM import_batches ORDER BY created_at DESC LIMIT 1
    `),
    db.execute<{ id: string; title: string; published_at: string | Date }>(sql`
      SELECT id, title, published_at FROM posts WHERE status = 'scheduled' ORDER BY published_at LIMIT 4
    `),
  ]);

  const k = kpis.rows[0] ?? {};
  const n = (key: string) => Number(k[key] ?? 0);
  return {
    kpis: {
      cases: n("cases"),
      casesHidden: n("cases_hidden"),
      insights: n("insights"),
      insightsPending: n("insights_pending"),
      members: n("members"),
      members7: { current: n("members_7"), previous: n("members_prev") },
      views7: { current: n("views_7"), previous: n("views_prev") },
      comments7: { current: n("comments_7"), previous: n("comments_prev") },
      likes7: { current: n("likes_7"), previous: n("likes_prev") },
      shares7: { current: n("shares_7"), previous: n("shares_prev") },
      openReports: n("open_reports"),
      unreviewedTopics: n("unreviewed_topics"),
      expiredFeatures: n("expired_features"),
    },
    series: {
      days: series.rows.map((r) => r.day),
      views: series.rows.map((r) => r.views),
      members: series.rows.map((r) => r.members),
      comments: series.rows.map((r) => r.comments),
    },
    topPosts: top.rows,
    recentComments: recent.rows.map((c) => ({
      id: c.id,
      body: c.body,
      status: c.status,
      createdAt: new Date(c.created_at),
      author: c.author ?? "Former member",
      postTitle: c.post_title,
      path: `/${c.post_type === "insight" ? "insights" : "case-laws"}/${c.post_slug}/thread/${c.root_id ?? c.id}`,
    })),
    lastImport: lastImport.rows[0] ? { ...lastImport.rows[0], createdAt: new Date(lastImport.rows[0].created_at) } : null,
    scheduled: scheduled.rows.map((s) => ({ id: s.id, title: s.title, at: new Date(s.published_at) })),
  };
}

/** Open reports, for the badge in the admin navigation. */
export async function countOpenReports(): Promise<number> {
  const result = await db.execute<{ n: number }>(sql`SELECT count(DISTINCT comment_id)::int AS n FROM reports WHERE status = 'open'`);
  return result.rows[0]?.n ?? 0;
}
