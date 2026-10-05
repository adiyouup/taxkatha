"use client";

import { useMemo, useState } from "react";

import { CalculatorFrame, Headline, numberParam, Rows, Schedule, ShareLink, fromUrl, useUrlSync, type Params } from "@/components/tools/calculator-ui";
import { Donut, YearBars } from "@/components/tools/charts";
import { NumberField } from "@/components/tools/fields";
import { loan } from "@/lib/finance/loans";
import { rupees, rupeesShort } from "@/lib/finance/format";

export const LOAN_PRESETS = {
  general: { amount: 10_00_000, rate: 10, years: 5, maxAmount: 5_00_00_000, maxYears: 30, maxRate: 30 },
  home: { amount: 50_00_000, rate: 8.5, years: 20, maxAmount: 10_00_00_000, maxYears: 30, maxRate: 15 },
  car: { amount: 8_00_000, rate: 9, years: 5, maxAmount: 1_00_00_000, maxYears: 8, maxRate: 20 },
  personal: { amount: 5_00_000, rate: 11, years: 3, maxAmount: 50_00_000, maxYears: 7, maxRate: 30 },
} as const;

export type LoanKind = keyof typeof LOAN_PRESETS;

export function LoanCalculator({ kind = "general", params = null }: { kind?: LoanKind; params?: Params }) {
  const preset = LOAN_PRESETS[kind];
  const [amount, setAmount] = useState(() => numberParam(params, "amount", preset.amount, 10_000, preset.maxAmount));
  const [rate, setRate] = useState(() => numberParam(params, "rate", preset.rate, 0, preset.maxRate));
  const [years, setYears] = useState(() => numberParam(params, "years", preset.years, 1, preset.maxYears));
  useUrlSync({ amount, rate, years });

  const result = useMemo(() => loan(amount, rate, Math.round(years * 12)), [amount, rate, years]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Loan amount" unit="rupees" value={amount} onChange={setAmount} min={10_000} max={preset.maxAmount} step={10_000} />
          <NumberField label="Interest rate (a year)" unit="percent" value={rate} onChange={setRate} min={0} max={preset.maxRate} step={0.05} />
          <NumberField label="Tenure" unit="years" value={years} onChange={setYears} min={1} max={preset.maxYears} step={1} />
        </>
      }
      results={
        <>
          <Headline label="Monthly EMI" value={rupees(result.emi)} note={`For ${Math.round(years * 12)} months`} />
          <Donut
            label="Principal and interest"
            segments={[
              { label: "Principal", value: amount, tone: "navy" },
              { label: "Total interest", value: result.totalInterest, tone: "gold" },
            ]}
          />
          <Rows
            rows={[
              { label: "Loan amount", value: rupees(amount) },
              { label: "Total interest", value: rupees(result.totalInterest) },
              { label: "Total you repay", value: rupees(result.totalPayment), strong: true },
            ]}
          />
          <YearBars
            caption="Principal and interest repaid each year"
            series={[
              { label: "Principal repaid", tone: "navy" },
              { label: "Interest paid", tone: "gold" },
            ]}
            rows={result.years.map((y) => ({ label: `Y${y.year}`, values: [y.principal, y.interest] }))}
          />
          <Schedule
            head={["Year", "Principal", "Interest", "Balance"]}
            rows={result.years.map((y) => [y.year, rupees(y.principal), rupees(y.interest), rupeesShort(y.balance)])}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const LoanCalculatorFromUrl = fromUrl(LoanCalculator);
