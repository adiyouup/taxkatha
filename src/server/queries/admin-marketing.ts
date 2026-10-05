import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/db";

/* Growth reporting for administrators. Aggregates only — no personal data leaves these queries. */

export const MARKETING_PERIODS = ["7", "30", "90"] as const;

const utcToday = sql`(now() at time zone 'utc')::date`;

export async function getMarketingReport(days: number) {
  const since = sql`now() - make_interval(days => ${days})`;
  const before = sql`now() - make_interval(days => ${days * 2})`;

  const [totals, series, sources, campaigns, referrers, channels, shared, professions, landing] = await Promise.all([
    db.execute<{ signups: number; previous: number; members: number; opted_in: number; onboarded: number }>(sql`
      SELECT
        count(*) FILTER (WHERE created_at > ${since})::int AS signups,
        count(*) FILTER (WHERE created_at > ${before} AND created_at <= ${since})::int AS previous,
        count(*)::int AS members,
        count(*) FILTER (WHERE marketing_opt_in IS TRUE)::int AS opted_in,
        count(*) FILTER (WHERE onboarded_at IS NOT NULL)::int AS onboarded
      FROM "user"
    `),
    db.execute<{ day: string; signups: number; shares: number }>(sql`
      WITH days AS (SELECT generate_series(${utcToday} - ${days - 1}::int, ${utcToday}, interval '1 day')::date AS day)
      SELECT d.day::text AS day,
        coalesce((SELECT count(*) FROM "user" u WHERE (u.created_at at time zone 'utc')::date = d.day), 0)::int AS signups,
        coalesce((SELECT count(*) FROM share_events e WHERE (e.created_at at time zone 'utc')::date = d.day), 0)::int AS shares
      FROM days d ORDER BY d.day
    `),
    db.execute<{ source: string; signups: number; onboarded: number; opted_in: number }>(sql`
      SELECT coalesce(nullif(q.utm_source, ''), 'Direct or unknown') AS source,
        count(*)::int AS signups,
        count(*) FILTER (WHERE u.onboarded_at IS NOT NULL)::int AS onboarded,
        count(*) FILTER (WHERE u.marketing_opt_in IS TRUE)::int AS opted_in
      FROM "user" u LEFT JOIN user_acquisition q ON q.user_id = u.id
      WHERE u.created_at > ${since}
      GROUP BY 1 ORDER BY signups DESC, source LIMIT 12
    `),
    db.execute<{ campaign: string; source: string | null; signups: number }>(sql`
      SELECT q.utm_campaign AS campaign, max(q.utm_source) AS source, count(*)::int AS signups
      FROM user_acquisition q JOIN "user" u ON u.id = q.user_id
      WHERE u.created_at > ${since} AND coalesce(q.utm_campaign, '') <> ''
      GROUP BY q.utm_campaign ORDER BY signups DESC LIMIT 10
    `),
    db.execute<{ id: string; name: string; referred: number }>(sql`
      SELECT r.id, r.name, count(*)::int AS referred
      FROM user_acquisition q JOIN "user" u ON u.id = q.user_id JOIN "user" r ON r.id = q.ref_user_id
      WHERE u.created_at > ${since}
      GROUP BY r.id, r.name ORDER BY referred DESC LIMIT 10
    `),
    db.execute<{ channel: string; shares: number }>(sql`
      SELECT channel::text AS channel, count(*)::int AS shares FROM share_events WHERE created_at > ${since} GROUP BY channel ORDER BY shares DESC
    `),
    db.execute<{ id: string; title: string; slug: string; type: string; shares: number }>(sql`
      SELECT p.id, p.title, p.slug, p.type, count(*)::int AS shares
      FROM share_events e JOIN posts p ON p.id = e.post_id
      WHERE e.created_at > ${since}
      GROUP BY p.id ORDER BY shares DESC, p.title LIMIT 8
    `),
    db.execute<{ profession: string | null; members: number }>(sql`
      SELECT profession, count(*)::int AS members FROM "user" GROUP BY profession ORDER BY members DESC
    `),
    db.execute<{ path: string; signups: number }>(sql`
      SELECT q.landing_path AS path, count(*)::int AS signups
      FROM user_acquisition q JOIN "user" u ON u.id = q.user_id
      WHERE u.created_at > ${since} AND coalesce(q.landing_path, '') <> ''
      GROUP BY q.landing_path ORDER BY signups DESC LIMIT 8
    `),
  ]);

  const t = totals.rows[0] ?? { signups: 0, previous: 0, members: 0, opted_in: 0, onboarded: 0 };
  return {
    signups: t.signups,
    previousSignups: t.previous,
    members: t.members,
    optedIn: t.opted_in,
    onboarded: t.onboarded,
    series: { days: series.rows.map((r) => r.day), signups: series.rows.map((r) => r.signups), shares: series.rows.map((r) => r.shares) },
    sources: sources.rows,
    campaigns: campaigns.rows,
    referrers: referrers.rows,
    channels: channels.rows,
    shared: shared.rows,
    professions: professions.rows,
    landing: landing.rows,
  };
}
