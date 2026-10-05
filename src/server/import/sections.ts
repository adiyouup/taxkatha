import { cleanText } from "./text";

/*
 * Parses "Relevant Sections" free text into filterable tags:
 *   "Section 74, read with sections 44, 65 and 168A, of Central Goods and
 *    Services Tax Act, 2017/Tamil Nadu Goods and Services Tax Act, 2017 -
 *    Rule 142 of Central Goods and Services Tax Rules, 2017"
 *   → ["CGST S.74", "CGST S.44", "CGST S.65", "CGST S.168A", "CGST Rules R.142"]
 * State GST Acts mirror the CGST Act section-for-section, so they fold in.
 */

type ActKind = "act" | "rules" | "constitution";

const ACTS: { pattern: RegExp; name: string; kind: ActKind }[] = [
  { pattern: /Constitution/i, name: "Constitution", kind: "constitution" },
  { pattern: /Integrated Goods and Services? Tax Rules/i, name: "IGST Rules", kind: "rules" },
  { pattern: /Integrated Goods and Services? Tax/i, name: "IGST", kind: "act" },
  { pattern: /Goods and Services? Tax \(Compensation to States\)/i, name: "GST Compensation", kind: "act" },
  { pattern: /Goods and Services? Tax Rules/i, name: "CGST Rules", kind: "rules" },
  { pattern: /Goods and Services? Tax/i, name: "CGST", kind: "act" },
  { pattern: /Customs Tariff/i, name: "Customs Tariff", kind: "act" },
  { pattern: /Customs/i, name: "Customs", kind: "act" },
  { pattern: /Central Excise Rules/i, name: "Central Excise Rules", kind: "rules" },
  { pattern: /Central Excise/i, name: "Central Excise", kind: "act" },
  { pattern: /Finance Act,? 1994/i, name: "Finance Act 1994", kind: "act" },
  { pattern: /Income[- ]tax Rules/i, name: "Income-tax Rules", kind: "rules" },
  { pattern: /Income[- ]tax/i, name: "Income-tax", kind: "act" },
  { pattern: /Insolvency and Bankruptcy/i, name: "IBC", kind: "act" },
  { pattern: /Bharatiya Nagarik Suraksha Sanhita/i, name: "BNSS", kind: "act" },
  { pattern: /Bharatiya Nyaya Sanhita/i, name: "BNS", kind: "act" },
  { pattern: /Code of Criminal Procedure/i, name: "CrPC", kind: "act" },
  { pattern: /Indian Penal Code/i, name: "IPC", kind: "act" },
  { pattern: /Negotiable Instruments/i, name: "NI Act", kind: "act" },
  { pattern: /Value Added Tax Rules/i, name: "VAT Rules", kind: "rules" },
  { pattern: /Value Added Tax/i, name: "VAT", kind: "act" },
  { pattern: /Central Sales Tax/i, name: "CST", kind: "act" },
  { pattern: /Limitation Act/i, name: "Limitation Act", kind: "act" },
  { pattern: /General Clauses Act/i, name: "General Clauses Act", kind: "act" },
  { pattern: /Companies Act/i, name: "Companies Act", kind: "act" },
];

const REFERENCE = /\b(sections?|rules?|articles?)\s+((?:\d+[A-Z]{0,3}(?:\s*\([0-9a-zA-Z]+\))*(?:\s*,\s*|\s+and\s+|\s*&\s*)?)+)/gi;

const MAX_TAGS = 16;

function actFor(clause: string, from: number, keyword: "section" | "rule" | "article"): string | null {
  if (keyword === "article") return "Constitution";
  const wanted: ActKind = keyword === "rule" ? "rules" : "act";

  const pick = (text: string) => {
    let best: { index: number; name: string } | null = null;
    for (const act of ACTS) {
      if (act.kind !== wanted) continue;
      for (const match of text.matchAll(new RegExp(act.pattern.source, "gi"))) {
        // An Act's pattern also matches inside its Rules' title; skip those hits.
        if (wanted === "act" && /^\s*Rules/i.test(text.slice(match.index + match[0].length))) continue;
        if (best === null || match.index < best.index) best = { index: match.index, name: act.name };
        break;
      }
    }
    return best?.name ?? null;
  };

  // The statute normally follows the reference ("Section 74 … of CGST Act").
  return pick(clause.slice(from)) ?? pick(clause);
}

export function parseSectionRefs(input: unknown): string[] {
  const text = cleanText(input);
  if (!text) return [];

  const tags: string[] = [];
  const seen = new Set<string>();

  for (const clause of text.split(/\s+[-–—]\s+|;\s*/)) {
    for (const match of clause.matchAll(REFERENCE)) {
      const keyword = match[1]!.toLowerCase().replace(/s$/, "") as "section" | "rule" | "article";
      const act = actFor(clause, (match.index ?? 0) + match[0].length, keyword);
      if (!act) continue;
      const prefix = keyword === "section" ? "S." : keyword === "rule" ? "R." : "Art.";
      const numbers = match[2]!.replace(/\([^)]*\)/g, " ");
      for (const number of numbers.matchAll(/\d+[A-Z]{0,3}/g)) {
        const tag = `${act} ${prefix}${number[0]}`;
        if (seen.has(tag)) continue;
        seen.add(tag);
        tags.push(tag);
        if (tags.length >= MAX_TAGS) return tags;
      }
    }
  }
  return tags;
}
