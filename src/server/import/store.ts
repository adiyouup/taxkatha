import { createHash, randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { writeAudit } from "../audit";
import { db, type DbOrTx } from "../db";
import {
  caseLawDetails,
  courts,
  importBatches,
  importBatchRows,
  postRevisions,
  postStats,
  posts,
  slugHistory,
  type ImportCounts,
  type ImportIssue,
  type ImportReport,
} from "../db/schema";
import { refreshSearchVectors } from "../search/vectors";
import { normalizedCaseSchema, normalizeRow, type NormalizedCase } from "./normalize";
import { parseWorkbook } from "./parse";
import { loadAliasMap, resolveCourts, resolveTopics } from "./taxonomy";
import { DEFAULT_ALIAS_INDEX } from "./topics";

/*
 * Database side of the Excel import. Two steps so an admin can review before
 * anything is published:
 *
 *   createImportPreview → parses + normalises the file, diffs it against the
 *                         database and stores the result (no content changes)
 *   commitImportBatch   → applies a previewed batch in one transaction
 *
 * Shared by the admin UI and the seed CLI, so it must not import Next.js
 * runtime modules or "server-only".
 */

export type RowStatus = "new" | "changed" | "unchanged" | "skipped_manual_edit" | "invalid" | "duplicate";

/** The batch is not in a state that allows the requested operation. */
export class ImportStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportStateError";
  }
}

const emptyCounts = (): ImportCounts => ({
  total: 0,
  new: 0,
  changed: 0,
  unchanged: 0,
  skipped_manual_edit: 0,
  invalid: 0,
  duplicate: 0,
});

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type StoredCase = {
  postId: string;
  sourceKey: string;
  contentHash: string;
  manuallyEditedAt: Date | null;
};

async function loadStored(conn: DbOrTx, sourceKeys: string[], ids: string[]) {
  const bySourceKey = new Map<string, StoredCase>();
  const byId = new Map<string, StoredCase>();
  const columns = {
    postId: caseLawDetails.postId,
    sourceKey: caseLawDetails.sourceKey,
    contentHash: caseLawDetails.contentHash,
    manuallyEditedAt: caseLawDetails.manuallyEditedAt,
  };
  for (const part of chunk([...new Set(sourceKeys)], 1000)) {
    for (const row of await conn.select(columns).from(caseLawDetails).where(inArray(caseLawDetails.sourceKey, part))) {
      bySourceKey.set(row.sourceKey, row);
      byId.set(row.postId, row);
    }
  }
  for (const part of chunk([...new Set(ids)], 1000)) {
    for (const row of await conn.select(columns).from(caseLawDetails).where(inArray(caseLawDetails.postId, part))) {
      bySourceKey.set(row.sourceKey, row);
      byId.set(row.postId, row);
    }
  }
  return { bySourceKey, byId };
}

/** Which stored post (if any) an incoming row refers to: explicit TaxKatha ID first, then identity key. */
function matchStored(c: NormalizedCase, stored: Awaited<ReturnType<typeof loadStored>>): StoredCase | undefined {
  return (c.taxkathaId ? stored.byId.get(c.taxkathaId) : undefined) ?? stored.bySourceKey.get(c.sourceKey);
}

const COMPARED_FIELDS = [
  "caseName",
  "court",
  "bench",
  "decisionDate",
  "caseNumber",
  "relevantSections",
  "background",
  "decision",
  "outcome",
  "summary",
  "domain",
] as const;

