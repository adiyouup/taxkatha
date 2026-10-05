/**
 * Imports a case-law workbook through the same pipeline the admin UI uses.
 *   npm run db:seed                       → data/seed/2026-27_Casewise_Legal_Summaries.xlsx, published
 *   npm run db:seed -- path/to/file.xlsx  → another file
 *   npm run db:seed -- --draft            → import as drafts instead of publishing
 * Safe to run repeatedly: unchanged cases are skipped.
 */
import "./_env";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { pool } from "../src/server/db";
import { ImportFileError } from "../src/server/import/parse";
import { commitImportBatch, createImportPreview } from "../src/server/import/store";

const DEFAULT_FILE = "data/seed/2026-27_Casewise_Legal_Summaries.xlsx";

async function main() {
  const args = process.argv.slice(2);
  const draft = args.includes("--draft");
  const file = path.resolve(args.find((a) => !a.startsWith("--")) ?? DEFAULT_FILE);

  if (!existsSync(file)) {
    console.error(`File not found: ${file}\nPut the workbook in data/seed/ or pass a path: npm run db:seed -- <file.xlsx>`);
    process.exit(1);
  }

  const started = Date.now();
  const preview = await createImportPreview({ buffer: readFileSync(file), filename: path.basename(file), uploadedBy: null });
  const { counts, report } = preview;
  console.log(`Read "${report.sheet}" (header on row ${report.headerRow}): ${counts.total} rows`);
  console.log(
    `  new ${counts.new} · changed ${counts.changed} · unchanged ${counts.unchanged} · edited-in-admin ${counts.skipped_manual_edit} · invalid ${counts.invalid} · duplicate ${counts.duplicate}`,
  );
  console.log(`  courts: ${report.courts.raw} names → ${report.courts.canonical} canonical · warnings: ${report.warnings}`);
  if (report.topics.unknown.length > 0) console.log(`  topics needing review: ${report.topics.unknown.join("; ")}`);

  const result = await commitImportBatch({ batchId: preview.batchId, actorId: null, publish: !draft, overwriteManualEdits: false });
  console.log(
    `Committed in ${((Date.now() - started) / 1000).toFixed(1)}s: ${result.created} added, ${result.updated} updated, ${result.unchanged} unchanged, ${result.skipped} skipped` +
      (draft ? " (as drafts)" : " (published)"),
  );
  if (result.created + result.updated > 0) {
    console.log("If a dev server is running, restart it to refresh cached pages.");
  }
}

main()
  .catch((error) => {
    if (error instanceof ImportFileError) console.error(`Import failed: ${error.message}`);
    else console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
