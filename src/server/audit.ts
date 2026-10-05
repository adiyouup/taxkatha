import type { DbOrTx } from "./db";
import { auditLog } from "./db/schema";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
};

/** Every admin mutation records who did what. Call inside the same transaction as the change. */
export async function writeAudit(conn: DbOrTx, entry: AuditEntry): Promise<void> {
  await conn.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    meta: entry.meta,
  });
}
