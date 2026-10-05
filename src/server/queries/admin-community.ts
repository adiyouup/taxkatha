import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { highestRole, type Role } from "@/server/auth/permissions";
import { db } from "@/server/db";

/* Moderation reads. Callers must have checked the moderator role. */

export const COMMENTS_ADMIN_PAGE_SIZE = 30;
export const COMMENT_STATUSES = ["visible", "hidden", "deleted"] as const;

export type ModerationComment = {
  id: string;
  rootId: string | null;
  body: string;
  status: (typeof COMMENT_STATUSES)[number];
  createdAt: Date;
  editedAt: Date | null;
  likeCount: number;
  replyCount: number;
  author: { id: string | null; name: string; email: string | null; role: Role; banned: boolean };
  post: { id: string; title: string; slug: string; type: "case_law" | "insight" };
  reports: { count: number; reasons: string[]; notes: string[]; lastAt: Date } | null;
};

type Row = {
  id: string;
  root_id: string | null;
  body: string;
  status: ModerationComment["status"];
  created_at: string | Date;
  edited_at: string | Date | null;
  like_count: number;
  reply_count: number;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  author_role: string | null;
  author_banned: boolean | null;
  post_id: string;
  post_title: string;
  post_slug: string;
  post_type: "case_law" | "insight";
  report_count: number | null;
  reasons: string[] | null;
  notes: string[] | null;
  last_reported: string | Date | null;
};

function toItem(row: Row): ModerationComment {
  return {
    id: row.id,
    rootId: row.root_id,
    body: row.body,
    status: row.status,
    createdAt: new Date(row.created_at),
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    likeCount: row.like_count,
    replyCount: row.reply_count,
    author: {
      id: row.author_id,
      name: row.author_name ?? "Former member",
      email: row.author_email,
      role: highestRole(row.author_role),
      banned: row.author_banned ?? false,
    },
    post: { id: row.post_id, title: row.post_title, slug: row.post_slug, type: row.post_type },
    reports:
      row.report_count && row.report_count > 0
        ? { count: row.report_count, reasons: row.reasons ?? [], notes: row.notes ?? [], lastAt: new Date(row.last_reported!) }
        : null,
  };
}

const SELECT = sql`
  c.id, c.root_id, c.body, c.status, c.created_at, c.edited_at, c.like_count, c.reply_count,
  u.id AS author_id, u.name AS author_name, u.email AS author_email, u.role AS author_role, u.banned AS author_banned,
  p.id AS post_id, p.title AS post_title, p.slug AS post_slug, p.type AS post_type,
  r.report_count, r.reasons, r.notes, r.last_reported
`;

const OPEN_REPORTS = sql`
  SELECT comment_id, count(*)::int AS report_count,
    array_agg(DISTINCT reason::text) AS reasons,
    array_remove(array_agg(note ORDER BY created_at DESC), NULL) AS notes,
    max(created_at) AS last_reported
  FROM reports WHERE status = 'open' GROUP BY comment_id
`;

/** Comments with open reports, most-reported first. */
export async function listReportedComments(limit = 100): Promise<ModerationComment[]> {
  const result = await db.execute<Row>(sql`
    SELECT ${SELECT}
    FROM (${OPEN_REPORTS}) r
    JOIN comments c ON c.id = r.comment_id
    JOIN posts p ON p.id = c.post_id
    LEFT JOIN "user" u ON u.id = c.user_id
    ORDER BY r.report_count DESC, r.last_reported DESC
    LIMIT ${limit}
  `);
  return result.rows.map(toItem);
}

/** The comment feed, newest first. */
export async function listCommentsAdmin(
  filters: { status?: (typeof COMMENT_STATUSES)[number]; q?: string; author?: string },
  page: number,
): Promise<{ items: ModerationComment[]; total: number }> {
  const conditions: SQL[] = [sql`true`];
  if (filters.status) conditions.push(sql`c.status = ${filters.status}`);
  if (filters.author) conditions.push(sql`c.user_id = ${filters.author}`);
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(sql`(c.body ILIKE ${pattern} OR u.name ILIKE ${pattern} OR p.title ILIKE ${pattern})`);
  }
  const where = sql.join(conditions, sql` AND `);

  const [rows, total] = await Promise.all([
    db.execute<Row>(sql`
      SELECT ${SELECT}
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      LEFT JOIN "user" u ON u.id = c.user_id
      LEFT JOIN (${OPEN_REPORTS}) r ON r.comment_id = c.id
      WHERE ${where}
      ORDER BY c.created_at DESC, c.id
      LIMIT ${COMMENTS_ADMIN_PAGE_SIZE} OFFSET ${(page - 1) * COMMENTS_ADMIN_PAGE_SIZE}
    `),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN "user" u ON u.id = c.user_id WHERE ${where}
    `),
  ]);
  return { items: rows.rows.map(toItem), total: total.rows[0]?.n ?? 0 };
}

export async function communityCounts(): Promise<{ openReports: number; hidden: number; comments: number }> {
  const result = await db.execute<{ open_reports: number; hidden: number; comments: number }>(sql`
    SELECT
      (SELECT count(DISTINCT comment_id) FROM reports WHERE status = 'open')::int AS open_reports,
      (SELECT count(*) FROM comments WHERE status = 'hidden')::int AS hidden,
      (SELECT count(*) FROM comments)::int AS comments
  `);
  const row = result.rows[0];
  return { openReports: row?.open_reports ?? 0, hidden: row?.hidden ?? 0, comments: row?.comments ?? 0 };
}