async function changedFieldsFor(conn: DbOrTx, pairs: { postId: string; incoming: NormalizedCase }[]) {
  const result = new Map<string, string[]>();
  for (const part of chunk(pairs, 500)) {
    const rows = await conn
      .select({
        postId: posts.id,
        title: posts.title,
        excerpt: posts.excerpt,
        domain: posts.domain,
        courtKey: courts.key,
        bench: caseLawDetails.bench,
        decisionDate: caseLawDetails.decisionDate,
        caseNumber: caseLawDetails.caseNumber,
        relevantSections: caseLawDetails.relevantSections,
        background: caseLawDetails.background,
        decision: caseLawDetails.decision,
        outcomeSide: caseLawDetails.outcomeSide,
        remanded: caseLawDetails.remanded,
      })
      .from(posts)
      .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
      .innerJoin(courts, eq(courts.id, caseLawDetails.courtId))
      .where(inArray(posts.id, part.map((p) => p.postId)));
    const byId = new Map(rows.map((r) => [r.postId, r]));
    for (const { postId, incoming } of part) {
      const s = byId.get(postId);
      if (!s) continue;
      const differs: Record<(typeof COMPARED_FIELDS)[number], boolean> = {
        caseName: s.title !== incoming.caseName,
        court: s.courtKey !== incoming.court.key,
        bench: s.bench !== incoming.bench,
        decisionDate: s.decisionDate !== incoming.decisionDate,
        caseNumber: s.caseNumber !== incoming.caseNumber,
        relevantSections: s.relevantSections !== incoming.relevantSections,
        background: s.background !== incoming.background,
        decision: s.decision !== incoming.decision,
        outcome: s.outcomeSide !== incoming.outcomeSide || s.remanded !== incoming.remanded,
        summary: s.excerpt !== incoming.summary,
        domain: s.domain !== incoming.domain,
      };
      result.set(
        postId,
        COMPARED_FIELDS.filter((f) => differs[f]),
      );
    }
  }
  return result;
}

export type PreviewResult = { batchId: string; counts: ImportCounts; report: ImportReport };

