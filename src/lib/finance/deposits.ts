/*
 * Bank and post-office deposits and government savings schemes. Each follows
 * the scheme's own compounding rules, not the market-linked convention.
 */

export const COMPOUNDING = { monthly: 12, quarterly: 4, "half-yearly": 2, yearly: 1 } as const;
export type Compounding = keyof typeof COMPOUNDING;

/** A cumulative fixed deposit. Banks compound quarterly unless the product says otherwise. */
export function fd({ principal, annualRate, months, compounding = "quarterly" }: { principal: number; annualRate: number; months: number; compounding?: Compounding }) {
  const k = COMPOUNDING[compounding];
  const maturity = principal * Math.pow(1 + annualRate / 100 / k, (k * months) / 12);
  return { maturity, interest: maturity - principal };
}

/**
 * A recurring deposit: each monthly instalment earns interest compounded
 * quarterly for the time it stays deposited — the method banks and the post
 * office use (the first instalment earns for the full term, the last for one month).
 */
export function rd({ monthly, annualRate, months }: { monthly: number; annualRate: number; months: number }) {
  const quarterly = 1 + annualRate / 400;
  let maturity = 0;
  for (let remaining = 1; remaining <= months; remaining++) maturity += monthly * Math.pow(quarterly, remaining / 3);
  const invested = monthly * months;
  return { maturity, invested, interest: maturity - invested };
}

export type SchemeYear = { year: number; deposit: number; interest: number; balance: number };

/**
 * A yearly-contribution scheme compounded annually, with each year's deposit
 * made at the start of the year (PPF, Sukanya Samriddhi). `depositYears`
 * can be shorter than `years`: Sukanya Samriddhi takes deposits for 15 years
 * and matures at 21.
 */
export function yearlyScheme({ yearly, annualRate, years, depositYears = years }: { yearly: number; annualRate: number; years: number; depositYears?: number }) {
  const schedule: SchemeYear[] = [];
  let balance = 0;
  let invested = 0;
  for (let year = 1; year <= years; year++) {
    const deposit = year <= depositYears ? yearly : 0;
    invested += deposit;
    const interest = (balance + deposit) * (annualRate / 100);
    balance += deposit + interest;
    schedule.push({ year, deposit, interest, balance });
  }
  return { maturity: balance, invested, interest: balance - invested, years: schedule };
}

/** Current scheme rates (October–December 2026 quarter). Shown in the calculators as editable defaults. */
export const SCHEME_RATES = {
  ppf: 7.1,
  ssy: 8.2,
  nsc: 7.7,
  scss: 8.2,
  postOfficeRd: 6.7,
  epf: 8.25,
  asOf: "1 October 2026",
} as const;
