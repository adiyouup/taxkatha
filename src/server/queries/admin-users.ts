import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { highestRole, type Role } from "@/server/auth/permissions";
import { db } from "@/server/db";

/* Member administration reads. Personal data: callers must have checked the ADMIN role. */

export const USERS_PAGE_SIZE = 40;
export const USER_VIEWS = ["staff", "banned", "opted_in", "new"] as const;

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  banned: boolean;
  profession: string | null;
  createdAt: Date;
  onboarded: boolean;
  optIn: boolean;
  comments: number;
  lastActive: Date | null;
  providers: string[];
};

type RawUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  profession: string | null;
  created_at: string | Date;
  onboarded_at: string | Date | null;
  marketing_opt_in: boolean | null;
  comments: number;
  last_active: string | Date | null;
  providers: string[] | null;
};

const toRow = (row: RawUser): AdminUserRow => ({
  id: row.id,
  name: row.name,
  email: row.email,
  image: row.image && !row.image.startsWith("data:") ? row.image : null,
  role: highestRole(row.role),
  banned: row.banned ?? false,
  profession: row.profession,
  createdAt: new Date(row.created_at),
  onboarded: row.onboarded_at !== null,
  optIn: row.marketing_opt_in ?? false,
  comments: row.comments,
  lastActive: row.last_active ? new Date(row.last_active) : null,
  providers: row.providers ?? [],
});

const COLUMNS = sql`
  u.id, u.name, u.email, u.image, u.role, u.banned, u.profession, u.created_at, u.onboarded_at, u.marketing_opt_in,
  (SELECT count(*) FROM comments c WHERE c.user_id = u.id AND c.status <> 'deleted')::int AS comments,
  (SELECT max(s.updated_at) FROM session s WHERE s.user_id = u.id) AS last_active,
  (SELECT array_agg(DISTINCT a.provider_id) FROM account a WHERE a.user_id = u.id) AS providers
`;