export async function createImportPreview(input: {
  buffer: Buffer;
  filename: string;
  uploadedBy: string | null;
}): Promise<PreviewResult> {
  const fileSha256 = createHash("sha256").update(input.buffer).digest("hex");
  const sheet = parseWorkbook(input.buffer);
  const results = sheet.rows.map((row) => normalizeRow(row));

  const valid = results.flatMap((r) => (r.data ? [r.data] : []));
  const stored = await loadStored(
    db,
    valid.map((c) => c.sourceKey),
    valid.flatMap((c) => (c.taxkathaId ? [c.taxkathaId] : [])),
  );

  // Cases already stored with the same parties, forum and date but a different identity.
  const similar = new Map<string, string>();
  for (const part of chunk([...new Set(valid.map((c) => c.similarityKey))], 1000)) {
    const rows = await db
      .select({ similarityKey: caseLawDetails.similarityKey, sourceKey: caseLawDetails.sourceKey })
      .from(caseLawDetails)
      .where(inArray(caseLawDetails.similarityKey, part));
    for (const row of rows) similar.set(row.similarityKey, row.sourceKey);
  }

  const knownAliases = new Set([...DEFAULT_ALIAS_INDEX.keys(), ...(await loadAliasMap(db)).keys()]);

  const counts = emptyCounts();
  const firstRowBySource = new Map<string, number>();
  const unknownTopics = new Set<string>();
  const tally = (bucket: Record<string, number>, key: string) => (bucket[key] = (bucket[key] ?? 0) + 1);
  const outcomes: Record<string, number> = {};
  const domains: Record<string, number> = {};
  let warnings = 0;

  const prepared: {
    rowNumber: number;
    status: RowStatus;
    sourceKey: string | null;
    postId: string | null;
    data: Record<string, unknown>;
    issues: ImportIssue[];
  }[] = [];
  const toDiff: { postId: string; incoming: NormalizedCase; index: number }[] = [];

  for (const result of results) {
    const issues = [...result.issues];
    const c = result.data;
    let status: RowStatus;
    let postId: string | null = null;

    if (!c) {
      status = "invalid";
    } else {
      const firstRow = firstRowBySource.get(c.sourceKey);
      const match = matchStored(c, stored);
      const collision = stored.bySourceKey.get(c.sourceKey);

      if (firstRow !== undefined) {
        status = "duplicate";
        issues.push({ level: "error", message: `Same case as row ${firstRow} in this file.` });
      } else if (c.taxkathaId && !stored.byId.has(c.taxkathaId)) {
        status = "invalid";
        issues.push({ level: "error", field: "taxkathaId", message: "TaxKatha ID does not match any case. Clear the cell to add this as a new case." });
      } else if (match && collision && collision.postId !== match.postId) {
        status = "invalid";
        issues.push({ level: "error", message: "These details would duplicate another existing case." });
      } else if (!match) {
        status = "new";
        const twin = similar.get(c.similarityKey);
        if (twin && twin !== c.sourceKey) {
          issues.push({
            level: "warning",
            message: "A case with the same parties, forum and date already exists. Check that this is not a duplicate with a corrected case number.",
          });
        }
      } else {
        postId = match.postId;
        if (match.contentHash === c.contentHash) status = "unchanged";
        else if (match.manuallyEditedAt) status = "skipped_manual_edit";
        else status = "changed";
        if (status !== "unchanged") toDiff.push({ postId, incoming: c, index: prepared.length });
      }

      if (status !== "duplicate") firstRowBySource.set(c.sourceKey, result.rowNumber);
      if (status !== "invalid" && status !== "duplicate") {
        tally(outcomes, c.remanded ? `${c.outcomeSide}_remanded` : c.outcomeSide);
        tally(domains, c.domain);
        if (c.topicKey && c.topicLabel && !knownAliases.has(c.topicKey)) unknownTopics.add(c.topicLabel);
      }
    }

    counts.total += 1;
    counts[status] += 1;
    warnings += issues.filter((i) => i.level === "warning").length;
    prepared.push({
      rowNumber: result.rowNumber,
      status,
      sourceKey: c?.sourceKey ?? null,
      postId,
      data: c ?? { raw: sheet.rows.find((r) => r.rowNumber === result.rowNumber)?.cells ?? {} },
      issues,
    });
  }

  const changed = await changedFieldsFor(db, toDiff);

  const report: ImportReport = {
    sheet: sheet.sheet,
    headerRow: sheet.headerRow,
    columns: sheet.columns as Record<string, string>,
    courts: {
      raw: new Set(valid.map((c) => c.courtRaw.toUpperCase())).size,
      canonical: new Set(valid.map((c) => c.court.key)).size,
    },
    topics: { labels: new Set(valid.flatMap((c) => (c.topicKey ? [c.topicKey] : []))).size, unknown: [...unknownTopics].sort() },
    outcomes,
    domains,
    warnings,
  };

  const batchId = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(importBatches)
      .values({
        filename: input.filename.slice(0, 200),
        fileSha256,
        fileSize: input.buffer.byteLength,
        uploadedBy: input.uploadedBy,
        counts,
        report,
      })
      .returning({ id: importBatches.id });

    for (const part of chunk(prepared, 250)) {
      await tx.insert(importBatchRows).values(
        part.map((row) => ({
          batchId: batch!.id,
          rowNumber: row.rowNumber,
          status: row.status,
          sourceKey: row.sourceKey,
          postId: row.postId,
          data: row.data,
          issues: row.issues,
          changedFields: row.postId ? (changed.get(row.postId) ?? []) : [],
        })),
      );
    }
    return batch!.id;
  });

  return { batchId, counts, report };
}

export type CommitResult = {
  batchId: string;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  invalid: number;
  duplicate: number;
  topicsCreated: string[];
  /** Posts whose public pages need revalidating. */
  affectedPostIds: string[];
};

