import { cleanText, slugify, titleCase } from "./text";

export type CourtType =
  | "supreme_court"
  | "high_court"
  | "gstat"
  | "cestat"
  | "itat"
  | "aaar"
  | "aar"
  | "naa"
  | "tribunal"
  | "other";

export type NormalizedCourt = {
  /** Light normalisation of the source string — used for the immutable source key. */
  rawKey: string;
  /** Canonical key the courts table is matched on. */
  key: string;
  name: string;
  shortName: string;
  type: CourtType;
  location: string | null;
  slug: string;
};

/** Spelling variants seen in source files → canonical place name. */
const LOCATION_ALIASES: Record<string, string> = {
  HRDERABAD: "HYDERABAD",
  TRIVANDRUM: "THIRUVANANTHAPURAM",
  TAMILNADU: "TAMIL NADU",
  BANGALORE: "BENGALURU",
  DELHI: "NEW DELHI",
  "NEW DELHI PRINCIPAL": "NEW DELHI",
  "PRINCIPAL NEW DELHI": "NEW DELHI",
  CALCUTTA: "KOLKATA",
  ORISSA: "ODISHA",
};

/** Bodies whose name is followed by a bench / state. Order matters: AAAR before AAR. */
const BODIES: { pattern: RegExp; type: CourtType; name: string; short: string }[] = [
  {
    pattern: /^APPELLATE AUTHORITY FOR ADVANCE RULINGS?\b/,
    type: "aaar",
    name: "Appellate Authority for Advance Ruling",
    short: "AAAR",
  },
  { pattern: /^AUTHORITY FOR ADVANCE RULINGS?\b/, type: "aar", name: "Authority for Advance Ruling", short: "AAR" },
  {
    pattern: /^GOODS AND SERVICES? TAX APPELLATE TRIBUNAL\b|^GSTAT\b/,
    type: "gstat",
    name: "GST Appellate Tribunal",
    short: "GSTAT",
  },
  {
    pattern: /^CUSTOMS,? EXCISE (?:AND|&) SERVICE TAX APPELLATE TRIBUNAL\b|^CESTAT\b/,
    type: "cestat",
    name: "Customs, Excise and Service Tax Appellate Tribunal",
    short: "CESTAT",
  },
  { pattern: /^INCOME[- ]TAX APPELLATE TRIBUNAL\b|^ITAT\b/, type: "itat", name: "Income Tax Appellate Tribunal", short: "ITAT" },
  {
    pattern: /^NATIONAL ANTI[- ]PROFITEERING AUTHORITY\b|^NAA\b/,
    type: "naa",
    name: "National Anti-profiteering Authority",
    short: "NAA",
  },
  {
    pattern: /^NATIONAL COMPANY LAW APPELLATE TRIBUNAL\b|^NCLAT\b/,
    type: "tribunal",
    name: "National Company Law Appellate Tribunal",
    short: "NCLAT",
  },
  { pattern: /^NATIONAL COMPANY LAW TRIBUNAL\b|^NCLT\b/, type: "tribunal", name: "National Company Law Tribunal", short: "NCLT" },
];

function canonicalLocation(raw: string): string | null {
  const cleaned = raw
    .replace(/[,.]/g, " ")
    .replace(/\b(PRINCIPAL\s+)?BENCH\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return LOCATION_ALIASES[cleaned] ?? cleaned;
}

/**
 * "GOODS AND SERVICE TAX APPELLATE TRIBUNAL , NEW DELHI BENCH" and
 * "...TRIBUNAL, NEW DELHI" are the same forum. This canonicalises the name
 * while keeping a light `rawKey` for identity.
 */
export function normalizeCourt(input: unknown): NormalizedCourt | null {
  const upper = cleanText(input).toUpperCase().replace(/\s*,\s*/g, ", ");
  if (!upper) return null;

  const rawKey = upper
    .replace(/[,.]/g, " ")
    .replace(/\b(PRINCIPAL\s+)?BENCH\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^SUPREME COURT\b/.test(upper)) {
    return {
      rawKey,
      key: "SUPREME COURT OF INDIA",
      name: "Supreme Court of India",
      shortName: "Supreme Court",
      type: "supreme_court",
      location: null,
      slug: "supreme-court-of-india",
    };
  }

  const highCourt = upper.match(/^HIGH COURT OF (.+)$/) ?? upper.match(/^(.+?) HIGH COURT$/);
  if (highCourt) {
    const seat = highCourt[1]!.replace(/\b(PRINCIPAL\s+)?BENCH\b/g, " ").replace(/\s+/g, " ").replace(/,\s*$/, "").trim();
    const seatTitle = titleCase(seat);
    return {
      rawKey,
      key: `HIGH COURT OF ${seat}`,
      name: `High Court of ${seatTitle}`,
      shortName: `${seatTitle} High Court`,
      type: "high_court",
      location: seatTitle,
      slug: slugify(`${seatTitle} high court`),
    };
  }

  for (const body of BODIES) {
    const match = upper.match(body.pattern);
    if (!match) continue;
    const location = canonicalLocation(upper.slice(match[0].length));
    const locationTitle = location ? titleCase(location) : null;
    return {
      rawKey,
      key: location ? `${body.short} ${location}` : body.short,
      name: locationTitle ? `${body.name}, ${locationTitle}` : body.name,
      shortName: locationTitle ? `${body.short} ${locationTitle}` : body.short,
      type: body.type,
      location: locationTitle,
      slug: slugify(locationTitle ? `${body.short} ${locationTitle}` : body.short),
    };
  }

  const name = titleCase(upper.replace(/\b(PRINCIPAL\s+)?BENCH\b/g, " ").replace(/\s+/g, " ").replace(/,\s*$/, "").trim());
  return {
    rawKey,
    key: rawKey,
    name,
    shortName: name,
    type: /TRIBUNAL/.test(upper) ? "tribunal" : "other",
    location: null,
    slug: slugify(name),
  };
}