export async function listUsersAdmin(filters: { q?: string; view?: (typeof USER_VIEWS)[number] }, page: number): Promise<{ rows: AdminUserRow[]; total: number }> {
  const conditions: SQL[] = [sql`true`];
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(sql`(u.name ILIKE ${pattern} OR u.email ILIKE ${pattern})`);
  }
  if (filters.view === "staff") conditions.push(sql`(u.role LIKE '%admin%' OR u.role LIKE '%moderator%')`);
  if (filters.view === "banned") conditions.push(sql`u.banned IS TRUE`);
  if (filters.view === "opted_in") conditions.push(sql`u.marketing_opt_in IS TRUE`);
  if (filters.view === "new") conditions.push(sql`u.created_at > now() - interval '30 days'`);
  const where = sql.join(conditions, sql` AND `);

  const [rows, total] = await Promise.all([
    db.execute<RawUser>(sql`SELECT ${COLUMNS} FROM "user" u WHERE ${where} ORDER BY u.created_at DESC, u.id LIMIT ${USERS_PAGE_SIZE} OFFSET ${(page - 1) * USERS_PAGE_SIZE}`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM "user" u WHERE ${where}`),
  ]);
  return { rows: rows.rows.map(toRow), total: total.rows[0]?.n ?? 0 };
}

export async function countUsers(): Promise<Record<"all" | (typeof USER_VIEWS)[number], number>> {
  const result = await db.execute<{ all: number; staff: number; banned: number; opted_in: number; new: number }>(sql`
    SELECT count(*)::int AS all,
      count(*) FILTER (WHERE role LIKE '%admin%' OR role LIKE '%moderator%')::int AS staff,
      count(*) FILTER (WHERE banned IS TRUE)::int AS banned,
      count(*) FILTER (WHERE marketing_opt_in IS TRUE)::int AS opted_in,
      count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new
    FROM "user"
  `);
  const row = result.rows[0];
  return { all: row?.all ?? 0, staff: row?.staff ?? 0, banned: row?.banned ?? 0, opted_in: row?.opted_in ?? 0, new: row?.new ?? 0 };
}

export async function getUserAdmin(id: string) {
  const users = await db.execute<
    RawUser & {
      headline: string | null;
      email_verified: boolean;
      ban_reason: string | null;
      ban_expires: string | Date | null;
      sessions: number;
      likes: number;
      saves: number;
      reports_filed: number;
      reports_against: number;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      landing_path: string | null;
      referrer: string | null;
      ref_user_id: string | null;
      ref_user_name: string | null;
      referred: number;
    }
  >(sql`
    SELECT ${COLUMNS}, u.headline, u.email_verified, u.ban_reason, u.ban_expires,
      (SELECT count(*) FROM session s WHERE s.user_id = u.id AND s.expires_at > now())::int AS sessions,
      (SELECT count(*) FROM post_likes l WHERE l.user_id = u.id)::int AS likes,
      (SELECT count(*) FROM post_saves v WHERE v.user_id = u.id)::int AS saves,
      (SELECT count(*) FROM reports r WHERE r.reporter_id = u.id)::int AS reports_filed,
      (SELECT count(*) FROM reports r JOIN comments c ON c.id = r.comment_id WHERE c.user_id = u.id)::int AS reports_against,
      q.utm_source, q.utm_medium, q.utm_campaign, q.landing_path, q.referrer, q.ref_user_id, ru.name AS ref_user_name,
      (SELECT count(*) FROM user_acquisition x WHERE x.ref_user_id = u.id)::int AS referred
    FROM "user" u
    LEFT JOIN user_acquisition q ON q.user_id = u.id
    LEFT JOIN "user" ru ON ru.id = q.ref_user_id
    WHERE u.id = ${id}
  `);
  const row = users.rows[0];
  if (!row) return null;

  const recent = await db.execute<{ id: string; root_id: string | null; body: string; status: string; created_at: string | Date; post_title: string; post_slug: string; post_type: string }>(sql`
    SELECT c.id, c.root_id, c.body, c.status, c.created_at, p.title AS post_title, p.slug AS post_slug, p.type AS post_type
    FROM comments c JOIN posts p ON p.id = c.post_id
    WHERE c.user_id = ${id}
    ORDER BY c.created_at DESC LIMIT 8
  `);

  return {
    ...toRow(row),
    headline: row.headline,
    emailVerified: row.email_verified,
    banReason: row.ban_reason,
    banExpires: row.ban_expires ? new Date(row.ban_expires) : null,
    sessions: row.sessions,
    likes: row.likes,
    saves: row.saves,
    reportsFiled: row.reports_filed,
    reportsAgainst: row.reports_against,
    referred: row.referred,
    acquisition: {
      source: row.utm_source,
      medium: row.utm_medium,
      campaign: row.utm_campaign,
      landingPath: row.landing_path,
      referrer: row.referrer,
      refUser: row.ref_user_id ? { id: row.ref_user_id, name: row.ref_user_name ?? "a member" } : null,
    },
    recentComments: recent.rows.map((c) => ({
      id: c.id,
      body: c.body,
      status: c.status,
      createdAt: new Date(c.created_at),
      path: `/${c.post_type === "insight" ? "insights" : "case-laws"}/${c.post_slug}/thread/${c.root_id ?? c.id}`,
      postTitle: c.post_title,
    })),
  };
}

/** Members who agreed to marketing email, for the CSV export. */
export async function listOptedInMembers() {
  const result = await db.execute<{ name: string; email: string; profession: string | null; created_at: string | Date; utm_source: string | null; utm_campaign: string | null }>(sql`
    SELECT u.name, u.email, u.profession, u.created_at, q.utm_source, q.utm_campaign
    FROM "user" u LEFT JOIN user_acquisition q ON q.user_id = u.id
    WHERE u.marketing_opt_in IS TRUE AND u.banned IS NOT TRUE
    ORDER BY u.created_at
  `);
  return result.rows;
}
