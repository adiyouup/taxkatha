import * as XLSX from "xlsx";

import { FIELD_HEADERS, type FieldKey } from "./parse";

const TEMPLATE_FIELDS: FieldKey[] = [
  "caseName", "court", "bench", "decisionDate", "caseNumber", "sections", "background", "decision", "outcome", "summary",
];

const WIDTHS: Record<FieldKey, number> = {
  taxkathaId: 38, caseName: 46, court: 34, bench: 28, decisionDate: 14, caseNumber: 30, sections: 48,
  background: 70, decision: 70, outcome: 26, summary: 70,
};

function sheetFrom(fields: FieldKey[], rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([fields.map((f) => FIELD_HEADERS[f]), ...rows]);
  sheet["!cols"] = fields.map((f) => ({ wch: WIDTHS[f] }));
  return sheet;
}

/** A blank workbook with the expected headers, one example row and instructions. */
export function buildTemplateWorkbook(): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheetFrom(TEMPLATE_FIELDS, [
      [
        "Example Traders (P.) Ltd. v. State Tax Officer",
        "HIGH COURT OF MADRAS",
        "A. B. JUDGE, J",
        "2026-08-01",
        "W.P. NO. 12345 OF 2026",
        "Section 74, read with section 73, of Central Goods and Services Tax Act, 2017",
        "Demands - Limitation - Whether the show cause notice was issued within the extended period",
        "It was held that the notice was barred by limitation and the demand was set aside",
        "In favour of assessee",
        "GST: Where show cause notice was issued beyond the period of limitation, the consequential demand was quashed",
      ],
    ]),
    "Case Summaries",
  );

  const notes = XLSX.utils.aoa_to_sheet([
    ["TaxKatha case-law import — how to fill this file"],
    [],
    ["One case per row on the 'Case Summaries' sheet. Delete the example row before uploading."],
    ["Required columns", "Case Name, Court / Authority, Decision Date, Case Summary"],
    ["Decision Date", "A real date cell, or text such as 2026-08-01, 01-08-2026 or 1 Aug 2026"],
    ["Court / Authority", "e.g. SUPREME COURT OF INDIA, HIGH COURT OF MADRAS, GOODS AND SERVICE TAX APPELLATE TRIBUNAL, NEW DELHI"],
    ["Background and Issue", "Start with the topic, then ' - ', then the issue (e.g. 'Input tax credit - Time limit - …')"],
    ["Outcome", "In favour of assessee / In favour of revenue, optionally followed by '/Matter remanded'"],
    ["Case Summary", "Start with the tax area and a colon (e.g. 'GST: Where …'). This headnote is public"],
    ["Public vs members", "Background and Decision are shown to signed-in members only. Everything else is public"],
    ["Updating cases", "Export from the admin to get a 'TaxKatha ID' column; keep it and re-upload to update those cases"],
  ]);
  notes["!cols"] = [{ wch: 26 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(book, notes, "Instructions");

  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}

export type ExportRow = Record<FieldKey, string>;

const EXPORT_FIELDS: FieldKey[] = ["taxkathaId", ...TEMPLATE_FIELDS];

/** Round-trip export: the TaxKatha ID column lets a re-upload update the same cases. */
export function buildExportWorkbook(rows: ExportRow[]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheetFrom(
      EXPORT_FIELDS,
      rows.map((row) => EXPORT_FIELDS.map((f) => row[f])),
    ),
    "Case Summaries",
  );
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}
