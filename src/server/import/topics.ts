import { cleanText, matchKey, slugify } from "./text";

/*
 * Topic taxonomy. The source's "Background and Issue" cell opens with a
 * subject label before the first " - " ("Demands - Limitation period - …").
 * Labels are noisy (typos, plural/singular, one-off product names), so they
 * are mapped onto a curated set. Unknown labels become *unreviewed* topics an
 * admin can rename or merge later — they are never shown publicly as-is.
 */

export type CanonicalTopic = { name: string; slug: string; description: string; aliases: string[] };

export const CANONICAL_TOPICS: CanonicalTopic[] = [
  {
    name: "Demands & adjudication",
    slug: "demands-adjudication",
    description: "Show-cause notices, adjudication orders, limitation and natural justice in demand proceedings.",
    aliases: [
      "Demands", "Demand", "Demand and recovery", "Adjudication", "Tax, interest or penalty liability",
      "Time-barred reassessment", "Bias in adjudication", "Hearing notice requirement", "Monetary limit",
    ],
  },
  {
    name: "Input tax credit",
    slug: "input-tax-credit",
    description: "Eligibility, time limits, blocked credits, mismatches and the electronic credit ledger.",
    aliases: [
      "Input tax credit", "ITC", "ITC head-wise mismatch",
      "Conditions of use of amount available in electronic credit ledger", "Electronic Credit Ledger, blocking of",
      "Pre-GST credit jurisdiction",
    ],
  },
  {
    name: "Registration",
    slug: "registration",
    description: "Grant, cancellation, suspension and revocation of registration.",
    aliases: ["Registration", "Cancellation of registration", "Revocation of cancellation"],
  },
  {
    name: "Appeals to Appellate Authority",
    slug: "appellate-authority",
    description: "First appeals: limitation, condonation of delay, pre-deposit and maintainability.",
    aliases: ["Appellate Authority", "Appeal maintainability", "Scope of appeal", "Pre-deposit", "Appeals"],
  },
  {
    name: "Appeals to Appellate Tribunal",
    slug: "appellate-tribunal",
    description: "Appeals before the GST Appellate Tribunal and other tribunals.",
    aliases: ["Appellate Tribunal", "Tribunal pre-deposit"],
  },
  {
    name: "Penalty & confiscation",
    slug: "penalty",
    description: "Penalties, confiscation of goods or conveyances, and proportionality.",
    aliases: ["Penalty", "Confiscation of goods or conveyances and levy of penalty", "Penalties"],
  },
  {
    name: "Refund",
    slug: "refund",
    description: "Refund claims, limitation, zero-rated supplies and inverted duty structure.",
    aliases: ["Refund", "Refunds", "Refund of ITC", "Refund application", "Refund of IGST", "GST refund"],
  },
  {
    name: "Service of notices & orders",
    slug: "service-of-notices-orders",
    description: "Valid service, portal uploads and communication of notices and orders.",
    aliases: [
      "Service of order, notice, etc.", "Service of notices/orders", "Service of notices/orders etc.",
      "Service of orders/notices, etc.", "Service of notice",
    ],
  },
  {
    name: "Anti-profiteering",
    slug: "anti-profiteering",
    description: "Passing on the benefit of rate reductions and input tax credit.",
    aliases: ["Anti-profiteering measure", "Anti Profiteering measures", "Anti profiteering measure", "Anti-profiteering"],
  },
  {
    name: "Arrest & bail",
    slug: "arrest-bail",
    description: "Arrest powers, anticipatory and regular bail in tax offences.",
    aliases: ["Arrest", "Bail", "Anticipatory bail"],
  },
  {
    name: "Assessment",
    slug: "assessment",
    description: "Scrutiny, best-judgment and provisional assessments.",
    aliases: ["Assessment", "Assessments", "Scrutiny of returns"],
  },
  {
    name: "Detention in transit",
    slug: "detention-in-transit",
    description: "Detention and release of goods and conveyances, e-way bills.",
    aliases: [
      "Detention of goods and conveyance in transit", "Detention of goods and conveyances in transit",
      "Detention, seizure and release of goods and conveyances in transit", "E-way bill",
    ],
  },
  {
    name: "Recovery & attachment",
    slug: "recovery-attachment",
    description: "Recovery proceedings, garnishee notices and provisional attachment.",
    aliases: ["Recovery", "Provisional attachment", "Recovery of tax"],
  },
  {
    name: "Offences & prosecution",
    slug: "offences-prosecution",
    description: "Prosecution, compounding and liability of company officers.",
    aliases: ["Punishments for certain offences", "Offences", "Prosecution", "Compounding of offences"],
  },
  {
    name: "Levy & collection",
    slug: "levy-collection",
    description: "Taxable events, charge of tax, reverse charge and composite levies.",
    aliases: [
      "Levy and collection of tax", "Levy of purchase tax", "No deemed sale", "Composite levy", "Inter-State supply",
      "Job work", "Reverse charge",
    ],
  },
  {
    name: "Government contractors",
    slug: "government-contractors",
    description: "GST impact on works awarded before and after the GST regime, and reimbursement claims.",
    aliases: ["Government contractors", "Works contract"],
  },
  {
    name: "Returns",
    slug: "returns",
    description: "Filing, rectification and revision of returns.",
    aliases: ["Returns", "Revision of returns", "Return"],
  },
  {
    name: "Search & seizure",
    slug: "search-seizure",
    description: "Inspection, search, seizure of goods, documents and cash.",
    aliases: ["Search and seizure", "Search, seizure", "Inspection, search and seizure"],
  },
  {
    name: "Interest & waiver",
    slug: "interest-waiver",
    description: "Interest on delayed payment and waiver schemes for interest and penalty.",
    aliases: ["Interest", "IInterest", "Interest or penalty, waiver of", "Interest and penalty, waiver of"],
  },
  {
    name: "Officers & jurisdiction",
    slug: "officers-jurisdiction",
    description: "Proper officer, cross-empowerment and parallel proceedings.",
    aliases: ["State/UT GST Officers", "GST Officers", "Officers, appointment of", "Proper officer"],
  },
  {
    name: "Transitional provisions",
    slug: "transitional-provisions",
    description: "Carry-forward of pre-GST credit and transitional claims.",
    aliases: ["Transitional Provisions", "Transitional credit"],
  },
  {
    name: "Supply & valuation",
    slug: "supply-valuation",
    description: "Scope, place and value of supply, zero-rating and intermediary services.",
    aliases: [
      "Supply", "Supply – Zero rated supply", "Place of supply of services – Supplier located outside India",
      "Corporate guarantee – Valuation – Uniform valuation of 1%", "Intermediary classification",
      "Liquidated damages recoverd from transporters", "Extending deposits, loans or advances",
      "Electricity cost recovery by facility manager", "Valuation", "Place of supply", "Place of supply of services",
      "Corporate guarantee", "Zero rated supply",
    ],
  },
  {
    name: "Exemptions",
    slug: "exemptions",
    description: "Exempt supplies and the scope of exemption notifications.",
    aliases: [
      "Exemption", "Exemptions", "Affiliation Fee", "University affiliation fee", "Municipal function",
      "Women development seminars conducted by Project implementation agencies",
      "Pollution control and waste treatment services", "General waste collection services",
      "Highway construction and toll collection", "Licensing services for film broadcast and show",
      "Insolvency and receivership services",
    ],
  },
  {
    name: "Classification & rate",
    slug: "classification-rate",
    description: "Classification of goods and services and the applicable rate of tax.",
    aliases: [
      "Classification", "Rate of tax", "Washing/Laundry Soap", "Ophthalmic binocular surgical microscope",
      "Red clay bricks", "Tobacco leaves", "Electric three-wheeler (e-rickshaw)", "Hookah flavours",
      "Compostable bags and packing materials", "Unmanufactured tobacco",
      "Food grains supplied in unit container using unregistered brand names",
    ],
  },
  {
    name: "Advance ruling",
    slug: "advance-ruling",
    description: "Maintainability and scope of advance ruling applications.",
    aliases: ["Advance Ruling", "Advance Ruling Application"],
  },
  {
    name: "Rectification",
    slug: "rectification",
    description: "Rectification of errors apparent on the record.",
    aliases: ["Rectification of mistake", "Rectification"],
  },
  {
    name: "Cess",
    slug: "cess",
    description: "Compensation cess and other cesses.",
    aliases: ["Health Security Cess", "Health Security se National Security Cess", "Manner of computation of CESS", "Cess"],
  },
  {
    name: "Writs & constitutional remedies",
    slug: "writs-constitutional-remedies",
    description: "Maintainability of writ petitions and judicial review.",
    aliases: ["Maintainability of writ petition", "Tender judicial review", "Special law primacy", "Writ jurisdiction"],
  },
];

