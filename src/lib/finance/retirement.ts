import { monthlyFromAnnual } from "./math";

export type EpfYear = { year: number; age: number; employee: number; employer: number; interest: number; balance: number };

/** The EPS part of the employer's 12% is 8.33% of wages capped at ₹15,000 a month (₹1,250). */
const EPS_WAGE_CAP = 15_000;
const EPS_RATE = 8.33 / 100;

/**
 * Employees' Provident Fund: 12% from the employee and the employer's 12%
 * less the pension (EPS) share, with interest worked out monthly on the
 * running balance and credited at the end of each year.
 */
export function epf({
  monthlyWages,
  age,
  retirementAge = 58,
  balance: opening = 0,
  salaryGrowth = 5,
  annualRate = 8.25,
  employeePercent = 12,
}: {
  monthlyWages: number;
  age: number;
  retirementAge?: number;
  balance?: number;
  salaryGrowth?: number;
  annualRate?: number;
  employeePercent?: number;
}) {
  const schedule: EpfYear[] = [];
  let wages = monthlyWages;
  let balance = opening;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalInterest = 0;

  for (let year = 1; year <= Math.max(0, retirementAge - age); year++) {
    let employee = 0;
    let employer = 0;
    let interest = 0;
    let running = balance;
    for (let month = 0; month < 12; month++) {
      const own = (wages * employeePercent) / 100;
      const eps = Math.min(wages, EPS_WAGE_CAP) * EPS_RATE;
      const theirs = wages * 0.12 - eps;
      employee += own;
      employer += theirs;
      running += own + theirs;
      interest += running * (annualRate / 100 / 12);
    }
    balance = running + interest;
    totalEmployee += employee;
    totalEmployer += employer;
    totalInterest += interest;
    schedule.push({ year, age: age + year, employee, employer, interest, balance });
    wages *= 1 + salaryGrowth / 100;
  }
  return { corpus: balance, totalEmployee, totalEmployer, totalInterest, opening, years: schedule };
}

/**
 * National Pension System. Since PFRDA's December 2025 changes, non-government
 * subscribers with a corpus above ₹12 lakh can take up to 80% as a lump sum
 * and must buy an annuity with at least 20%. Only 60% of the corpus is
 * tax-free on withdrawal until the income-tax law is amended.
 */
export function nps({
  monthly,
  age,
  retirementAge = 60,
  annualReturn = 10,
  annuityPercent = 40,
  annuityRate = 6,
  stepUp = 0,
}: {
  monthly: number;
  age: number;
  retirementAge?: number;
  annualReturn?: number;
  annuityPercent?: number;
  annuityRate?: number;
  stepUp?: number;
}) {
  const i = monthlyFromAnnual(annualReturn);
  let amount = monthly;
  let invested = 0;
  let corpus = 0;
  const months = Math.max(0, retirementAge - age) * 12;
  for (let month = 1; month <= months; month++) {
    if (month > 1 && (month - 1) % 12 === 0) amount *= 1 + stepUp / 100;
    invested += amount;
    corpus = (corpus + amount) * (1 + i);
  }
  const annuity = (corpus * annuityPercent) / 100;
  const lumpSum = corpus - annuity;
  return {
    invested,
    corpus,
    gains: corpus - invested,
    lumpSum,
    taxFreeLumpSum: Math.min(lumpSum, corpus * 0.6),
    annuity,
    monthlyPension: (annuity * annuityRate) / 100 / 12,
  };
}

/** Maximum gratuity that is free of income tax for non-government employees (lifetime, all employers). */
export const GRATUITY_TAX_FREE_LIMIT = 20_00_000;

/**
 * Gratuity. Employees covered by the Code on Social Security (earlier the
 * Payment of Gratuity Act) get 15 days' wages for each year of service, a
 * month counted as 26 working days, and a final part-year of more than six
 * months counts as a full year. Others get half a month's wages for each
 * completed year.
 */
export function gratuity({ monthlyWages, years, months = 0, covered = true, government = false }: { monthlyWages: number; years: number; months?: number; covered?: boolean; government?: boolean }) {
  const serviceYears = covered ? years + (months > 6 ? 1 : 0) : years;
  const amount = covered ? (monthlyWages * 15 * serviceYears) / 26 : (monthlyWages * 15 * serviceYears) / 30;
  const exempt = government ? amount : Math.min(amount, GRATUITY_TAX_FREE_LIMIT);
  return { amount, serviceYears, exempt, taxable: amount - exempt };
}
