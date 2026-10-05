import { cleanText } from "./text";

export type OutcomeSide = "assessee" | "revenue" | "partly" | "unknown";

export type NormalizedOutcome = { side: OutcomeSide; remanded: boolean; raw: string };

/**
 * Maps free-text outcomes to a side plus a remand flag.
 *   "In favour of assessee/Matter remanded" → assessee, remanded
 *   "Against assessee"                      → revenue
 *   "The disposition is summarised in the decision above." → unknown
 */
export function normalizeOutcome(input: unknown): NormalizedOutcome {
  const raw = cleanText(input);
  const text = raw.toLowerCase();
  const remanded = /\bremand/.test(text) || /\bremit/.test(text);

  let side: OutcomeSide = "unknown";
  if (/\bpartly\b|\bpartially\b|\bpartial\b/.test(text)) side = "partly";
  else if (/favou?r of (the )?(assessee|taxpayer|petitioner|applicant)/.test(text) || /against (the )?(revenue|department)/.test(text))
    side = "assessee";
  else if (/favou?r of (the )?(revenue|department)/.test(text) || /against (the )?(assessee|taxpayer|petitioner|applicant)/.test(text))
    side = "revenue";

  return { side, remanded, raw };
}

export function outcomeLabel(side: OutcomeSide, remanded: boolean): string {
  const base =
    side === "assessee"
      ? "In favour of assessee"
      : side === "revenue"
        ? "In favour of revenue"
        : side === "partly"
          ? "Partly in favour of assessee"
          : remanded
            ? "Matter remanded"
            : "See decision";
  return remanded && side !== "unknown" ? `${base} · Remanded` : base;
}
