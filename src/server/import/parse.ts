import * as XLSX from "xlsx";

import { matchKey } from "./text";

/*
 * Reads an uploaded workbook into rows keyed by field. The header row is
 * found by content, not position — exports often have title rows above it.
 */

export type FieldKey =
  | "taxkathaId"
  | "caseName"
  | "court"
  | "bench"
  | "decisionDate"
  | "caseNumber"
  | "sections"
  | "background"
  | "decision"
  | "outcome"
  | "summary";

/** Canonical column headers, used by the template and the export. */
export const FIELD_HEADERS: Record<FieldKey, string> = {
  taxkathaId: "TaxKatha ID",
  caseName: "Case Name",
  court: "Court / Authority",
  bench: "Bench",
  decisionDate: "Decision Date",
  caseNumber: "Case / Proceeding No.",
  sections: "Relevant Sections",
  background: "Background and Issue",
  decision: "Decision",
  outcome: "Outcome",
  summary: "Case Summary",
};

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  taxkathaId: ["TaxKatha ID", "Post ID", "ID"],
  caseName: ["Case Name", "Case", "Case Title", "Title", "Name of Case", "Parties"],
  court: ["Court / Authority", "Court", "Authority", "Forum", "Court/Forum"],
  bench: ["Bench", "Coram", "Judges", "Judge"],
  decisionDate: ["Decision Date", "Date of Decision", "Date", "Order Date", "Date of Order", "Judgment Date", "Judgement Date"],
  caseNumber: ["Case / Proceeding No.", "Case No", "Case Number", "Proceeding No", "Appeal No", "Case / Proceeding Number"],
  sections: ["Relevant Sections", "Sections", "Section", "Provisions", "Relevant Provisions"],
  background: ["Background and Issue", "Background", "Facts", "Issue", "Facts and Issue", "Background & Issue"],
  decision: ["Decision", "Held", "Ruling", "Decision / Held"],
  outcome: ["Outcome", "Result", "In favour of"],
  summary: ["Case Summary", "Summary", "Headnote", "Head Note", "Key Takeaway"],
};

const ALIAS_TO_FIELD = new Map<string, FieldKey>(
  (Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]).flatMap(([field, aliases]) =>
    aliases.map((alias) => [matchKey(alias), field] as const),
  ),
);

export const REQUIRED_FIELDS: FieldKey[] = ["caseName", "court", "decisionDate", "summary"];

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_ROWS = 10_000;
const HEADER_SCAN_ROWS = 30;

export type RawRow = { rowNumber: number; cells: Partial<Record<FieldKey, unknown>> };

export type ParsedSheet = {
  sheet: string;
  /** 1-based spreadsheet row of the header. */
  headerRow: number;
  /** Field → the header text found in the file. */
  columns: Partial<Record<FieldKey, string>>;
  rows: RawRow[];
};

/** A problem with the file as a whole (as opposed to a single row). */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

function findHeader(grid: unknown[][]) {
  const limit = Math.min(grid.length, HEADER_SCAN_ROWS);
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    const mapping = new Map<number, FieldKey>();
    const taken = new Set<FieldKey>();
    row.forEach((cell, c) => {
      if (typeof cell !== "string") return;
      const field = ALIAS_TO_FIELD.get(matchKey(cell));
      if (field && !taken.has(field)) {
        mapping.set(c, field);
        taken.add(field);
      }
    });
    if (taken.size >= 4 && taken.has("caseName")) return { index: r, mapping, row };
  }
  return null;
}

export function parseWorkbook(buffer: Buffer | Uint8Array): ParsedSheet {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ImportFileError(`The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });
  } catch {
    throw new ImportFileError("This file could not be read. Upload an .xlsx, .xls or .csv file.");
  }

  for (const sheet of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheet];
    if (!worksheet?.["!ref"]) continue;

    const firstRow = XLSX.utils.decode_range(worksheet["!ref"]).s.r;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: null, blankrows: true });
    const header = findHeader(grid);
    if (!header) continue;

    const columns: Partial<Record<FieldKey, string>> = {};
    for (const [c, field] of header.mapping) columns[field] = String(header.row[c]).trim();

    const missing = REQUIRED_FIELDS.filter((field) => !columns[field]);
    if (missing.length > 0) {
      throw new ImportFileError(
        `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.map((f) => `"${FIELD_HEADERS[f]}"`).join(", ")}.`,
      );
    }

    const rows: RawRow[] = [];
    for (let r = header.index + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const cells: Partial<Record<FieldKey, unknown>> = {};
      let hasValue = false;
      for (const [c, field] of header.mapping) {
        const value = row[c];
        if (value !== null && value !== undefined && String(value).trim() !== "") {
          cells[field] = value;
          hasValue = true;
        }
      }
      if (hasValue) rows.push({ rowNumber: firstRow + r + 1, cells });
    }

    if (rows.length === 0) throw new ImportFileError(`Sheet "${sheet}" has a header row but no data rows.`);
    if (rows.length > MAX_ROWS) {
      throw new ImportFileError(`The file has ${rows.length.toLocaleString("en-IN")} rows; the limit is ${MAX_ROWS.toLocaleString("en-IN")}. Split it into smaller files.`);
    }

    return { sheet, headerRow: firstRow + header.index + 1, columns, rows };
  }

  throw new ImportFileError(
    'No header row found. The sheet needs columns such as "Case Name", "Court / Authority", "Decision Date" and "Case Summary".',
  );
}
