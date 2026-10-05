import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { importBatches, importBatchRows, user } from "@/server/db/schema";
import type { RowStatus } from "@/server/import/store";

/* Admin-only reads. Callers must have passed requireRolePage("admin"). */

export async function listImportBatches(limit = 30) {
  return db
    .select({
      id: importBatches.id,
      filename: importBatches.filename,
      fileSize: importBatches.fileSize,
      status: importBatches.status,
      counts: importBatches.counts,
      options: importBatches.options,
      createdAt: importBatches.createdAt,
      committedAt: importBatches.committedAt,
      uploaderName: user.name,
    })
    .from(importBatches)
    .leftJoin(user, eq(user.id, importBatches.uploadedBy))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit);
}

export async function getImportBatch(id: string) {
  const [batch] = await db
    .select({
      id: importBatches.id,
      filename: importBatches.filename,
      fileSize: importBatches.fileSize,
      fileSha256: importBatches.fileSha256,
      status: importBatches.status,
      counts: importBatches.counts,
      report: importBatches.report,
      options: importBatches.options,
      createdAt: importBatches.createdAt,
      committedAt: importBatches.committedAt,
      uploaderName: user.name,
    })
    .from(importBatches)
    .leftJoin(user, eq(user.id, importBatches.uploadedBy))
    .where(eq(importBatches.id, id))
    .limit(1);
  return batch ?? null;
}

export const IMPORT_ROWS_PAGE_SIZE = 25;

export async function listImportRows(batchId: string, options: { status?: RowStatus; issuesOnly?: boolean; page: number }) {
  const filters = [eq(importBatchRows.batchId, batchId)];
  if (options.status) filters.push(eq(importBatchRows.status, options.status));
  if (options.issuesOnly) filters.push(sql`jsonb_array_length(${importBatchRows.issues}) > 0`);
  const where = and(...filters);

  const [total] = await db.select({ n: count() }).from(importBatchRows).where(where);
  const rows = await db
    .select({
      rowNumber: importBatchRows.rowNumber,
      status: importBatchRows.status,
      postId: importBatchRows.postId,
      issues: importBatchRows.issues,
      changedFields: importBatchRows.changedFields,
      // Only what the table shows — the full payload can be megabytes.
      caseName: sql<string | null>`${importBatchRows.data}->>'caseName'`,
      courtName: sql<string | null>`${importBatchRows.data}#>>'{court,shortName}'`,
      decisionDate: sql<string | null>`${importBatchRows.data}->>'decisionDate'`,
      outcomeSide: sql<string | null>`${importBatchRows.data}->>'outcomeSide'`,
      remanded: sql<boolean | null>`(${importBatchRows.data}->>'remanded')::boolean`,
      domainLabel: sql<string | null>`${importBatchRows.data}->>'domainLabel'`,
      topicLabel: sql<string | null>`${importBatchRows.data}->>'topicLabel'`,
      topicKey: sql<string | null>`${importBatchRows.data}->>'topicKey'`,
      summary: sql<string | null>`left(${importBatchRows.data}->>'summary', 320)`,
      sectionRefs: sql<string[] | null>`${importBatchRows.data}->'sectionRefs'`,
      rawName: sql<string | null>`${importBatchRows.data}#>>'{raw,caseName}'`,
    })
    .from(importBatchRows)
    .where(where)
    .orderBy(importBatchRows.rowNumber)
    .limit(IMPORT_ROWS_PAGE_SIZE)
    .offset((options.page - 1) * IMPORT_ROWS_PAGE_SIZE);

  return { rows, total: total?.n ?? 0 };
}
