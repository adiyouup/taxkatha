/*
 * Source headnotes are written as clauses joined by " - ":
 *   "Demands - Limitation - Notice was issued beyond the period - Held, …"
 * These helpers turn that into readable points without altering the words.
 */

const CLAUSE_BREAK = /\s+[-–—]\s+|(?<=[a-z])-\s+(?=[A-Z])/;

/** Splits a headnote-style passage into its clauses. */
export function splitPoints(text: string): string[] {
  return text
    .split(CLAUSE_BREAK)
    .map((part) => part.trim().replace(/^[-–—:\s]+/, ""))
    .filter((part) => part.length > 0);
}

/** "Background" cells open with one or more short subject labels before the facts. */
export function splitSubjectTrail(text: string): { trail: string[]; points: string[] } {
  const parts = splitPoints(text);
  const trail: string[] = [];
  while (parts.length > 1 && trail.length < 4) {
    const next = parts[0]!;
    // A label is short and reads as a heading, not as a sentence with a verb phrase.
    const looksLikeLabel = next.length <= 64 && !/\b(was|were|is|are|had|has|filed|issued|held|challenged|sought|passed|claimed)\b/i.test(next);
    if (!looksLikeLabel) break;
    trail.push(parts.shift()!);
  }
  return { trail, points: parts };
}

const NEXT_HEADNOTE = /\s+(?=(?:GST|IGST|CGST|VAT|KVAT|IBC|IT|CUSTOMS|CENTRAL EXCISE|EXCISE)(?:\s*\/\s*[A-Za-z ]{2,20})?:\s+[A-Z])/;

/** One cell can hold several headnotes ("… set aside GST: Where respondents …"). */
export function splitHeadnotes(summary: string): string[] {
  return summary
    .split(NEXT_HEADNOTE)
    .map((part) => part.replace(/^[A-Z][A-Za-z/ ]{1,24}:\s+(?=[A-Z])/, "").trim())
    .filter((part) => part.length > 0);
}

/** A sentence-length teaser for meta descriptions and cards, cut at a word boundary. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "")}…`;
}
