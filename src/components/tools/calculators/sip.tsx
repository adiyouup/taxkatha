"use client";

import { useMemo, useState } from "react";

import { CalculatorFrame, Headline, numberParam, Rows, Schedule, ShareLink, fromUrl, useUrlSync, type Params } from "@/components/tools/calculator-ui";
import { Donut, YearBars } from "@/components/tools/charts";
import { NumberField } from "@/components/tools/fields";
import { rupees, rupeesShort } from "@/lib/finance/format";
import { lumpsum, sip, type SipResult } from "@/lib/finance/investments";

function Growth({ result, years }: { result: SipResult; years: number }) {
  return (
    <>
      <Headline label="Estimated value" value={rupeesShort(result.value)} note={`After ${years} year${years === 1 ? "" : "s"}`} />
      <Donut
        label="Amount invested and estimated returns"
        segments={[
          { label: "Amount invested", value: result.invested, tone: "navy" },
          { label: "Estimated returns", value: result.gains, tone: "gold" },
        ]}
      />
      <Rows
        rows={[
          { label: "Amount invested", value: rupees(result.invested) },
          { label: "Estimated returns", value: rupees(result.gains) },
          { label: "Total value", value: rupees(result.value), strong: true },
        ]}
      />
      <YearBars
        caption="Amount invested and returns at the end of each year"
        series={[
          { label: "Invested", tone: "navy" },
          { label: "Returns", tone: "gold" },
        ]}
        rows={result.years.map((y) => ({ label: `Y${y.year}`, values: [y.invested, Math.max(0, y.value - y.invested)] }))}
      />
      <Schedule head={["Year", "Invested", "Value"]} rows={result.years.map((y) => [y.year, rupees(y.invested), rupees(y.value)])} />
      <ShareLink />
    </>
  );
}

export function SipCalculator({ stepUpDefault = 0, params = null }: { stepUpDefault?: number; params?: Params }) {
  const [monthly, setMonthly] = useState(() => numberParam(params, "amount", 10_000, 100, 10_00_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", 12, 1, 30));
  const [years, setYears] = useState(() => numberParam(params, "years", 10, 1, 40));
  const [stepUp, setStepUp] = useState(() => numberParam(params, "stepup", stepUpDefault, 0, 50));
  useUrlSync({ amount: monthly, rate, years, stepup: stepUp });
  const result = useMemo(() => sip({ monthly, annualReturn: rate, years, stepUp }), [monthly, rate, years, stepUp]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Monthly investment" unit="rupees" value={monthly} onChange={setMonthly} min={100} max={10_00_000} sliderMax={2_00_000} step={500} />
          <NumberField label="Expected return (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={30} step={0.5} />
          <NumberField label="Time period" unit="years" value={years} onChange={setYears} min={1} max={40} />
          <NumberField
            label="Yearly step-up"
            unit="percent"
            value={stepUp}
            onChange={setStepUp}
            min={0}
            max={50}
            sliderMax={25}
            hint="Raise the monthly amount by this much every year. Leave at 0 for a fixed SIP."
          />
        </>
      }
      results={<Growth result={result} years={years} />}
    />
  );
}

export const SipCalculatorFromUrl = fromUrl(SipCalculator);

export function LumpsumCalculator({ params = null }: { params?: Params }) {
  const [amount, setAmount] = useState(() => numberParam(params, "amount", 1_00_000, 1_000, 10_00_00_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", 12, 1, 30));
  const [years, setYears] = useState(() => numberParam(params, "years", 10, 1, 40));
  useUrlSync({ amount, rate, years });
  const result = useMemo(() => lumpsum({ amount, annualReturn: rate, years }), [amount, rate, years]);

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Amount invested" unit="rupees" value={amount} onChange={setAmount} min={1_000} max={10_00_00_000} sliderMax={1_00_00_000} step={5_000} />
          <NumberField label="Expected return (a year)" unit="percent" value={rate} onChange={setRate} min={1} max={30} step={0.5} />
          <NumberField label="Time period" unit="years" value={years} onChange={setYears} min={1} max={40} />
        </>
      }
      results={<Growth result={result} years={years} />}
    />
  );
}

export const LumpsumCalculatorFromUrl = fromUrl(LumpsumCalculator);
