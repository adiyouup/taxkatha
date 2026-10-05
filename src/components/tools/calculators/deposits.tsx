"use client";

import { useMemo, useState } from "react";

import { CalculatorFrame, Headline, choiceParam, numberParam, Rows, Schedule, ShareLink, fromUrl, useUrlSync, type Params } from "@/components/tools/calculator-ui";
import { Donut, YearBars } from "@/components/tools/charts";
import { NumberField, SelectField } from "@/components/tools/fields";
import { rupees, rupeesShort } from "@/lib/finance/format";
import { COMPOUNDING, fd, rd, SCHEME_RATES, yearlyScheme, type Compounding } from "@/lib/finance/deposits";

function Split({ invested, interest }: { invested: number; interest: number }) {
  return (
    <Donut
      label="Amount deposited and interest earned"
      segments={[
        { label: "Amount deposited", value: invested, tone: "navy" },
        { label: "Interest earned", value: interest, tone: "gold" },
      ]}
    />
  );
}

export function FdCalculator({ params = null }: { params?: Params }) {
  const [principal, setPrincipal] = useState(() => numberParam(params, "amount", 1_00_000, 1_000, 10_00_00_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", 7, 1, 15));
  const [years, setYears] = useState(() => numberParam(params, "years", 5, 0.25, 10));
  const [compounding, setCompounding] = useState<Compounding>(() => choiceParam(params, "compounding", "quarterly", Object.keys(COMPOUNDING) as Compounding[]));
  useUrlSync({ amount: principal, rate, years, compounding });
  const result = useMemo(() => fd({ principal, annualRate: rate, months: Math.round(years * 12), compounding }), [principal, rate, years, compounding]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Deposit" unit="rupees" value={principal} onChange={setPrincipal} min={1_000} max={10_00_00_000} sliderMax={1_00_00_000} step={5_000} />
          <NumberField label="Interest rate (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={15} step={0.05} />
          <NumberField label="Tenure" unit="years" value={years} onChange={setYears} min={0.25} max={10} step={0.25} />
          <SelectField
            label="Interest compounded"
            value={compounding}
            onChange={setCompounding}
            options={[
              { value: "quarterly", label: "Quarterly (most banks)" },
              { value: "monthly", label: "Monthly" },
              { value: "half-yearly", label: "Half-yearly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </>
      }
      results={
        <>
          <Headline label="Maturity value" value={rupees(result.maturity)} note={`After ${years} years`} />
          <Split invested={principal} interest={result.interest} />
          <Rows
            rows={[
              { label: "Deposit", value: rupees(principal) },
              { label: "Interest earned", value: rupees(result.interest) },
              { label: "Maturity value", value: rupees(result.maturity), strong: true },
            ]}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const FdCalculatorFromUrl = fromUrl(FdCalculator);

export function RdCalculator({ params = null }: { params?: Params }) {
  const [monthly, setMonthly] = useState(() => numberParam(params, "amount", 5_000, 100, 10_00_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", SCHEME_RATES.postOfficeRd, 1, 15));
  const [years, setYears] = useState(() => numberParam(params, "years", 5, 0.5, 10));
  useUrlSync({ amount: monthly, rate, years });
  const result = useMemo(() => rd({ monthly, annualRate: rate, months: Math.round(years * 12) }), [monthly, rate, years]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Monthly deposit" unit="rupees" value={monthly} onChange={setMonthly} min={100} max={10_00_000} sliderMax={1_00_000} step={500} />
          <NumberField label="Interest rate (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={15} step={0.05} hint="Post office 5-year RD: 6.7% for October–December 2026." />
          <NumberField label="Tenure" unit="years" value={years} onChange={setYears} min={0.5} max={10} step={0.5} />
        </>
      }
      results={
        <>
          <Headline label="Maturity value" value={rupees(result.maturity)} note={`${Math.round(years * 12)} monthly deposits of ${rupees(monthly)}`} />
          <Split invested={result.invested} interest={result.interest} />
          <Rows
            rows={[
              { label: "Total deposited", value: rupees(result.invested) },
              { label: "Interest earned", value: rupees(result.interest) },
              { label: "Maturity value", value: rupees(result.maturity), strong: true },
            ]}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const RdCalculatorFromUrl = fromUrl(RdCalculator);

function SchemeResults({ result, label }: { result: ReturnType<typeof yearlyScheme>; label: string }) {
  return (
    <>
      <Headline label={label} value={rupeesShort(result.maturity)} note={`After ${result.years.length} years`} />
      <Split invested={result.invested} interest={result.interest} />
      <Rows
        rows={[
          { label: "Total deposited", value: rupees(result.invested) },
          { label: "Interest earned", value: rupees(result.interest) },
          { label: "Maturity value", value: rupees(result.maturity), strong: true },
        ]}
      />
      <YearBars
        caption="Balance at the end of each year"
        series={[
          { label: "Deposits", tone: "navy" },
          { label: "Interest", tone: "gold" },
        ]}
        rows={result.years.map((y, i) => {
          const deposited = result.years.slice(0, i + 1).reduce((sum, r) => sum + r.deposit, 0);
          return { label: `Y${y.year}`, values: [deposited, y.balance - deposited] };
        })}
      />
      <Schedule head={["Year", "Deposit", "Interest", "Balance"]} rows={result.years.map((y) => [y.year, rupees(y.deposit), rupees(y.interest), rupees(y.balance)])} />
      <ShareLink />
    </>
  );
}

export function PpfCalculator({ params = null }: { params?: Params }) {
  const [yearly, setYearly] = useState(() => numberParam(params, "amount", 1_50_000, 500, 1_50_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", SCHEME_RATES.ppf, 1, 15));
  const [years, setYears] = useState(() => numberParam(params, "years", 15, 15, 50));
  useUrlSync({ amount: yearly, rate, years });
  const result = useMemo(() => yearlyScheme({ yearly, annualRate: rate, years }), [yearly, rate, years]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Yearly deposit" unit="rupees" value={yearly} onChange={setYearly} min={500} max={1_50_000} step={500} hint="₹500 to ₹1.5 lakh a year." />
          <NumberField label="Interest rate (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={15} step={0.05} hint="7.1% for October–December 2026." />
          <NumberField label="Time period" unit="years" value={years} onChange={setYears} min={15} max={50} step={5} hint="15 years, extendable in blocks of five." />
        </>
      }
      results={<SchemeResults result={result} label="Maturity value" />}
    />
  );
}

export const PpfCalculatorFromUrl = fromUrl(PpfCalculator);

export function SsyCalculator({ params = null }: { params?: Params }) {
  const [yearly, setYearly] = useState(() => numberParam(params, "amount", 1_50_000, 250, 1_50_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", SCHEME_RATES.ssy, 1, 15));
  const [age, setAge] = useState(() => numberParam(params, "age", 2, 0, 10));
  useUrlSync({ amount: yearly, rate, age });
  const result = useMemo(() => yearlyScheme({ yearly, annualRate: rate, years: 21, depositYears: 15 }), [yearly, rate]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Yearly deposit" unit="rupees" value={yearly} onChange={setYearly} min={250} max={1_50_000} step={250} hint="₹250 to ₹1.5 lakh a year, for 15 years." />
          <NumberField label="Girl's age when the account is opened" unit="years" value={age} onChange={setAge} min={0} max={10} />
          <NumberField label="Interest rate (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={15} step={0.05} hint="8.2% for October–December 2026." />
        </>
      }
      results={<SchemeResults result={result} label={`Maturity value when she is ${age + 21}`} />}
    />
  );
}

export const SsyCalculatorFromUrl = fromUrl(SsyCalculator);
