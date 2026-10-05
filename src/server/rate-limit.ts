import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/db";

/*
 * Fixed-window rate limiter backed by Postgres (one upsert per check), so it
 * needs no extra infrastructure and works across serverless instances.
 * Old windows are purged by the maintenance cron.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; remaining: number }> {
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `);
  const count = Number(result.rows[0]?.count ?? 1);
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

/** Several limits at once (e.g. per minute AND per day); all must pass. */
export async function rateLimitAll(checks: { key: string; limit: number; windowSeconds: number }[]): Promise<boolean> {
  const results = await Promise.all(checks.map((c) => rateLimit(c.key, c.limit, c.windowSeconds)));
  return results.every((r) => r.ok);
}
