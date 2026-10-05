import * as z from "zod";

import { normalizeCourt } from "./courts";
import { parseDecisionDate } from "./dates";
import { normalizeOutcome } from "./outcome";
import type { RawRow } from "./parse";
import { parseSectionRefs } from "./sections";
import { cleanSummary } from "./summary";
import { cleanText, matchKey, sha256, slugify } from "./text";
import { extractTopicLabel } from "./topics";

/*
 * Turns one spreadsheet row into a validated, normalised case — or a list of
 * reasons it cannot be imported. Pure: no database access.
 */

export type ImportIssue = { level: "error" | "warning"; field?: string; message: string };

const courtSchema = z.object({
  rawKey: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  type: z.enum(["supreme_court", "high_court", "gstat", "cestat", "itat", "aaar", "aar", "naa", "tribunal", "other"]),
  location: z.string().nullable(),
  slug: z.string().min(1),
});

/** The shape stored in import_batch_rows.data and re-validated at commit. */
export const normalizedCaseSchema = z.object({
  taxkathaId: z.uuid().nullable(),
  caseName: z.string().min(3).max(400),
  slugBase: z.string().min(1),
  court: courtSchema,
  courtRaw: z.string().min(1).max(300),
  bench: z.string().max(400),
  decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caseNumber: z.string().max(400),
  relevantSections: z.string().max(6000),
  sectionRefs: z.array(z.string().max(60)).max(32),
  background: z.string().max(30000),
  decision: z.string().max(30000),
  outcomeSide: z.enum(["assessee", "revenue", "partly", "unknown"]),
  remanded: z.boolean(),
  outcomeRaw: z.string().max(300),
  summary: z.string().min(20).max(8000),
  domain: z.enum(["gst", "income_tax", "customs", "excise", "service_tax", "vat", "ibc", "other"]),
  domainLabel: z.string().max(60),
  topicLabel: z.string().max(80).nullable(),
  topicKey: z.string().max(80).nullable(),
  sourceKey: z.string().length(64),
  similarityKey: z.string().length(64),
  contentHash: z.string().length(64),
});

export type NormalizedCase = z.infer<typeof normalizedCaseSchema>;

