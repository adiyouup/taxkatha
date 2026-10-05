import "server-only";

import { and, count, desc, eq, ilike, like, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import { auditLog, user } from "@/server/db/schema";

/* The audit log. Administrators only. */

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_AREAS = {
  case: "Case laws",
  post: "Bulk post changes",
  insight: "Insights",
  import: "Imports",
  featured: "Featured",
  topic: "Topics",
  court: "Courts",
  comment: "Moderation",
  user: "Members",
  settings: "Settings",
} as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

export async function listAudit(filters: { area?: AuditArea; actor?: string; q?: string }, page: number) {
  const conditions: SQL[] = [];
  if (filters.area) conditions.push(like(auditLog.action, `${filters.area}.%`));
  if (filters.actor) conditions.push(eq(auditLog.actorId, filters.actor));
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(auditLog.summary, pattern), ilike(auditLog.action, pattern))!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        summary: auditLog.summary,
        createdAt: auditLog.createdAt,
        actorId: auditLog.actorId,
        actorName: user.name,
      })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorId))
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ n: count() }).from(auditLog).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

/** Everyone who has an entry in the log, for the filter. */
export async function listAuditActors() {
  const result = await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT u.id, u.name FROM audit_log a JOIN "user" u ON u.id = a.actor_id ORDER BY u.name
  `);
  return result.rows;
}
