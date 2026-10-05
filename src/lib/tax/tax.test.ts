import { describe, expect, it } from "vitest";

import { gst } from "./gst";
import { hraExemption, isMetro } from "./hra";
import { compareRegimes, taxOn, type IncomeTaxInput } from "./income-tax";

const none: IncomeTaxInput["deductions"] = { investments: 0, healthInsurance: 0, homeLoanInterest: 0, nps: 0, hraExemption: 0, other: 0 };

describe("income tax — new regime", () => {
  it("is nil up to ₹12 lakh of taxable income (rebate)", () => {
    expect(taxOn(12_00_000, "new").total).toBe(0);
  });

  it("caps the tax just above ₹12 lakh at the excess (marginal relief)", () => {
    // ₹12.1 lakh: slab tax ₹61,500 is capped at ₹10,000, plus 4% cess.
    expect(taxOn(12_10_000, "new").total).toBe(10_400);
  });

  it("taxes ₹16 lakh at ₹1,20,000 plus cess", () => {
    expect(taxOn(16_00_000, "new").total).toBe(1_24_800);
  });

  it("gives a salaried person ₹12.75 lakh tax-free (₹75,000 standard deduction)", () => {
    const result = compareRegimes({ age: "below60", salary: 12_75_000, otherIncome: 0, employerNps: 0, deductions: none });
    expect(result.new.total).toBe(0);
  });

  it("adds 10% surcharge above ₹50 lakh", () => {
    // ₹60 lakh: slab tax ₹13,80,000 (₹3 lakh up to ₹24 lakh, 30% of the next ₹36 lakh) + 10% surcharge + 4% cess.
    expect(taxOn(60_00_000, "new").total).toBe(15_78_720);
  });

  it("applies marginal relief just above the ₹50 lakh surcharge threshold", () => {
    // Tax + surcharge may not exceed ₹10,80,000 (tax at ₹50 lakh) + ₹10,000.
    expect(taxOn(50_10_000, "new").total).toBe(11_33_600);
  });

  it("caps the surcharge at 25%", () => {
    const at6cr = taxOn(6_00_00_000, "new");
    expect(at6cr.surcharge).toBeCloseTo(at6cr.slabTax * 0.25, 0);
  });
});

describe("income tax — old regime", () => {
  it("is nil up to ₹5 lakh (rebate of up to ₹12,500)", () => {
    expect(taxOn(5_00_000, "old").total).toBe(0);
  });

  it("taxes ₹10 lakh at ₹1,12,500 plus cess", () => {
    expect(taxOn(10_00_000, "old").total).toBe(1_17_000);
  });

  it("gives senior citizens a higher exemption", () => {
    expect(taxOn(6_00_000, "old", "60to79").slabTax).toBe(30_000); // 5% of ₹2L + 20% of ₹1L
    expect(taxOn(6_00_000, "old", "80plus").slabTax).toBe(20_000);
  });

  it("goes up to 37% surcharge above ₹5 crore", () => {
    const result = taxOn(6_00_00_000, "old");
    expect(result.surcharge).toBeCloseTo(result.slabTax * 0.37, 0);
  });

  it("recommends the old regime when deductions are large", () => {
    const result = compareRegimes({
      age: "below60",
      salary: 15_00_000,
      otherIncome: 0,
      employerNps: 0,
      deductions: { investments: 1_50_000, healthInsurance: 50_000, homeLoanInterest: 2_00_000, nps: 50_000, hraExemption: 2_40_000, other: 0 },
    });
    expect(result.better).toBe("old");
    expect(result.saving).toBeGreaterThan(0);
  });

  it("caps each deduction at its legal limit", () => {
    const capped = compareRegimes({ age: "below60", salary: 20_00_000, otherIncome: 0, employerNps: 0, deductions: { ...none, investments: 5_00_000 } });
    const atLimit = compareRegimes({ age: "below60", salary: 20_00_000, otherIncome: 0, employerNps: 0, deductions: { ...none, investments: 1_50_000 } });
    expect(capped.old.total).toBe(atLimit.old.total);
  });
});

describe("HRA", () => {
  it("exempts the least of the three limits", () => {
    const result = hraExemption({ salary: 6_00_000, hraReceived: 3_00_000, rentPaid: 2_40_000, metro: true });
    expect(result.exempt).toBe(1_80_000);
    expect(result.taxable).toBe(1_20_000);
  });

  it("treats Bengaluru as a metro from tax year 2026-27 only", () => {
    expect(isMetro("Bengaluru", "2026-27")).toBe(true);
    expect(isMetro("Bengaluru", "2025-26")).toBe(false);
    expect(isMetro("Mumbai", "2025-26")).toBe(true);
  });
});

describe("GST", () => {
  it("adds 18% and splits it into CGST and SGST within a state", () => {
    const result = gst({ amount: 1000, rate: 18, mode: "add", supply: "intra" });
    expect(result.gross).toBe(1180);
    expect(result.cgst).toBe(90);
    expect(result.igst).toBe(0);
  });

  it("removes GST from an inclusive price as IGST between states", () => {
    const result = gst({ amount: 1180, rate: 18, mode: "remove", supply: "inter" });
    expect(result.net).toBeCloseTo(1000, 6);
    expect(result.igst).toBeCloseTo(180, 6);
  });
});
