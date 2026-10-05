import { describe, expect, it } from "vitest";

import { fd, rd, yearlyScheme } from "./deposits";
import { cagr, lumpsum, sip, swp } from "./investments";
import { emi, loan } from "./loans";
import { monthlyFromAnnual } from "./math";
import { epf, gratuity, nps } from "./retirement";

describe("loans", () => {
  it("matches the standard EMI for ₹10 lakh at 10% over 20 years", () => {
    expect(emi(10_00_000, 10, 240)).toBeCloseTo(9650.22, 1);
  });

  it("repays the principal exactly, with interest = payments − principal", () => {
    const result = loan(25_00_000, 8.5, 240);
    const repaid = result.years.reduce((sum, y) => sum + y.principal, 0);
    expect(repaid).toBeCloseTo(25_00_000, 2);
    expect(result.years).toHaveLength(20);
    expect(result.years.at(-1)!.balance).toBeCloseTo(0, 2);
    expect(result.totalPayment).toBeCloseTo(result.emi * 240, 0);
  });

  it("handles a zero interest rate", () => {
    expect(emi(1_20_000, 0, 12)).toBe(10_000);
  });
});

describe("investments", () => {
  it("compounds 12% a year as 0.9489% a month", () => {
    expect(monthlyFromAnnual(12)).toBeCloseTo(0.009489, 6);
  });

  it("matches Groww's SIP example: ₹1,000 a month for a year at 12% is about ₹12,766", () => {
    const result = sip({ monthly: 1000, annualReturn: 12, years: 1 });
    expect(result.invested).toBe(12_000);
    expect(result.value).toBeCloseTo(12_766, -1);
  });

  it("equals the closed-form annuity-due formula without step-up", () => {
    const i = monthlyFromAnnual(12);
    const n = 120;
    const closed = 10_000 * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    expect(sip({ monthly: 10_000, annualReturn: 12, years: 10 }).value).toBeCloseTo(closed, 4);
  });

  it("raises the instalment every year with a step-up", () => {
    const flat = sip({ monthly: 10_000, annualReturn: 12, years: 10 });
    const stepped = sip({ monthly: 10_000, annualReturn: 12, years: 10, stepUp: 10 });
    // ₹10,000 rising 10% a year: 12 × 10,000 × (1.1^10 − 1) / 0.1 invested.
    expect(stepped.invested).toBeCloseTo(12 * 10_000 * ((Math.pow(1.1, 10) - 1) / 0.1), 2);
    expect(stepped.value).toBeGreaterThan(flat.value);
  });

  it("grows a lump sum annually", () => {
    expect(lumpsum({ amount: 1_00_000, annualReturn: 12, years: 10 }).value).toBeCloseTo(3_10_584.82, 1);
  });

  it("pays withdrawals from the start of each month", () => {
    const result = swp({ corpus: 50_000, monthlyWithdrawal: 1_000, annualReturn: 10, years: 1 });
    expect(result.withdrawn).toBe(12_000);
    expect(result.monthsPaid).toBe(12);
    expect(result.finalValue + result.withdrawn - result.returns).toBeCloseTo(50_000, 6);
  });

  it("stops when the money runs out", () => {
    const result = swp({ corpus: 1_00_000, monthlyWithdrawal: 20_000, annualReturn: 8, years: 1 });
    expect(result.monthsPaid).toBe(5);
    expect(result.finalValue).toBeCloseTo(0, 6);
  });

  it("computes CAGR", () => {
    expect(cagr({ start: 1_00_000, end: 2_00_000, years: 5 })).toBeCloseTo(14.87, 2);
  });
});

describe("deposits", () => {
  it("compounds an FD quarterly: ₹1 lakh at 7% for 5 years", () => {
    expect(fd({ principal: 1_00_000, annualRate: 7, months: 60 }).maturity).toBeCloseTo(1_41_478.3, 0);
  });

  it("matches the bank RD method: ₹5,000 a month for a year at 8.25% is ₹62,730.85", () => {
    expect(rd({ monthly: 5_000, annualRate: 8.25, months: 12 }).maturity).toBeCloseTo(62_730.85, 0);
  });

  it("matches the published PPF maturity: ₹1.5 lakh a year for 15 years at 7.1%", () => {
    const result = yearlyScheme({ yearly: 1_50_000, annualRate: 7.1, years: 15 });
    expect(result.invested).toBe(22_50_000);
    expect(Math.abs(result.maturity - 40_68_209)).toBeLessThan(100);
  });

  it("stops Sukanya Samriddhi deposits after 15 years but keeps compounding to 21", () => {
    const result = yearlyScheme({ yearly: 1_50_000, annualRate: 8.2, years: 21, depositYears: 15 });
    expect(result.invested).toBe(22_50_000);
    expect(result.years[15]!.deposit).toBe(0);
    expect(result.maturity).toBeGreaterThan(result.years[14]!.balance * 1.6);
  });
});

describe("retirement", () => {
  it("splits the employer's EPF share around the ₹1,250 pension cap", () => {
    const result = epf({ monthlyWages: 50_000, age: 57, retirementAge: 58, salaryGrowth: 0 });
    expect(result.years[0]!.employee).toBeCloseTo(12 * 6_000, 2);
    expect(result.years[0]!.employer).toBeCloseTo(12 * (6_000 - 1_249.5), 2);
    expect(result.corpus).toBeGreaterThan(result.totalEmployee + result.totalEmployer);
  });

  it("splits an NPS corpus into lump sum and annuity", () => {
    const result = nps({ monthly: 5_000, age: 30, annualReturn: 10, annuityPercent: 40, annuityRate: 6 });
    expect(result.lumpSum + result.annuity).toBeCloseTo(result.corpus, 4);
    expect(result.monthlyPension).toBeCloseTo((result.annuity * 0.06) / 12, 4);
    expect(result.taxFreeLumpSum).toBeCloseTo(result.lumpSum, 4);
  });

  it("taxes the part of an 80% NPS lump sum above 60% of the corpus", () => {
    const result = nps({ monthly: 5_000, age: 30, annuityPercent: 20 });
    expect(result.taxFreeLumpSum).toBeCloseTo(result.corpus * 0.6, 4);
  });

  it("computes gratuity with the 15/26 formula and rounds a part-year over six months up", () => {
    expect(gratuity({ monthlyWages: 50_000, years: 10 }).amount).toBeCloseTo(2_88_461.54, 1);
    expect(gratuity({ monthlyWages: 50_000, years: 10, months: 7 }).serviceYears).toBe(11);
    expect(gratuity({ monthlyWages: 50_000, years: 10, months: 6 }).serviceYears).toBe(10);
    expect(gratuity({ monthlyWages: 50_000, years: 10, covered: false }).amount).toBe(2_50_000);
  });

  it("caps tax-free gratuity at ₹20 lakh except for government employees", () => {
    const big = gratuity({ monthlyWages: 3_00_000, years: 30 });
    expect(big.exempt).toBe(20_00_000);
    expect(big.taxable).toBeCloseTo(big.amount - 20_00_000, 6);
    expect(gratuity({ monthlyWages: 3_00_000, years: 30, government: true }).taxable).toBe(0);
  });
});
