export const PROFESSIONS = [
  { value: "ca", label: "Chartered Accountant", short: "CA" },
  { value: "advocate", label: "Advocate / Tax counsel", short: "Advocate" },
  { value: "tax_practitioner", label: "Tax consultant / Practitioner", short: "Tax practitioner" },
  { value: "cs", label: "Company Secretary", short: "CS" },
  { value: "cma", label: "Cost Accountant", short: "CMA" },
  { value: "in_house", label: "In-house finance or tax", short: "In-house" },
  { value: "business", label: "Business owner", short: "Business owner" },
  { value: "student", label: "Student", short: "Student" },
  { value: "other", label: "Other", short: "Member" },
] as const;

export type ProfessionValue = (typeof PROFESSIONS)[number]["value"];

export const PROFESSION_VALUES = PROFESSIONS.map((p) => p.value) as [ProfessionValue, ...ProfessionValue[]];

export function professionShort(value: string | null | undefined): string | null {
  return PROFESSIONS.find((p) => p.value === value)?.short ?? null;
}