/** Alias key → canonical slug, for labels that appear in source files. */
export const DEFAULT_ALIAS_INDEX: ReadonlyMap<string, string> = new Map(
  CANONICAL_TOPICS.flatMap((topic) => [topic.name, ...topic.aliases].map((alias) => [topicAliasKey(alias), topic.slug] as const)),
);

const NAME_BY_SLUG: ReadonlyMap<string, string> = new Map(CANONICAL_TOPICS.map((t) => [t.slug, t.name]));

/** The curated topic a raw label key maps to by default, or null when it is not known. */
export function canonicalTopicName(key: string): string | null {
  const slug = DEFAULT_ALIAS_INDEX.get(key);
  return slug ? (NAME_BY_SLUG.get(slug) ?? null) : null;
}

/** Case-, punctuation- and spacing-insensitive key for a raw topic label. */
export function topicAliasKey(label: string): string {
  return matchKey(label);
}

export type TopicLabel = { label: string; key: string } | null;

/**
 * Extracts the subject label that opens a background cell. Returns null when
 * the opening segment is not label-like (too long, or itself a sentence).
 */
export function extractTopicLabel(background: unknown): TopicLabel {
  const text = cleanText(background).replace(/^[\\/|\s]+/, "");
  const separator = text.search(/\s[-–—]\s/);
  if (separator <= 0) return null;
  const label = text.slice(0, separator).trim();
  if (label.length < 3 || label.length > 80) return null;
  if (/[:.]\s/.test(label) || /^(where|whether|in an?|the|gst)\b/i.test(label)) return null;
  // "Section 53 of the Insolvency and Bankruptcy Code…" is a citation, not a subject.
  if (/^(section|rule|article|notification)\b/i.test(label)) return null;
  return { label, key: topicAliasKey(label) };
}

export function topicSlugForNew(label: string): string {
  return slugify(label, 60);
}