export async function commitImportBatch(input: {
  batchId: string;
  actorId: string | null;
  publish: boolean;
  overwriteManualEdits: boolean;
}): Promise<CommitResult> {
  const { batchId, actorId, publish, overwriteManualEdits } = input;

  return db.transaction(async (tx) => {
    // One import at a time; transaction-scoped so it is safe behind PgBouncer.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('taxkatha:import'))`);

    const [batch] = await tx
      .update(importBatches)
      .set({ status: "committing", options: { publish, overwriteManualEdits } })
      .where(and(eq(importBatches.id, batchId), eq(importBatches.status, "previewed")))
      .returning({ id: importBatches.id, filename: importBatches.filename, counts: importBatches.counts });
    if (!batch) throw new ImportStateError("This import has already been committed or discarded.");

    const rows = await tx
      .select({ rowNumber: importBatchRows.rowNumber, status: importBatchRows.status, data: importBatchRows.data })
      .from(importBatchRows)
      .where(
        and(
          eq(importBatchRows.batchId, batchId),
          inArray(importBatchRows.status, ["new", "changed", "unchanged", "skipped_manual_edit"]),
        ),
      )
      .orderBy(importBatchRows.rowNumber);

    // Stored JSON is re-validated: never trust a payload just because we wrote it.
    const cases = rows.map((row) => ({ rowNumber: row.rowNumber, c: normalizedCaseSchema.parse(row.data) }));

    const courtIds = await resolveCourts(tx, cases.map(({ c }) => c.court));
    const topicLabels = new Map<string, string>();
    for (const { c } of cases) if (c.topicKey && c.topicLabel) topicLabels.set(c.topicKey, c.topicLabel);
    const { map: topicIds, created: topicsCreated } = await resolveTopics(
      tx,
      [...topicLabels].map(([key, label]) => ({ key, label })),
    );

    // Re-read current state: the database may have changed since the preview.
    const stored = await loadStored(
      tx,
      cases.map(({ c }) => c.sourceKey),
      cases.flatMap(({ c }) => (c.taxkathaId ? [c.taxkathaId] : [])),
    );

    const now = new Date();
    const toCreate: { rowNumber: number; c: NormalizedCase; id: string }[] = [];
    const toUpdate: { rowNumber: number; c: NormalizedCase; postId: string }[] = [];
    const finalStatus = new Map<number, { status: RowStatus; postId: string | null }>();
    let unchanged = 0;
    let skipped = 0;

    for (const { rowNumber, c } of cases) {
      const match = matchStored(c, stored);
      if (!match) {
        const id = randomUUID();
        toCreate.push({ rowNumber, c, id });
        finalStatus.set(rowNumber, { status: "new", postId: id });
      } else if (match.contentHash === c.contentHash) {
        unchanged += 1;
        finalStatus.set(rowNumber, { status: "unchanged", postId: match.postId });
      } else if (match.manuallyEditedAt && !overwriteManualEdits) {
        skipped += 1;
        finalStatus.set(rowNumber, { status: "skipped_manual_edit", postId: match.postId });
      } else {
        toUpdate.push({ rowNumber, c, postId: match.postId });
        finalStatus.set(rowNumber, { status: "changed", postId: match.postId });
      }
    }

    /* ------------------------------ create ------------------------------ */
    const taken = new Set<string>();
    for (const part of chunk(toCreate.map(({ c }) => c.slugBase), 1000)) {
      for (const row of await tx.select({ slug: posts.slug }).from(posts).where(inArray(posts.slug, part))) taken.add(row.slug);
      for (const row of await tx.select({ slug: slugHistory.oldSlug }).from(slugHistory).where(inArray(slugHistory.oldSlug, part))) {
        taken.add(row.slug);
      }
    }
    const slugFor = (c: NormalizedCase) => {
      let slug = c.slugBase;
      if (taken.has(slug)) slug = `${c.slugBase}-${c.sourceKey.slice(0, 6)}`;
      taken.add(slug);
      return slug;
    };

    const detailValues = (c: NormalizedCase) => ({
      courtId: courtIds.get(c.court.key)!,
      courtRaw: c.courtRaw,
      bench: c.bench,
      decisionDate: c.decisionDate,
      caseNumber: c.caseNumber,
      relevantSections: c.relevantSections,
      sectionRefs: c.sectionRefs,
      background: c.background,
      decision: c.decision,
      outcomeSide: c.outcomeSide,
      remanded: c.remanded,
      outcomeRaw: c.outcomeRaw,
      domainLabel: c.domainLabel,
      sourceKey: c.sourceKey,
      similarityKey: c.similarityKey,
      contentHash: c.contentHash,
      lastImportHash: c.contentHash,
      importBatchId: batchId,
      manuallyEditedAt: null,
    });

    for (const part of chunk(toCreate, 200)) {
      await tx.insert(posts).values(
        part.map(({ c, id }) => ({
          id,
          type: "case_law" as const,
          slug: slugFor(c),
          title: c.caseName,
          excerpt: c.summary,
          status: publish ? ("published" as const) : ("draft" as const),
          publishedAt: publish ? now : null,
          topicId: c.topicKey ? (topicIds.get(c.topicKey) ?? null) : null,
          domain: c.domain,
          createdBy: actorId,
        })),
      );
      await tx.insert(caseLawDetails).values(part.map(({ c, id }) => ({ postId: id, ...detailValues(c) })));
      await tx.insert(postStats).values(part.map(({ id }) => ({ postId: id })));
    }

    /* ------------------------------ update ------------------------------ */
    for (const part of chunk(toUpdate, 200)) {
      const ids = part.map((u) => u.postId);
      const before = await tx
        .select({ post: posts, detail: caseLawDetails })
        .from(posts)
        .innerJoin(caseLawDetails, eq(caseLawDetails.postId, posts.id))
        .where(inArray(posts.id, ids));
      if (before.length > 0) {
        await tx.insert(postRevisions).values(
          before.map(({ post, detail }) => ({
            postId: post.id,
            reason: "import",
            actorId,
            snapshot: {
              title: post.title,
              excerpt: post.excerpt,
              domain: post.domain,
              topicId: post.topicId,
              detail: { ...detail, postId: undefined },
            },
          })),
        );
      }
      for (const { c, postId } of part) {
        await tx
          .update(posts)
          .set({
            title: c.caseName,
            excerpt: c.summary,
            domain: c.domain,
            topicId: c.topicKey ? (topicIds.get(c.topicKey) ?? null) : null,
          })
          .where(eq(posts.id, postId));
        await tx.update(caseLawDetails).set(detailValues(c)).where(eq(caseLawDetails.postId, postId));
      }
    }

    const affectedPostIds = [...toCreate.map((r) => r.id), ...toUpdate.map((r) => r.postId)];
    await refreshSearchVectors(tx, affectedPostIds);

    /* --------------------------- record result --------------------------- */
    for (const part of chunk([...finalStatus], 400)) {
      const values = sql.join(
        part.map(([rowNumber, v]) => sql`(${rowNumber}::int, ${v.status}::import_row_status, ${v.postId}::uuid)`),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE import_batch_rows AS r
        SET status = v.status, post_id = v.post_id
        FROM (VALUES ${values}) AS v(row_number, status, post_id)
        WHERE r.batch_id = ${batchId} AND r.row_number = v.row_number
      `);
    }

    const counts: ImportCounts = {
      total: batch.counts.total,
      new: toCreate.length,
      changed: toUpdate.length,
      unchanged,
      skipped_manual_edit: skipped,
      invalid: batch.counts.invalid,
      duplicate: batch.counts.duplicate,
    };
    await tx
      .update(importBatches)
      .set({ status: "committed", committedAt: now, counts })
      .where(eq(importBatches.id, batchId));

    await writeAudit(tx, {
      actorId,
      action: "import.commit",
      entityType: "import_batch",
      entityId: batchId,
      summary: `Imported "${batch.filename}": ${toCreate.length} added, ${toUpdate.length} updated${publish ? " (published)" : " (drafts)"}`,
      meta: { counts, publish, overwriteManualEdits, topicsCreated },
    });

    return {
      batchId,
      created: toCreate.length,
      updated: toUpdate.length,
      unchanged,
      skipped,
      invalid: counts.invalid,
      duplicate: counts.duplicate,
      topicsCreated,
      affectedPostIds,
    };
  });
}

/** Marks a previewed batch as discarded (nothing was written to content). */
export async function discardImportBatch(batchId: string, actorId: string | null): Promise<void> {
  const [batch] = await db
    .update(importBatches)
    .set({ status: "discarded" })
    .where(and(eq(importBatches.id, batchId), eq(importBatches.status, "previewed")))
    .returning({ id: importBatches.id });
  if (!batch) throw new ImportStateError("Only a previewed import can be discarded.");
  await writeAudit(db, { actorId, action: "import.discard", entityType: "import_batch", entityId: batchId, summary: "Discarded an import preview" });
}