export type RowResult = { rowNumber: number; data: NormalizedCase | null; issues: ImportIssue[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_STATED = /^(not stated( in the case note)?|n\/?a|nil|-+)\.?$/i;
const STANDARD_UNKNOWN_OUTCOME = /disposition is summarised/i;

/** Fields whose change means the stored post must be updated. */
export function contentHashOf(
  c: Omit<NormalizedCase, "contentHash" | "sourceKey" | "similarityKey" | "taxkathaId" | "slugBase">,
): string {
  return sha256(
    JSON.stringify([
      c.caseName, c.court.key, c.courtRaw, c.bench, c.decisionDate, c.caseNumber, c.relevantSections,
      c.sectionRefs, c.background, c.decision, c.outcomeSide, c.remanded, c.outcomeRaw, c.summary,
      c.domain, c.domainLabel, c.topicKey,
    ]),
  );
}

/**
 * Immutable identity of a case: parties + date + forum + case number.
 * The case number is needed because the same party can obtain two different
 * rulings from one court on one day; it is blank when the source does not
 * state it, which is why it cannot be the whole key.
 */
export function sourceKeyOf(caseName: string, decisionDate: string, courtRawKey: string, caseNumber: string): string {
  return sha256(`${matchKey(caseName)}|${decisionDate}|${courtRawKey}|${matchKey(caseNumber)}`);
}

/** Same parties, forum and date — used to warn about probable duplicates. */
export function similarityKeyOf(caseName: string, decisionDate: string, courtRawKey: string): string {
  return sha256(`${matchKey(caseName)}|${decisionDate}|${courtRawKey}`);
}

export function normalizeRow(row: RawRow, now: Date = new Date()): RowResult {
  const issues: ImportIssue[] = [];
  const error = (field: string, message: string) => issues.push({ level: "error", field, message });
  const warn = (field: string, message: string) => issues.push({ level: "warning", field, message });
  const { cells } = row;

  const caseName = cleanText(cells.caseName);
  if (caseName.length < 3) error("caseName", "Case name is missing.");

  const courtRaw = cleanText(cells.court);
  const court = normalizeCourt(courtRaw);
  if (!court) error("court", "Court / authority is missing.");
  else if (court.type === "other") warn("court", `Court "${courtRaw}" was not recognised; it is filed under Other.`);

  const decisionDate = parseDecisionDate(cells.decisionDate);
  if (!decisionDate) {
    error("decisionDate", cells.decisionDate ? `"${String(cells.decisionDate)}" is not a valid date.` : "Decision date is missing.");
  } else {
    const year = Number(decisionDate.slice(0, 4));
    if (year < 1950 || decisionDate > new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10)) {
      error("decisionDate", `Decision date ${decisionDate} is out of range.`);
    }
  }

  const relevantSections = cleanText(cells.sections);
  const sectionRefs = parseSectionRefs(relevantSections);
  if (relevantSections && sectionRefs.length === 0) warn("sections", "No section references could be parsed.");

  const cleaned = cleanSummary(cells.summary, relevantSections);
  if (cleaned.summary.length < 20) error("summary", "Case summary is missing or too short.");
  else if (!cleaned.labelled) warn("summary", "No tax-area label (such as \"GST:\") found at the start of the summary.");

  const background = cleanText(cells.background);
  const decision = cleanText(cells.decision);
  if (!background) warn("background", "Background and issue is empty.");
  if (!decision) warn("decision", "Decision is empty.");

  const topic = extractTopicLabel(background);
  if (background && !topic) warn("background", "No topic label found at the start of the background.");

  const outcome = normalizeOutcome(cells.outcome);
  if (outcome.raw && outcome.side === "unknown" && !outcome.remanded && !STANDARD_UNKNOWN_OUTCOME.test(outcome.raw)) {
    warn("outcome", `Outcome "${outcome.raw}" was not recognised.`);
  }

  const caseNumberRaw = cleanText(cells.caseNumber);
  const caseNumber = NOT_STATED.test(caseNumberRaw) ? "" : caseNumberRaw;
  const bench = cleanText(cells.bench);

  let taxkathaId: string | null = null;
  const idRaw = cleanText(cells.taxkathaId);
  if (idRaw) {
    if (UUID.test(idRaw)) taxkathaId = idRaw.toLowerCase();
    else warn("taxkathaId", "TaxKatha ID is not valid and was ignored.");
  }

  if (issues.some((i) => i.level === "error") || !court || !decisionDate) {
    return { rowNumber: row.rowNumber, data: null, issues };
  }

  const content = {
    caseName,
    court,
    courtRaw,
    bench,
    decisionDate,
    caseNumber,
    relevantSections,
    sectionRefs,
    background,
    decision,
    outcomeSide: outcome.side,
    remanded: outcome.remanded,
    outcomeRaw: outcome.raw,
    summary: cleaned.summary,
    domain: cleaned.domain,
    domainLabel: cleaned.domainLabel,
    topicLabel: topic?.label ?? null,
    topicKey: topic?.key ?? null,
  };

  const candidate = {
    ...content,
    taxkathaId,
    slugBase: `${slugify(caseName, 72)}-${decisionDate}`,
    sourceKey: sourceKeyOf(caseName, decisionDate, court.rawKey, caseNumber),
    similarityKey: similarityKeyOf(caseName, decisionDate, court.rawKey),
    contentHash: contentHashOf(content),
  };

  const parsed = normalizedCaseSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      error(String(issue.path[0] ?? "row"), issue.message);
    }
    return { rowNumber: row.rowNumber, data: null, issues };
  }

  return { rowNumber: row.rowNumber, data: parsed.data, issues };
}
