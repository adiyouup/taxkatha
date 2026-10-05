"use client";

import { useMemo, useState } from "react";

import { CalculatorFrame, Headline, choiceParam, numberParam, Rows, ShareLink, fromUrl, useUrlSync, type Params } from "@/components/tools/calculator-ui";
import { ChoiceField, NumberField, SelectField } from "@/components/tools/fields";
import { percent, rupees, rupeesExact } from "@/lib/finance/format";
import { GST_RATES, gst, type GstMode, type SupplyType } from "@/lib/tax/gst";
import { hraExemption, isMetro, METROS_FROM_2026 } from "@/lib/tax/hra";
import { compareRegimes, DEDUCTION_LIMITS, TAX_YEAR_LABEL, TAX_YEARS, type AgeGroup, type TaxBreakdown, type TaxYear } from "@/lib/tax/income-tax";
import { cn } from "@/lib/utils";

const AGES = ["below60", "60to79", "80plus"] as const;

function RegimeCard({ title, result, best }: { title: string; result: TaxBreakdown; best: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", best && "border-gold-600 ring-1 ring-gold-600/40")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {best ? <span className="rounded-xs bg-gold-500 px-2 py-0.5 text-[0.6875rem] font-semibold text-navy-900">Lower tax</span> : null}
      </div>
      <p className="type-numeral mt-2 text-3xl leading-none text-foreground">{rupees(result.total)}</p>
      <dl className="mt-3 space-y-1.5 text-xs">
        {[
          ["Taxable income", rupees(result.taxableIncome)],
          ["Tax on slabs", rupees(result.slabTax)],
          ...(result.rebate > 0 ? [["Rebate", `− ${rupees(result.rebate)}`]] : []),
          ...(result.surcharge > 0 ? [["Surcharge", rupees(result.surcharge)]] : []),
          ["Cess (4%)", rupees(result.cess)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function IncomeTaxCalculator({ params = null }: { params?: Params }) {
  const [year, setYear] = useState<TaxYear>(() => choiceParam(params, "year", "2026-27", TAX_YEARS));
  const [age, setAge] = useState<AgeGroup>(() => choiceParam(params, "age", "below60", AGES));
  const [salary, setSalary] = useState(() => numberParam(params, "salary", 15_00_000, 0, 50_00_00_000));
  const [other, setOther] = useState(() => numberParam(params, "other", 50_000, 0, 50_00_00_000));
  const [employerNps, setEmployerNps] = useState(() => numberParam(params, "enps", 0, 0, 1_00_00_000));
  const [investments, setInvestments] = useState(() => numberParam(params, "c80", 1_50_000, 0, DEDUCTION_LIMITS.investments));
  const [health, setHealth] = useState(() => numberParam(params, "d80", 25_000, 0, DEDUCTION_LIMITS.healthInsurance));
  const [homeLoan, setHomeLoan] = useState(() => numberParam(params, "home", 0, 0, DEDUCTION_LIMITS.homeLoanInterest));
  const [ownNps, setOwnNps] = useState(() => numberParam(params, "nps", 0, 0, DEDUCTION_LIMITS.nps));
  const [hra, setHra] = useState(() => numberParam(params, "hra", 0, 0, 1_00_00_000));
  const [otherDeductions, setOtherDeductions] = useState(() => numberParam(params, "oded", 0, 0, 1_00_00_000));
  useUrlSync({ year, age, salary, other, enps: employerNps, c80: investments, d80: health, home: homeLoan, nps: ownNps, hra, oded: otherDeductions });

  const result = useMemo(
    () =>
      compareRegimes({
        age,
        salary,
        otherIncome: other,
        employerNps,
        deductions: { investments, healthInsurance: health, homeLoanInterest: homeLoan, nps: ownNps, hraExemption: hra, other: otherDeductions },
      }),
    [age, salary, other, employerNps, investments, health, homeLoan, ownNps, hra, otherDeductions],
  );
  const gross = salary + other;
  const best = result[result.better];

  return (
    <CalculatorFrame
      inputs={
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Year" value={year} onChange={setYear} options={TAX_YEARS.map((y) => ({ value: y, label: TAX_YEAR_LABEL[y] }))} />
            <SelectField
              label="Your age"
              value={age}
              onChange={setAge}
              options={[
                { value: "below60", label: "Below 60" },
                { value: "60to79", label: "60 to 79" },
                { value: "80plus", label: "80 or more" },
              ]}
            />
          </div>
          <NumberField label="Salary or pension (gross, a year)" unit="rupees" value={salary} onChange={setSalary} min={0} max={50_00_00_000} sliderMax={1_00_00_000} step={10_000} />
          <NumberField label="Other income" unit="rupees" value={other} onChange={setOther} min={0} max={50_00_00_000} sliderMax={50_00_000} step={5_000} hint="Interest, rent after its 30% deduction, freelance or business profit. Not capital gains." />
          <NumberField label="Employer's NPS contribution" unit="rupees" value={employerNps} onChange={setEmployerNps} min={0} max={1_00_00_000} sliderMax={5_00_000} step={5_000} hint="Deductible in both regimes." />
          <fieldset className="space-y-6 rounded-xl border p-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Deductions — old regime only</legend>
            <NumberField label="Investments (80C)" unit="rupees" value={investments} onChange={setInvestments} min={0} max={DEDUCTION_LIMITS.investments} step={5_000} hint="PPF, ELSS, EPF, life insurance, home-loan principal… up to ₹1.5 lakh." />
            <NumberField label="Health insurance (80D)" unit="rupees" value={health} onChange={setHealth} min={0} max={DEDUCTION_LIMITS.healthInsurance} step={1_000} />
            <NumberField label="Home-loan interest" unit="rupees" value={homeLoan} onChange={setHomeLoan} min={0} max={DEDUCTION_LIMITS.homeLoanInterest} step={5_000} hint="Self-occupied house, up to ₹2 lakh." />
            <NumberField label="Your own NPS (80CCD(1B))" unit="rupees" value={ownNps} onChange={setOwnNps} min={0} max={DEDUCTION_LIMITS.nps} step={5_000} />
            <NumberField label="Exempt HRA" unit="rupees" value={hra} onChange={setHra} min={0} max={1_00_00_000} sliderMax={10_00_000} step={5_000} hint="Work it out with the HRA calculator." />
            <NumberField label="Other deductions" unit="rupees" value={otherDeductions} onChange={setOtherDeductions} min={0} max={1_00_00_000} sliderMax={5_00_000} step={5_000} />
          </fieldset>
        </>
      }
      results={
        <>
          <Headline
            label={`Lower tax: ${result.better === "new" ? "new regime" : "old regime"}`}
            value={rupees(best.total)}
            note={
              result.saving > 0
                ? `Saves ${rupees(result.saving)} compared with the ${result.better === "new" ? "old" : "new"} regime.`
                : "Both regimes give the same tax."
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <RegimeCard title="New regime" result={result.new} best={result.better === "new" && result.saving > 0} />
            <RegimeCard title="Old regime" result={result.old} best={result.better === "old" && result.saving > 0} />
          </div>
          <Rows
            rows={[
              { label: "Gross income", value: rupees(gross) },
              { label: "Effective tax rate", value: gross > 0 ? percent((best.total / gross) * 100) : "0%" },
              { label: "Monthly tax (TDS) at this level", value: rupees(best.total / 12), strong: true },
            ]}
          />
          <details className="rounded-xl border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Slab-wise working ({result.better} regime)</summary>
            <table className="w-full border-t text-sm">
              <tbody>
                {best.rows.map((row) => (
                  <tr key={row.from} className="border-t first:border-t-0">
                    <td className="px-4 py-2 text-muted-foreground">
                      {rupees(row.from)} – {Number.isFinite(row.to) ? rupees(row.to) : "above"}
                    </td>
                    <td className="px-2 py-2 text-right">{row.rate}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{rupees(row.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="type-caption text-muted-foreground">
            {year === "2026-27" ? "Tax year 2026-27 under the Income-tax Act, 2025." : "FY 2025-26 under the Income-tax Act, 1961."} The slabs are the same in both years.
          </p>
          <ShareLink />
        </>
      }
    />
  );
}

export const IncomeTaxCalculatorFromUrl = fromUrl(IncomeTaxCalculator);

const CITIES = [...METROS_FROM_2026, "Other"] as const;
type City = (typeof CITIES)[number];

export function HraCalculator({ params = null }: { params?: Params }) {
  const [year, setYear] = useState<TaxYear>(() => choiceParam(params, "year", "2026-27", TAX_YEARS));
  const [city, setCity] = useState<City>(() => choiceParam(params, "city", "Bengaluru", CITIES));
  const [basic, setBasic] = useState(() => numberParam(params, "basic", 50_000, 0, 50_00_000));
  const [da, setDa] = useState(() => numberParam(params, "da", 0, 0, 50_00_000));
  const [hraReceived, setHraReceived] = useState(() => numberParam(params, "hra", 20_000, 0, 50_00_000));
  const [rent, setRent] = useState(() => numberParam(params, "rent", 25_000, 0, 50_00_000));
  useUrlSync({ year, city, basic, da, hra: hraReceived, rent });

  const metro = isMetro(city, year);
  const salary = (basic + da) * 12;
  const result = hraExemption({ salary, hraReceived: hraReceived * 12, rentPaid: rent * 12, metro });

  return (
    <CalculatorFrame
      inputs={
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Year" value={year} onChange={setYear} options={TAX_YEARS.map((y) => ({ value: y, label: TAX_YEAR_LABEL[y] }))} />
            <SelectField label="City you live in" value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: c === "Other" ? "Other city" : c }))} />
          </div>
          <NumberField label="Monthly basic pay" unit="rupees" value={basic} onChange={setBasic} min={0} max={50_00_000} sliderMax={5_00_000} step={1_000} />
          <NumberField label="Monthly dearness allowance" unit="rupees" value={da} onChange={setDa} min={0} max={50_00_000} sliderMax={2_00_000} step={1_000} hint="Only the part that counts for retirement benefits." />
          <NumberField label="Monthly HRA received" unit="rupees" value={hraReceived} onChange={setHraReceived} min={0} max={50_00_000} sliderMax={2_00_000} step={1_000} />
          <NumberField label="Monthly rent paid" unit="rupees" value={rent} onChange={setRent} min={0} max={50_00_000} sliderMax={2_00_000} step={1_000} />
        </>
      }
      results={
        <>
          <Headline label="Tax-free HRA (a year)" value={rupees(result.exempt)} note={`${metro ? "Metro city: 50%" : "Non-metro: 40%"} of salary is the cap.`} />
          <Rows
            rows={[
              { label: "HRA received", value: rupees(result.limits.actual) },
              { label: "Rent minus 10% of salary", value: rupees(result.limits.rentOverTenPercent) },
              { label: `${metro ? "50%" : "40%"} of salary`, value: rupees(result.limits.shareOfSalary) },
              { label: "Exempt (the least of the three)", value: rupees(result.exempt), strong: true },
              { label: "Taxable HRA", value: rupees(result.taxable) },
            ]}
          />
          {year === "2025-26" && !isMetro(city, "2025-26") && isMetro(city, "2026-27") ? (
            <p className="type-caption text-muted-foreground">{city} counts as a metro from tax year 2026-27, so the cap rises to 50% next year.</p>
          ) : null}
          <p className="type-caption text-muted-foreground">HRA exemption is available only in the old tax regime.</p>
          <ShareLink />
        </>
      }
    />
  );
}

export const HraCalculatorFromUrl = fromUrl(HraCalculator);

const RATE_OPTIONS = GST_RATES.map(String) as unknown as readonly string[];

export function GstCalculator({ params = null }: { params?: Params }) {
  const [amount, setAmount] = useState(() => numberParam(params, "amount", 10_000, 0, 1_00_00_00_000));
  const [rate, setRate] = useState(() => choiceParam(params, "rate", "18", RATE_OPTIONS));
  const [mode, setMode] = useState<GstMode>(() => choiceParam(params, "mode", "add", ["add", "remove"] as const));
  const [supply, setSupply] = useState<SupplyType>(() => choiceParam(params, "supply", "intra", ["intra", "inter"] as const));
  useUrlSync({ amount, rate, mode, supply });
  const result = gst({ amount, rate: Number(rate), mode, supply });

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label={mode === "add" ? "Amount before GST" : "Amount including GST"} unit="rupees" value={amount} onChange={setAmount} min={0} max={1_00_00_00_000} sliderMax={10_00_000} step={100} />
          <ChoiceField
            label="GST rate"
            value={rate}
            onChange={setRate}
            options={GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
          />
          <ChoiceField
            label="The amount"
            value={mode}
            onChange={setMode}
            options={[
              { value: "add", label: "Excludes GST — add it" },
              { value: "remove", label: "Includes GST — take it out" },
            ]}
          />
          <ChoiceField
            label="Supply"
            value={supply}
            onChange={setSupply}
            options={[
              { value: "intra", label: "Within a state" },
              { value: "inter", label: "Between states" },
            ]}
          />
        </>
      }
      results={
        <>
          <Headline label={mode === "add" ? "Total including GST" : "Amount before GST"} value={rupeesExact(mode === "add" ? result.gross : result.net)} note={`GST at ${rate}%: ${rupeesExact(result.tax)}`} />
          <Rows
            rows={[
              { label: "Amount before GST", value: rupeesExact(result.net) },
              ...(supply === "intra"
                ? [
                    { label: `CGST (${Number(rate) / 2}%)`, value: rupeesExact(result.cgst) },
                    { label: `SGST (${Number(rate) / 2}%)`, value: rupeesExact(result.sgst) },
                  ]
                : [{ label: `IGST (${rate}%)`, value: rupeesExact(result.igst) }]),
              { label: "Total GST", value: rupeesExact(result.tax) },
              { label: "Total including GST", value: rupeesExact(result.gross), strong: true },
            ]}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const GstCalculatorFromUrl = fromUrl(GstCalculator);
