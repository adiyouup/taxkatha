"use client";

import { useMemo, useState } from "react";

import { CalculatorFrame, Headline, choiceParam, numberParam, Rows, Schedule, ShareLink, fromUrl, useUrlSync, type Params } from "@/components/tools/calculator-ui";
import { Donut, YearBars } from "@/components/tools/charts";
import { ChoiceField, NumberField } from "@/components/tools/fields";
import { rupees, rupeesShort } from "@/lib/finance/format";
import { SCHEME_RATES } from "@/lib/finance/deposits";
import { epf, gratuity, GRATUITY_TAX_FREE_LIMIT, nps } from "@/lib/finance/retirement";

export function EpfCalculator({ params = null }: { params?: Params }) {
  const [wages, setWages] = useState(() => numberParam(params, "wages", 40_000, 1_000, 10_00_000));
  const [age, setAge] = useState(() => numberParam(params, "age", 28, 18, 57));
  const [retire, setRetire] = useState(() => numberParam(params, "retire", 58, 40, 60));
  const [balance, setBalance] = useState(() => numberParam(params, "balance", 0, 0, 10_00_00_000));
  const [growth, setGrowth] = useState(() => numberParam(params, "growth", 5, 0, 20));
  const [rate, setRate] = useState(() => numberParam(params, "rate", SCHEME_RATES.epf, 1, 15));
  useUrlSync({ wages, age, retire, balance, growth, rate });
  const result = useMemo(
    () => epf({ monthlyWages: wages, age, retirementAge: Math.max(retire, age + 1), balance, salaryGrowth: growth, annualRate: rate }),
    [wages, age, retire, balance, growth, rate],
  );

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Monthly basic pay + DA" unit="rupees" value={wages} onChange={setWages} min={1_000} max={10_00_000} sliderMax={3_00_000} step={1_000} />
          <NumberField label="Your age" unit="years" value={age} onChange={setAge} min={18} max={57} />
          <NumberField label="Retirement age" unit="years" value={retire} onChange={setRetire} min={40} max={60} />
          <NumberField label="Current EPF balance" unit="rupees" value={balance} onChange={setBalance} min={0} max={10_00_00_000} sliderMax={50_00_000} step={10_000} />
          <NumberField label="Yearly salary increase" unit="percent" value={growth} onChange={setGrowth} min={0} max={20} step={0.5} />
          <NumberField label="EPF interest rate" unit="percent" value={rate} onChange={setRate} min={1} max={15} step={0.05} hint="8.25% for FY 2025-26." />
        </>
      }
      results={
        <>
          <Headline label="EPF balance at retirement" value={rupeesShort(result.corpus)} note={`At age ${Math.max(retire, age + 1)}`} />
          <Donut
            label="What makes up the balance"
            segments={[
              { label: "Your contributions", value: result.totalEmployee + result.opening, tone: "navy" },
              { label: "Employer's contributions", value: result.totalEmployer, tone: "muted" },
              { label: "Interest", value: result.totalInterest, tone: "gold" },
            ]}
          />
          <Rows
            rows={[
              { label: "Your contributions", value: rupees(result.totalEmployee) },
              { label: "Employer's contributions (EPF share)", value: rupees(result.totalEmployer) },
              { label: "Interest earned", value: rupees(result.totalInterest) },
              { label: "Balance at retirement", value: rupees(result.corpus), strong: true },
            ]}
          />
          <YearBars
            caption="EPF balance at the end of each year"
            series={[{ label: "Balance", tone: "navy" }]}
            rows={result.years.map((y) => ({ label: String(y.age), values: [y.balance] }))}
          />
          <Schedule
            head={["Age", "You", "Employer", "Interest", "Balance"]}
            rows={result.years.map((y) => [y.age, rupees(y.employee), rupees(y.employer), rupees(y.interest), rupeesShort(y.balance)])}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const EpfCalculatorFromUrl = fromUrl(EpfCalculator);

export function NpsCalculator({ params = null }: { params?: Params }) {
  const [monthly, setMonthly] = useState(() => numberParam(params, "amount", 5_000, 500, 5_00_000));
  const [age, setAge] = useState(() => numberParam(params, "age", 30, 18, 69));
  const [retire, setRetire] = useState(() => numberParam(params, "retire", 60, 60, 75));
  const [rate, setRate] = useState(() => numberParam(params, "rate", 10, 1, 20));
  const [annuityPct, setAnnuityPct] = useState(() => numberParam(params, "annuity", 40, 20, 100));
  const [annuityRate, setAnnuityRate] = useState(() => numberParam(params, "annuityrate", 6, 1, 12));
  useUrlSync({ amount: monthly, age, retire, rate, annuity: annuityPct, annuityrate: annuityRate });
  const result = useMemo(
    () => nps({ monthly, age, retirementAge: Math.max(retire, age + 1), annualReturn: rate, annuityPercent: annuityPct, annuityRate }),
    [monthly, age, retire, rate, annuityPct, annuityRate],
  );
  const taxable = result.lumpSum - result.taxFreeLumpSum;

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Monthly contribution" unit="rupees" value={monthly} onChange={setMonthly} min={500} max={5_00_000} sliderMax={1_00_000} step={500} />
          <NumberField label="Your age" unit="years" value={age} onChange={setAge} min={18} max={69} />
          <NumberField label="Exit age" unit="years" value={retire} onChange={setRetire} min={60} max={75} />
          <NumberField label="Expected return (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={20} step={0.5} />
          <NumberField label="Share used to buy an annuity" unit="percent" value={annuityPct} onChange={setAnnuityPct} min={20} max={100} step={5} hint="At least 20% for most subscribers since December 2025 (40% keeps the whole lump sum tax-free)." />
          <NumberField label="Annuity rate (a year)" unit="percent" value={annuityRate} onChange={setAnnuityRate} min={1} max={12} step={0.1} />
        </>
      }
      results={
        <>
          <Headline label="Estimated monthly pension" value={rupees(result.monthlyPension)} note={`Corpus of ${rupeesShort(result.corpus)} at ${Math.max(retire, age + 1)}`} />
          <Donut
            label="How the corpus is used"
            segments={[
              { label: "Lump sum", value: result.lumpSum, tone: "gold" },
              { label: "Annuity", value: result.annuity, tone: "navy" },
            ]}
          />
          <Rows
            rows={[
              { label: "Total contributed", value: rupees(result.invested) },
              { label: "Returns earned", value: rupees(result.gains) },
              { label: "Corpus at exit", value: rupees(result.corpus), strong: true },
              { label: "Lump sum (tax-free part)", value: rupees(result.taxFreeLumpSum) },
              ...(taxable > 0 ? [{ label: "Lump sum (taxable part)", value: rupees(taxable) }] : []),
              { label: "Used to buy an annuity", value: rupees(result.annuity) },
            ]}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const NpsCalculatorFromUrl = fromUrl(NpsCalculator);

export function GratuityCalculator({ params = null }: { params?: Params }) {
  const [wages, setWages] = useState(() => numberParam(params, "wages", 60_000, 1_000, 50_00_000));
  const [years, setYears] = useState(() => numberParam(params, "years", 10, 0, 50));
  const [months, setMonths] = useState(() => numberParam(params, "months", 0, 0, 11));
  const [covered, setCovered] = useState(() => choiceParam(params, "covered", "yes", ["yes", "no"] as const));
  const [employer, setEmployer] = useState(() => choiceParam(params, "employer", "private", ["private", "government"] as const));
  useUrlSync({ wages, years, months, covered, employer });
  const result = gratuity({ monthlyWages: wages, years, months, covered: covered === "yes", government: employer === "government" });

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Last monthly basic pay + DA" unit="rupees" value={wages} onChange={setWages} min={1_000} max={50_00_000} sliderMax={5_00_000} step={1_000} />
          <NumberField label="Years of service" unit="years" value={years} onChange={setYears} min={0} max={50} />
          <NumberField label="Plus months" unit="months" value={months} onChange={setMonths} min={0} max={11} hint="More than six months counts as a full year." />
          <ChoiceField
            label="Covered by the gratuity law?"
            value={covered}
            onChange={setCovered}
            options={[
              { value: "yes", label: "Yes (most employers)" },
              { value: "no", label: "No" },
            ]}
          />
          <ChoiceField
            label="Employer"
            value={employer}
            onChange={setEmployer}
            options={[
              { value: "private", label: "Private" },
              { value: "government", label: "Government" },
            ]}
          />
        </>
      }
      results={
        <>
          <Headline
            label="Gratuity"
            value={rupees(result.amount)}
            note={covered === "yes" && years < 5 ? "Usually payable only after five years of service (one year for fixed-term employees)." : `For ${result.serviceYears} years of service`}
          />
          <Rows
            rows={[
              { label: "Years counted", value: String(result.serviceYears) },
              { label: "Tax-free", value: rupees(result.exempt) },
              { label: "Taxable", value: rupees(result.taxable), strong: result.taxable > 0 },
            ]}
          />
          {employer === "private" ? (
            <p className="type-caption text-muted-foreground">
              Tax-free up to {rupeesShort(GRATUITY_TAX_FREE_LIMIT)} across your whole career, including gratuity from earlier employers.
            </p>
          ) : null}
          <ShareLink />
        </>
      }
    />
  );
}

export const GratuityCalculatorFromUrl = fromUrl(GratuityCalculator);
