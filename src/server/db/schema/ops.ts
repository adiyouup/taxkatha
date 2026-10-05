import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./_types";
import { user } from "./auth";

/* ----------------------------- Excel imports ----------------------------- */

export const importStatus = pgEnum("import_status", ["previewed", "committing", "committed", "failed", "discarded"]);

export const importRowStatus = pgEnum("import_row_status", [
  "new",
  "changed",
  "unchanged",
  "skipped_manual_edit",
  "invalid",
  "duplicate",
]);

export type ImportCounts = {
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  skipped_manual_edit: number;
  invalid: number;
  duplicate: number;
};

export type ImportReport = {
  sheet: string;
  headerRow: number;
  columns: Record<string, string>;
  courts: { raw: number; canonical: number };
  topics: { labels: number; unknown: string[] };
  outcomes: Record<string, number>;
  domains: Record<string, number>;
  warnings: number;
};

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid().primaryKey().defaultRandom(),
    filename: text().notNull(),
    fileSha256: text().notNull(),
    fileSize: integer().notNull(),
    uploadedBy: text().references(() => user.id, { onDelete: "set null" }),
    status: importStatus().notNull().default("previewed"),
    counts: jsonb().$type<ImportCounts>().notNull(),
    report: jsonb().$type<ImportReport>().notNull(),
    options: jsonb().$type<{ publish: boolean; overwriteManualEdits: boolean }>(),
    error: text(),
    createdAt: createdAt(),
    committedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("import_batches_created_idx").on(t.createdAt.desc())],
);

export type ImportIssue = { level: "error" | "warning"; field?: string; message: string };

export const importBatchRows = pgTable(
  "import_batch_rows",
  {
    batchId: uuid()
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    rowNumber: integer().notNull(),
    status: importRowStatus().notNull(),
    sourceKey: text(),
    /** The post this row maps to (existing or created on commit). No FK: rows outlive deleted posts. */
    postId: uuid(),
    /** Normalised row, ready to commit without re-uploading the file. */
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    issues: jsonb().$type<ImportIssue[]>().notNull().default(sql`'[]'::jsonb`),
    /** Field names that differ from the stored post (for `changed` rows). */
    changedFields: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.rowNumber] }), index("import_rows_status_idx").on(t.batchId, t.status)],
);

/* ------------------------------- Audit log ------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    summary: text().notNull().default(""),
    meta: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt.desc()), index("audit_entity_idx").on(t.entityType, t.entityId)],
);

/* ----------------------------- Site settings ----------------------------- */

export const siteSettings = pgTable("site_settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedBy: text().references(() => user.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/* ------------------------------ Rate limits ------------------------------ */

/** Fixed-window counters for app actions (comments, shares, view beacons). */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

/* --------------------------- Signup attribution -------------------------- */

export const userAcquisition = pgTable(
  "user_acquisition",
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    utmSource: text(),
    utmMedium: text(),
    utmCampaign: text(),
    utmContent: text(),
    utmTerm: text(),
    /** The member whose shared link brought this user in. */
    refUserId: text().references(() => user.id, { onDelete: "set null" }),
    landingPath: text(),
    referrer: text(),
    createdAt: createdAt(),
  },
  (t) => [index("acquisition_source_idx").on(t.utmSource), index("acquisition_ref_idx").on(t.refUserId)],
);
