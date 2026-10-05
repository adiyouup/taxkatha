/** Human-readable labels for enum values, shared by server and client. */

export const COURT_TYPE_LABEL = {
  supreme_court: "Supreme Court",
  high_court: "High Courts",
  gstat: "GST Appellate Tribunal",
  cestat: "CESTAT",
  itat: "ITAT",
  aaar: "Appellate AAR",
  aar: "Advance Ruling Authority",
  naa: "Anti-profiteering Authority",
  tribunal: "Other tribunals",
  other: "Other forums",
} as const;

export type CourtType = keyof typeof COURT_TYPE_LABEL;

export const DOMAIN_LABEL = {
  gst: "GST",
  income_tax: "Income-tax",
  customs: "Customs",
  excise: "Central Excise",
  service_tax: "Service tax",
  vat: "VAT",
  ibc: "Insolvency",
  other: "Other",
} as const;

export type TaxDomain = keyof typeof DOMAIN_LABEL;

export type OutcomeSide = "assessee" | "revenue" | "partly" | "unknown";

export const OUTCOME_FILTERS = [
  { value: "assessee", label: "In favour of assessee" },
  { value: "revenue", label: "In favour of revenue" },
  { value: "partly", label: "Partly allowed" },
] as const;

export function outcomeShort(side: OutcomeSide): string | null {
  if (side === "assessee") return "For assessee";
  if (side === "revenue") return "For revenue";
  if (side === "partly") return "Partly allowed";
  return null;
}

export function outcomeLong(side: OutcomeSide, remanded: boolean): string {
  const base =
    side === "assessee"
      ? "In favour of the assessee"
      : side === "revenue"
        ? "In favour of the revenue"
        : side === "partly"
          ? "Partly in favour of the assessee"
          : remanded
            ? "Matter remanded"
            : "See the decision";
  return remanded && side !== "unknown" ? `${base}; matter remanded` : base;
}
