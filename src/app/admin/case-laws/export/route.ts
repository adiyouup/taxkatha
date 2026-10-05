import type { NextRequest } from "next/server";

import { COURT_TYPE_LABEL, type CourtType } from "@/lib/labels";
import { oneOf, param, uuidParam } from "@/lib/admin-params";
import { writeAudit } from "@/server/audit";
import { AuthError, authorize } from "@/server/auth/dal";
import { db } from "@/server/db";
import { buildExportWorkbook } from "@/server/import/export";
import { CASE_FLAGS, CASE_STATUSES, exportCasesAdmin } from "@/server/queries/admin-posts";

/**
 * Downloads the rulings in the current view as a workbook in the import
 * format, with a TaxKatha ID column: edit it in Excel and upload it again to
 * update those rulings. Contains the members-only text, so admins only.
 */
export async function GET(request: NextRequest) {
  let viewer;
  try {
    viewer = await authorize("admin");
  } catch (error) {
    if (error instanceof AuthError) return new Response("Not found", { status: 404 });
    throw error;
  }

  const query = Object.fromEntries(request.nextUrl.searchParams);
  const rows = await exportCasesAdmin({
    q: param(query, "q"),
    status: oneOf(query, "status", CASE_STATUSES),
    forum: oneOf(query, "forum", Object.keys(COURT_TYPE_LABEL) as CourtType[]),
    topic: uuidParam(query, "topic"),
    flag: oneOf(query, "flag", CASE_FLAGS),
    batch: uuidParam(query, "batch"),
  });

  const workbook = buildExportWorkbook(
    rows.map((row) => ({
      taxkathaId: row.id,
      caseName: row.title,
      court: row.courtRaw,
      bench: row.bench,
      decisionDate: row.decisionDate,
      caseNumber: row.caseNumber,
      sections: row.relevantSections,
      background: row.background,
      decision: row.decision,
      outcome: row.outcomeRaw,
      // The tax-area label is stored apart from the headnote; put it back so a re-import matches.
      summary: row.domainLabel ? `${row.domainLabel}: ${row.excerpt}` : row.excerpt,
    })),
  );

  await writeAudit(db, {
    actorId: viewer.id,
    action: "case.export",
    entityType: "post",
    summary: `Exported ${rows.length} rulings to a workbook`,
    meta: { filters: query },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="taxkatha-case-laws-${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
