"use client";

import { useMemo, useState } from "react";

import { CalculatorFrame, Headline, numberParam, Rows, Schedule, ShareLink, fromUrl, useUrlSync, type Params } from "@/components/tools/calculator-ui";
import { YearBars } from "@/components/tools/charts";
import { NumberField } from "@/components/tools/fields";
import { percent, rupees, rupeesShort } from "@/lib/finance/format";
import { cagr, swp } from "@/lib/finance/investments";

export function SwpCalculator({ params = null }: { params?: Params }) {
  const [corpus, setCorpus] = useState(() => numberParam(params, "corpus", 50_00_000, 10_000, 50_00_00_000));
  const [withdrawal, setWithdrawal] = useState(() => numberParam(params, "withdrawal", 30_000, 500, 1_00_00_000));
  const [rate, setRate] = useState(() => numberParam(params, "rate", 8, 0, 30));
  const [years, setYears] = useState(() => numberParam(params, "years", 15, 1, 40));
  useUrlSync({ corpus, withdrawal, rate, years });
  const result = useMemo(() => swp({ corpus, monthlyWithdrawal: withdrawal, annualReturn: rate, years }), [corpus, withdrawal, rate, years]);
  const months = Math.round(years * 12);
  const runsOut = result.monthsPaid < months;

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Total investment" unit="rupees" value={corpus} onChange={setCorpus} min={10_000} max={50_00_00_000} sliderMax={5_00_00_000} step={50_000} />
          <NumberField label="Monthly withdrawal" unit="rupees" value={withdrawal} onChange={setWithdrawal} min={500} max={1_00_00_000} sliderMax={5_00_000} step={500} />
          <NumberField label="Expected return (a year)" unit="percent" value={rate} onChange={setRate} min={0} max={30} step={0.5} />
          <NumberField label="Time period" unit="years" value={years} onChange={setYears} min={1} max={40} />
        </>
      }
      results={
        <>
          <Headline
            label={runsOut ? "The money lasts" : "Value left at the end"}
            value={runsOut ? `${Math.floor(result.monthsPaid / 12)} yr ${result.monthsPaid % 12} mo` : rupeesShort(result.finalValue)}
            note={runsOut ? `Withdrawals of ${rupees(withdrawal)} a month run out before ${years} years.` : `After ${years} years of ${rupees(withdrawal)} a month`}
          />
          <Rows
            rows={[
              { label: "Total investment", value: rupees(corpus) },
              { label: "Total withdrawn", value: rupees(result.withdrawn) },
              { label: "Returns earned", value: rupees(result.returns) },
              { label: "Final value", value: rupees(result.finalValue), strong: true },
            ]}
          />
          <YearBars
            caption="Balance at the end of each year"
            series={[{ label: "Balance", tone: "navy" }]}
            rows={result.years.map((y) => ({ label: `Y${y.year}`, values: [y.balance] }))}
          />
          <Schedule
            head={["Year", "Withdrawn", "Returns", "Balance"]}
            rows={result.years.map((y) => [y.year, rupees(y.withdrawn), rupees(y.returns), rupees(y.balance)])}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const SwpCalculatorFromUrl = fromUrl(SwpCalculator);

export function CagrCalculator({ params = null }: { params?: Params }) {
  const [start, setStart] = useState(() => numberParam(params, "start", 1_00_000, 1, 1_00_00_00_000));
  const [end, setEnd] = useState(() => numberParam(params, "end", 2_50_000, 1, 1_00_00_00_000));
  const [years, setYears] = useState(() => numberParam(params, "years", 5, 0.5, 50));
  useUrlSync({ start, end, years });
  const rate = cagr({ start, end, years });

  return (
    <CalculatorFrame
      inputs={
        <>
          <NumberField label="Starting value" unit="rupees" value={start} onChange={setStart} min={1} max={1_00_00_00_000} sliderMax={1_00_00_000} step={1_000} />
          <NumberField label="Ending value" unit="rupees" value={end} onChange={setEnd} min={1} max={1_00_00_00_000} sliderMax={5_00_00_000} step={1_000} />
          <NumberField label="Duration" unit="years" value={years} onChange={setYears} min={0.5} max={50} step={0.5} />
        </>
      }
      results={
        <>
          <Headline label="Compound annual growth rate" value={percent(rate)} note={`${rupees(start)} became ${rupees(end)} in ${years} years`} />
          <Rows
            rows={[
              { label: "Absolute return", value: percent(((end - start) / start) * 100) },
              { label: "Growth multiple", value: `${(end / start).toFixed(2)}×` },
              { label: "CAGR", value: percent(rate), strong: true },
            ]}
          />
          <ShareLink />
        </>
      }
    />
  );
}

export const CagrCalculatorFromUrl = fromUrl(CagrCalculator);
