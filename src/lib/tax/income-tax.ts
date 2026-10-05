import { roundToTen } from "@/lib/finance/math";

/*
 * Income tax for resident individuals on normal income (salary, interest,
 * rent and the like — not capital gains or other specially taxed income).
 *
 * Rates are the same for FY 2025-26 (AY 2026-27) and tax year 2026-27, the
 * first year under the Income-tax Act, 2025: Budget 2026 left the slabs,
 * rebate and standard deduction unchanged.
 */

export type Regime = "new" | "old";
export type AgeGroup = "below60" | "60to79" | "80plus";
export const TAX_YEARS = ["2026-27", "2025-26"] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

export const TAX_YEAR_LABEL: Record<TaxYear, string> = {
  "2026-27": "Tax year 2026-27 (filed in 2027)",
  "2025-26": "FY 2025-26 · AY 2026-27",
};

type Slab = { upTo: number; rate: number };

const NEW_SLABS: Slab[] = [
  { upTo: 4_00_000, rate: 0 },
  { upTo: 8_00_000, rate: 5 },
  { upTo: 12_00_000, rate: 10 },
  { upTo: 16_00_000, rate: 15 },
  { upTo: 20_00_000, rate: 20 },
  { upTo: 24_00_000, rate: 25 },
  { upTo: Infinity, rate: 30 },
];

function oldSlabs(age: AgeGroup): Slab[] {
  const exempt = age === "80plus" ? 5_00_000 : age === "60to79" ? 3_00_000 : 2_50_000;
  return [
    { upTo: exempt, rate: 0 },
    ...(exempt < 5_00_000 ? [{ upTo: 5_00_000, rate: 5 }] : []),
    { upTo: 10_00_000, rate: 20 },
    { upTo: Infinity, rate: 30 },
  ];
}

export const STANDARD_DEDUCTION: Record<Regime, number> = { new: 75_000, old: 50_000 };
/** Taxable income up to which the rebate wipes out the tax. */
export const REBATE_LIMIT: Record<Regime, number> = { new: 12_00_000, old: 5_00_000 };
const OLD_REBATE_MAX = 12_500;

export type SlabRow = { from: number; to: number; rate: number; tax: number };

function slabTax(income: number, slabs: Slab[]): { tax: number; rows: SlabRow[] } {
  const rows: SlabRow[] = [];
  let from = 0;
  let tax = 0;
  for (const slab of slabs) {
    if (income <= from) break;
    const to = Math.min(income, slab.upTo);
    const part = ((to - from) * slab.rate) / 100;
    rows.push({ from, to, rate: slab.rate, tax: part });
    tax += part;
    from = slab.upTo;
  }
  return { tax, rows };
}

const SURCHARGE_BANDS = [
  { above: 5_00_00_000, rate: 37 },
  { above: 2_00_00_000, rate: 25 },
  { above: 1_00_00_000, rate: 15 },
  { above: 50_00_000, rate: 10 },
] as const;

function surchargeRate(income: number, regime: Regime): number {
  const band = SURCHARGE_BANDS.find((b) => income > b.above);
  if (!band) return 0;
  // The new regime caps surcharge at 25%.
  return regime === "new" ? Math.min(band.rate, 25) : band.rate;
}

export type TaxBreakdown = {
  regime: Regime;
  taxableIncome: number;
  slabTax: number;
  rebate: number;
  surcharge: number;
  cess: number;
  total: number;
  rows: SlabRow[];
};

/** Tax on a taxable income (after deductions) under one regime. */
export function taxOn(taxableIncome: number, regime: Regime, age: AgeGroup = "below60"): TaxBreakdown {
  const income = roundToTen(Math.max(0, taxableIncome));
  const slabs = regime === "new" ? NEW_SLABS : oldSlabs(age);
  const { tax: base, rows } = slabTax(income, slabs);

  // Rebate: nothing to pay up to the limit. In the new regime the tax just above it
  // is capped at the income in excess of ₹12 lakh (marginal relief).
  let afterRebate = base;
  if (regime === "new") {
    if (income <= REBATE_LIMIT.new) afterRebate = 0;
    else afterRebate = Math.min(base, income - REBATE_LIMIT.new);
  } else if (income <= REBATE_LIMIT.old) {
    afterRebate = Math.max(0, base - OLD_REBATE_MAX);
  }

  // Surcharge, with marginal relief: crossing a threshold can never cost more than the income above it.
  let surcharge = (afterRebate * surchargeRate(income, regime)) / 100;
  const band = SURCHARGE_BANDS.find((b) => income > b.above);
  if (band) {
    const atThreshold = slabTax(band.above, slabs).tax;
    const ceiling = atThreshold * (1 + surchargeRate(band.above, regime) / 100) + (income - band.above);
    surcharge = Math.max(0, Math.min(surcharge, ceiling - afterRebate));
  }

  const cess = ((afterRebate + surcharge) * 4) / 100;
  return {
    regime,
    taxableIncome: income,
    slabTax: base,
    rebate: base - afterRebate,
    surcharge,
    cess,
    total: roundToTen(afterRebate + surcharge + cess),
    rows,
  };
}

export type IncomeTaxInput = {
  age: AgeGroup;
  /** Gross salary or pension for the year. */
  salary: number;
  /** Interest, rent (after its own deduction), freelance profit and other normal income. */
  otherIncome: number;
  /** Employer's NPS contribution — deductible in both regimes. */
  employerNps: number;
  /** Old regime only. */
  deductions: {
    /** PPF, ELSS, life insurance, EPF, principal on a home loan… (section 80C of the 1961 Act), up to ₹1.5 lakh. */
    investments: number;
    /** Health insurance premiums (80D). */
    healthInsurance: number;
    /** Interest on a home loan for a self-occupied house, up to ₹2 lakh. */
    homeLoanInterest: number;
    /** Your own extra NPS contribution (80CCD(1B)), up to ₹50,000. */
    nps: number;
    /** Exempt part of house rent allowance. */
    hraExemption: number;
    /** Anything else: education-loan interest, donations, savings interest… */
    other: number;
  };
};

export const DEDUCTION_LIMITS = { investments: 1_50_000, healthInsurance: 1_00_000, homeLoanInterest: 2_00_000, nps: 50_000 } as const;

export function taxableIncome(input: IncomeTaxInput, regime: Regime): number {
  const salary = Math.max(0, input.salary);
  const standard = Math.min(salary, STANDARD_DEDUCTION[regime]);
  let income = salary - standard + Math.max(0, input.otherIncome) - Math.max(0, input.employerNps);
  if (regime === "old") {
    const d = input.deductions;
    income -=
      Math.min(Math.max(0, d.hraExemption), salary) +
      Math.min(Math.max(0, d.investments), DEDUCTION_LIMITS.investments) +
      Math.min(Math.max(0, d.healthInsurance), DEDUCTION_LIMITS.healthInsurance) +
      Math.min(Math.max(0, d.homeLoanInterest), DEDUCTION_LIMITS.homeLoanInterest) +
      Math.min(Math.max(0, d.nps), DEDUCTION_LIMITS.nps) +
      Math.max(0, d.other);
  }
  return Math.max(0, income);
}

/** Both regimes side by side, and which one costs less. */
export function compareRegimes(input: IncomeTaxInput) {
  const results = {
    new: taxOn(taxableIncome(input, "new"), "new", input.age),
    old: taxOn(taxableIncome(input, "old"), "old", input.age),
  };
  const better: Regime = results.old.total < results.new.total ? "old" : "new";
  return { ...results, better, saving: Math.abs(results.new.total - results.old.total) };
}
