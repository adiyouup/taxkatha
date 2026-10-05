import { cleanText } from "./text";

export type TaxDomain = "gst" | "income_tax" | "customs" | "excise" | "service_tax" | "vat" | "ibc" | "other";

export type CleanSummary = {
  /** The headnote with citation debris and the domain label removed. */
  summary: string;
  /** The label as written in the source ("GST", "GST/Excise", "KVAT"), or "". */
  domainLabel: string;
  domain: TaxDomain;
  /** False when no label could be identified (worth a warning). */
  labelled: boolean;
};

const DOMAIN_TOKENS: { pattern: RegExp; domain: TaxDomain }[] = [
  { pattern: /\b(GST|CGST|IGST|SGST|UTGST)\b/i, domain: "gst" },
  { pattern: /\b(IT|INCOME[- ]?TAX)\b/i, domain: "income_tax" },
  { pattern: /\bCUSTOMS\b/i, domain: "customs" },
  { pattern: /\bEXCISE\b|\bCESTAT\b/i, domain: "excise" },
  { pattern: /\bSERVICE TAX\b|\bST\b/i, domain: "service_tax" },
  { pattern: /\b([A-Z]{0,2}VAT|SALES TAX|CST)\b/i, domain: "vat" },
  { pattern: /\bIBC\b|\bINSOLVENCY\b/i, domain: "ibc" },
];

/** The first recognised token in the label decides the domain ("GST/Excise" → gst). */
export function domainFromLabel(label: string): TaxDomain {
  let best: { index: number; domain: TaxDomain } | null = null;
  for (const { pattern, domain } of DOMAIN_TOKENS) {
    const match = label.match(pattern);
    if (match && match.index !== undefined && (best === null || match.index < best.index)) {
      best = { index: match.index, domain };
    }
  }
  return best?.domain ?? "other";
}

/** Fallback when the summary has no label: infer from the statutes cited. */
export function domainFromSections(sections: string): TaxDomain {
  if (/Goods and Services? Tax/i.test(sections)) return "gst";
  if (/Income[- ]tax/i.test(sections)) return "income_tax";
  if (/Customs/i.test(sections)) return "customs";
  if (/Central Excise/i.test(sections)) return "excise";
  if (/Finance Act,? 1994|Service Tax/i.test(sections)) return "service_tax";
  if (/Value Added Tax|Sales Tax/i.test(sections)) return "vat";
  if (/Insolvency and Bankruptcy/i.test(sections)) return "ibc";
  return "other";
}

/**
 * A label is the text right before the first ": ", after any citation debris.
 * Its first word must be upper-case ("GST", "KVAT", "CENTRAL EXCISE") so an
 * ordinary sentence containing a colon is never mistaken for a label.
 */
const LABEL = /^[A-Z]{2,}[A-Za-z()/&. -]{0,38}$/;
/** Citation debris ends at the last "]" or ")/" before the label. */
const DEBRIS_END = /.*(?:\]|\)\s*\/)\s*/;

/**
 * Source summaries often begin with the tail of a stripped citation:
 *   "Haryana)[01-08-2026] GST: Where complaint alleged…"
 *   "THANE)/ GST/Excise: Where refund order…"
 * This removes that debris and separates the domain label from the headnote.
 */
export function cleanSummary(input: unknown, sections = ""): CleanSummary {
  const text = cleanText(input);
  const head = text.slice(0, 130);
  const colon = head.indexOf(": ");

  if (colon > 0) {
    const before = head.slice(0, colon);
    const candidate = before.replace(DEBRIS_END, "").trim();
    if (LABEL.test(candidate)) {
      const domainLabel = candidate.replace(/\s*\(\s*/g, " (").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
      return {
        summary: text.slice(colon + 2).trim(),
        domainLabel,
        domain: domainFromLabel(domainLabel),
        labelled: true,
      };
    }
  }

  // No label: still drop a leading citation fragment such as "…)[06-07-2026] ".
  const debris = text.match(/^[^\]]{0,70}\[\d{2}-\d{2}-\d{4}\]\s*/) ?? text.match(/^\d{2}-\d{4}\]\s*/);
  return {
    summary: (debris ? text.slice(debris[0].length) : text).trim(),
    domainLabel: "",
    domain: domainFromSections(sections),
    labelled: false,
  };
}
