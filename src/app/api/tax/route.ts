import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { annualIncome = 0, regime = "new", deductions = 0 } = body;

    const income = Number(annualIncome) || 0;
    const totalDeductions = Number(deductions) || 0;

    let taxableIncome = 0;
    let taxAmount = 0;

    if (regime === "new") {
      // Modern simplified tax slab simulation (e.g. FY 2024-25 / 2025-26 New Regime with standard deduction of 75,000)
      const standardDeduction = 75000;
      taxableIncome = Math.max(0, income - standardDeduction);

      if (taxableIncome <= 300000) {
        taxAmount = 0;
      } else if (taxableIncome <= 700000) {
        taxAmount = (taxableIncome - 300000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        taxAmount = 20000 + (taxableIncome - 700000) * 0.10;
      } else if (taxableIncome <= 1200000) {
        taxAmount = 50000 + (taxableIncome - 1000000) * 0.15;
      } else if (taxableIncome <= 1500000) {
        taxAmount = 80000 + (taxableIncome - 1200000) * 0.20;
      } else {
        taxAmount = 140000 + (taxableIncome - 1500000) * 0.30;
      }

      // Rebate under 87A for income up to 7 Lakhs in new regime
      if (taxableIncome <= 700000) {
        taxAmount = 0;
      }
    } else {
      // Old Regime simulation (Standard deduction 50,000 + 80C + 80D etc.)
      const standardDeduction = 50000;
      taxableIncome = Math.max(0, income - standardDeduction - totalDeductions);

      if (taxableIncome <= 250000) {
        taxAmount = 0;
      } else if (taxableIncome <= 500000) {
        taxAmount = (taxableIncome - 250000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        taxAmount = 12500 + (taxableIncome - 500000) * 0.20;
      } else {
        taxAmount = 112500 + (taxableIncome - 1000000) * 0.30;
      }

      if (taxableIncome <= 500000) {
        taxAmount = 0;
      }
    }

    const cess = taxAmount * 0.04;
    const totalTax = Math.round(taxAmount + cess);
    const effectiveRate = income > 0 ? ((totalTax / income) * 100).toFixed(2) : "0.00";

    return NextResponse.json({
      status: "success",
      data: {
        annualIncome: income,
        taxableIncome,
        baseTax: Math.round(taxAmount),
        healthAndEducationCess: Math.round(cess),
        totalTaxPayable: totalTax,
        effectiveTaxRate: `${effectiveRate}%`,
        regime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Invalid payload or calculation failure" },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "TaxKatha Core Calculation Engine",
    version: "1.0.0",
    supportedRegimes: ["new", "old"],
  });
}
