"use client";

import React, { useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function TaxCalculator() {
  const [annualIncome, setAnnualIncome] = useState<number>(1200000);
  const [regime, setRegime] = useState<"new" | "old">("new");
  const [deduction80C, setDeduction80C] = useState<number>(150000);
  const [deduction80D, setDeduction80D] = useState<number>(25000);
  const [hraExemption, setHraExemption] = useState<number>(100000);
  const [otherDeductions, setOtherDeductions] = useState<number>(50000);

  // New Regime Calculation (FY 2025-26 updated slabs)
  const calcNewRegime = (income: number) => {
    const stdDeduction = 75000;
    const taxable = Math.max(0, income - stdDeduction);
    let tax = 0;

    if (taxable <= 300000) {
      tax = 0;
    } else if (taxable <= 700000) {
      tax = (taxable - 300000) * 0.05;
    } else if (taxable <= 1000000) {
      tax = 20000 + (taxable - 700000) * 0.10;
    } else if (taxable <= 1200000) {
      tax = 50000 + (taxable - 1000000) * 0.15;
    } else if (taxable <= 1500000) {
      tax = 80000 + (taxable - 1200000) * 0.20;
    } else {
      tax = 140000 + (taxable - 1500000) * 0.30;
    }

    if (taxable <= 700000) tax = 0; // 87A rebate

    const cess = tax * 0.04;
    return {
      stdDeduction,
      totalDeductions: stdDeduction,
      taxable,
      baseTax: Math.round(tax),
      cess: Math.round(cess),
      totalTax: Math.round(tax + cess),
    };
  };

  // Old Regime Calculation
  const calcOldRegime = (income: number, ded80c: number, ded80d: number, hra: number, other: number) => {
    const stdDeduction = 50000;
    const totalExemptions = Math.min(150000, ded80c) + Math.min(50000, ded80d) + hra + other;
    const totalDeductions = stdDeduction + totalExemptions;
    const taxable = Math.max(0, income - totalDeductions);
    let tax = 0;

    if (taxable <= 250000) {
      tax = 0;
    } else if (taxable <= 500000) {
      tax = (taxable - 250000) * 0.05;
    } else if (taxable <= 1000000) {
      tax = 12500 + (taxable - 500000) * 0.20;
    } else {
      tax = 112500 + (taxable - 1000000) * 0.30;
    }

    if (taxable <= 500000) tax = 0; // 87A rebate

    const cess = tax * 0.04;
    return {
      stdDeduction,
      totalDeductions,
      taxable,
      baseTax: Math.round(tax),
      cess: Math.round(cess),
      totalTax: Math.round(tax + cess),
    };
  };

  const newResult = calcNewRegime(annualIncome);
  const oldResult = calcOldRegime(annualIncome, deduction80C, deduction80D, hraExemption, otherDeductions);

  const activeResult = regime === "new" ? newResult : oldResult;
  const takeHome = Math.max(0, annualIncome - activeResult.totalTax);
  const monthlyTakeHome = Math.round(takeHome / 12);
  const taxSavings = Math.abs(oldResult.totalTax - newResult.totalTax);
  const recommendedRegime = newResult.totalTax <= oldResult.totalTax ? "New Regime" : "Old Regime";

  const formatINR = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  return (
    <section id="calculator" className="w-full py-12">
      <div className="relative mx-auto max-w-6xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
        {/* Glow backdrop */}
        <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Live Interactive Tax Engine
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Instant Tax Katha & Regime Comparison
            </h2>
            <p className="text-sm text-slate-400">
              Compute your exact liability, analyze exemptions, and maximize your take-home pay.
            </p>
          </div>

          {/* Regime Switcher */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setRegime("new")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                regime === "new"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              New Regime
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">Standard</span>
            </button>
            <button
              onClick={() => setRegime("old")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                regime === "old"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Old Regime
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">Deductions</span>
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Controls (Left Column) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Income Slider & Input */}
            <div className="rounded-2xl bg-slate-950/60 p-5 border border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  Total Annual Gross Income (CTC)
                </label>
                <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 px-3 py-1">
                  <span className="text-xs text-slate-400 mr-1">₹</span>
                  <input
                    type="number"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(Math.max(0, Number(e.target.value) || 0))}
                    className="w-28 bg-transparent text-right text-sm font-mono font-bold text-white focus:outline-none"
                    step="50000"
                  />
                </div>
              </div>

              <input
                type="range"
                min="300000"
                max="5000000"
                step="25000"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-500">
                <span>₹3L</span>
                <span>₹15L</span>
                <span>₹30L</span>
                <span>₹50L+</span>
              </div>
            </div>

            {/* Old Regime Deductions Section */}
            {regime === "old" ? (
              <div className="space-y-4 rounded-2xl bg-slate-950/60 p-5 border border-slate-800/80 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-sm font-semibold text-emerald-400">Claimable Deductions & Exemptions</span>
                  <span className="text-xs text-slate-400">Reduces Taxable Income</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Section 80C (PPF, ELSS, EPF)</label>
                    <input
                      type="number"
                      max="150000"
                      value={deduction80C}
                      onChange={(e) => setDeduction80C(Number(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Max limit: ₹1,50,000</span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Section 80D (Health Insurance)</label>
                    <input
                      type="number"
                      max="100000"
                      value={deduction80D}
                      onChange={(e) => setDeduction80D(Number(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Self & Parents</span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">House Rent Allowance (HRA)</label>
                    <input
                      type="number"
                      value={hraExemption}
                      onChange={(e) => setHraExemption(Number(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Exempted Rent Portion</span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Other (NPS 80CCD, Home Loan)</label>
                    <input
                      type="number"
                      value={otherDeductions}
                      onChange={(e) => setOtherDeductions(Number(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Additional section relief</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-emerald-950/20 border border-emerald-800/40 p-4 text-xs text-emerald-300/90 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-emerald-300">Default Standard Deduction Applied</span>
                  Under the New Tax Regime, a flat standard deduction of <span className="font-mono font-bold text-white">₹75,000</span> is automatically applied with no proof requirements.
                </div>
              </div>
            )}

            {/* Regime Recommendation Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">AI Tax Recommendation</span>
                <span className="text-sm font-bold text-emerald-400">
                  {recommendedRegime} is better for your profile
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Potential Savings</span>
                <span className="text-sm font-mono font-bold text-teal-300">{formatINR(taxSavings)} / yr</span>
              </div>
            </div>
          </div>

          {/* Result Card (Right Column) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 p-6 border border-slate-800 shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-sm font-medium text-slate-400">Net Annual Tax Liability</span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  {regime === "new" ? "New Regime" : "Old Regime"}
                </span>
              </div>

              <div className="my-6">
                <div className="text-4xl font-extrabold tracking-tight text-white font-mono">
                  {formatINR(activeResult.totalTax)}
                </div>
                <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                  Effective Tax Rate:{" "}
                  <span className="font-mono font-bold text-emerald-400">
                    {annualIncome > 0 ? ((activeResult.totalTax / annualIncome) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Breakdown Rows */}
              <div className="space-y-2.5 text-xs border-t border-slate-800/80 pt-4 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 font-sans">Gross Income</span>
                  <span>{formatINR(annualIncome)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 font-sans">Total Deductions</span>
                  <span className="text-emerald-400">- {formatINR(activeResult.totalDeductions)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 font-sans">Taxable Income</span>
                  <span>{formatINR(activeResult.taxable)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 font-sans">Base Income Tax</span>
                  <span>{formatINR(activeResult.baseTax)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 font-sans">Health & Edu Cess (4%)</span>
                  <span>{formatINR(activeResult.cess)}</span>
                </div>
              </div>
            </div>

            {/* Take-Home Card */}
            <div className="mt-6 rounded-xl bg-slate-900/90 border border-slate-800 p-4">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-slate-400">Monthly In-Hand Salary</span>
                <span className="text-lg font-bold font-mono text-emerald-400">{formatINR(monthlyTakeHome)}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, (takeHome / (annualIncome || 1)) * 100))}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Take-Home: {((takeHome / (annualIncome || 1)) * 100).toFixed(1)}%</span>
                <span>Tax: {((activeResult.totalTax / (annualIncome || 1)) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
