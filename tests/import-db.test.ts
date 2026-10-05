import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

/*
 * Integration test for the import pipeline against the local TEST database
 * (created by `npm run db:up`, migrated by `npm run db:migrate -- --test`).
 * Skipped when no test database is configured.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const HEADER = [
  "Case Name", "Court / Authority", "Bench", "Decision Date", "Case / Proceeding No.", "Relevant Sections",
  "Background and Issue", "Decision", "Outcome", "Case Summary",
];

type Row = { name: string; court?: string; date?: string; no?: string; decision?: string; summary?: string; id?: string };

function workbook(rows: Row[], withId = false): Buffer {
  const header = withId ? ["TaxKatha ID", ...HEADER] : HEADER;
  const body = rows.map((r) => {
    const cells = [
      r.name,
      r.court ?? "HIGH COURT OF MADRAS",
      "A. B. JUDGE, J",
      r.date ?? "2026-08-01",
      r.no ?? "W.P. NO. 100 OF 2026",
      "Section 74, read with section 73, of Central Goods and Services Tax Act, 2017 - Article 226 of Constitution of India, 1950",
      "Demands - Limitation - Whether the show cause notice was issued within the extended period",
      r.decision ?? "It was held that the notice was barred by limitation and the confidential reasoning zebra-marker applied",
      "In favour of assessee",
      r.summary ?? "Madras)[01-08-2026] GST: Where show cause notice was issued beyond limitation, the demand was quashed",
    ];
    return withId ? [r.id ?? "", ...cells] : cells;
  });
  const sheet = XLSX.utils.aoa_to_sheet([["Casewise Legal Summaries"], ["Test file"], [], header, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Case Summaries");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe.skipIf(!TEST_URL)("import pipeline (database)", () => {
  let store: typeof import("@/server/import/store");
  let dbm: typeof import("@/server/db");
  let orm: typeof import("drizzle-orm");

  beforeAll(async () => {
    dbm = await import("@/server/db");
    store = await import("@/server/import/store");
    orm = await import("drizzle-orm");
    await dbm.db.execute(orm.sql`
      TRUNCATE posts, courts, topics, topic_aliases, import_batches, audit_log RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await dbm?.pool.end();
  });

  const preview = (rows: Row[], withId = false) =>
    store.createImportPreview({ buffer: workbook(rows, withId), filename: "test.xlsx", uploadedBy: null });
  const commit = (batchId: string, options: { publish?: boolean; overwriteManualEdits?: boolean } = {}) =>
    store.commitImportBatch({ batchId, actorId: null, publish: options.publish ?? true, overwriteManualEdits: options.overwriteManualEdits ?? false });
  const scalar = async <T>(query: ReturnType<typeof orm.sql>) => (await dbm.db.execute(query)).rows[0] as T;

  const base: Row[] = [
    { name: "Alpha Traders v. State Tax Officer" },
    { name: "Beta Exports (P.) Ltd. v. Union of India", court: "GOODS AND SERVICE TAX APPELLATE TRIBUNAL , NEW DELHI BENCH", no: "A-1 OF 2026" },
    { name: "Gamma Steel v. Commissioner", court: "SUPREME COURT OF INDIA", no: "Not stated in the case note" },
  ];

  it("previews without touching content, then commits", async () => {
    const p = await preview(base);
    expect(p.counts).toMatchObject({ total: 3, new: 3, changed: 0, unchanged: 0, invalid: 0 });
    expect(p.report).toMatchObject({ sheet: "Case Summaries", headerRow: 4, courts: { canonical: 3 } });
    expect((await scalar<{ n: string }>(orm.sql`select count(*) as n from posts`)).n).toBe("0");

    const c = await commit(p.batchId);
    expect(c).toMatchObject({ created: 3, updated: 0, unchanged: 0 });
    const row = await scalar<{ n: string; published: string; vectors: string }>(orm.sql`
      select count(*) as n, count(*) filter (where status = 'published') as published,
             count(*) filter (where search_public is not null and search_member is not null) as vectors
      from posts`);
    expect(row).toEqual({ n: "3", published: "3", vectors: "3" });
  });

  it("refuses to commit the same batch twice", async () => {
    const p = await preview(base);
    await commit(p.batchId);
    await expect(commit(p.batchId)).rejects.toBeInstanceOf(store.ImportStateError);
  });

  it("is idempotent: re-importing the same file changes nothing", async () => {
    const p = await preview(base);
    expect(p.counts).toMatchObject({ new: 0, changed: 0, unchanged: 3 });
  });

  it("cleans the stored headnote and keeps gated text out of the public index", async () => {
    const row = await scalar<{ excerpt: string; domain: string; public_hit: boolean; member_hit: boolean; refs: string[] }>(orm.sql`
      select p.excerpt, p.domain,
             p.search_public @@ websearch_to_tsquery('english', 'zebra-marker') as public_hit,
             p.search_member @@ websearch_to_tsquery('english', 'zebra-marker') as member_hit,
             c.section_refs as refs
      from posts p join case_law_details c on c.post_id = p.id
      where p.title = 'Alpha Traders v. State Tax Officer'`);
    expect(row.excerpt).toBe("Where show cause notice was issued beyond limitation, the demand was quashed");
    expect(row.domain).toBe("gst");
    expect(row.public_hit).toBe(false);
    expect(row.member_hit).toBe(true);
    expect(row.refs).toEqual(["CGST S.74", "CGST S.73", "Constitution Art.226"]);
  });

  it("detects a changed row, updates it and keeps a revision", async () => {
    const edited = base.map((r, i) => (i === 0 ? { ...r, decision: "It was held on reconsideration that the notice was valid" } : r));
    const p = await preview(edited);
    expect(p.counts).toMatchObject({ new: 0, changed: 1, unchanged: 2 });
    const changedRow = await scalar<{ changed_fields: string[] }>(orm.sql`
      select changed_fields from import_batch_rows where batch_id = ${p.batchId} and status = 'changed'`);
    expect(changedRow.changed_fields).toEqual(["decision"]);

    const c = await commit(p.batchId);
    expect(c).toMatchObject({ created: 0, updated: 1, unchanged: 2 });
    expect((await scalar<{ n: string }>(orm.sql`select count(*) as n from post_revisions where reason = 'import'`)).n).toBe("1");
  });

  it("protects cases edited in the admin unless told to overwrite", async () => {
    await dbm.db.execute(orm.sql`
      update case_law_details set manually_edited_at = now(), content_hash = 'edited-by-admin'
      where post_id = (select id from posts where title = 'Gamma Steel v. Commissioner')`);
    const incoming = base.map((r, i) => (i === 2 ? { ...r, decision: "A different decision text from the spreadsheet" } : r));
    const withEdit = [{ ...base[0]!, decision: "It was held on reconsideration that the notice was valid" }, incoming[1]!, incoming[2]!];

    const p1 = await preview(withEdit);
    expect(p1.counts).toMatchObject({ skipped_manual_edit: 1, unchanged: 2 });
    expect(await commit(p1.batchId)).toMatchObject({ updated: 0, skipped: 1 });

    const p2 = await preview(withEdit);
    expect(await commit(p2.batchId, { overwriteManualEdits: true })).toMatchObject({ updated: 1, skipped: 0 });
    const after = await scalar<{ manually_edited_at: Date | null }>(orm.sql`
      select manually_edited_at from case_law_details
      where post_id = (select id from posts where title = 'Gamma Steel v. Commissioner')`);
    expect(after.manually_edited_at).toBeNull();
  });

  it("flags duplicates inside a file and invalid rows", async () => {
    const p = await preview([
      { name: "Delta Foods v. State" },
      { name: "Delta Foods v. State" },
      { name: "Epsilon Ltd. v. State", date: "31-02-2026" },
      { name: "Zeta Ltd. v. State", summary: "short" },
    ]);
    expect(p.counts).toMatchObject({ total: 4, new: 1, duplicate: 1, invalid: 2 });
  });

  it("warns when a new row looks like an existing case with a different case number", async () => {
    const p = await preview([{ name: "Alpha Traders v. State Tax Officer", no: "W.P. NO. 999 OF 2026" }]);
    expect(p.counts).toMatchObject({ new: 1 });
    const row = await scalar<{ issues: { level: string; message: string }[] }>(orm.sql`
      select issues from import_batch_rows where batch_id = ${p.batchId}`);
    expect(row.issues.some((i) => i.level === "warning" && /same parties/.test(i.message))).toBe(true);
  });

  it("matches rows by TaxKatha ID so a corrected name updates the same case", async () => {
    const { id } = await scalar<{ id: string }>(orm.sql`select id from posts where title = 'Beta Exports (P.) Ltd. v. Union of India'`);
    const renamed = [{ ...base[1]!, name: "Beta Exports Private Limited v. Union of India", id }];
    const p = await preview(renamed, true);
    expect(p.counts).toMatchObject({ new: 0, changed: 1 });
    await commit(p.batchId);
    const after = await scalar<{ title: string; n: string }>(orm.sql`
      select (select title from posts where id = ${id}) as title, (select count(*) from posts) as n`);
    expect(after.title).toBe("Beta Exports Private Limited v. Union of India");
    expect(after.n).toBe("3");
  });

  it("creates unknown topics as unreviewed and reuses curated ones", async () => {
    const topics = await scalar<{ reviewed: string; curated_used: string }>(orm.sql`
      select count(*) filter (where reviewed) as reviewed,
             (select t.slug from posts p join topics t on t.id = p.topic_id limit 1) as curated_used
      from topics`);
    expect(Number(topics.reviewed)).toBeGreaterThanOrEqual(28);
    expect(topics.curated_used).toBe("demands-adjudication");
  });
});
