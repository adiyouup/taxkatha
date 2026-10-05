"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Inputs on one side, results on the other; stacked on phones. */
export function CalculatorFrame({ inputs, results }: { inputs: React.ReactNode; results: React.ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border bg-card shadow-lift lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-7 p-6 sm:p-8">{inputs}</div>
      <div className="space-y-7 border-t bg-paper-2/60 p-6 sm:p-8 lg:border-t-0 lg:border-l" aria-live="polite">
        {results}
      </div>
    </div>
  );
}

/** The main answer: label and a large figure. */
export function Headline({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div>
      <p className="type-eyebrow text-[0.6875rem] text-gold-text">{label}</p>
      <p className="type-numeral mt-2 text-[2.5rem] leading-none text-foreground sm:text-5xl">{value}</p>
      {note ? <p className="type-small mt-3 text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Label/value rows under the headline. */
export function Rows({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <dl className="divide-y rounded-xl border bg-card">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted-foreground">{row.label}</dt>
          <dd className={cn("text-right text-sm tabular-nums text-foreground", row.strong && "font-semibold")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A collapsible year-by-year table. */
export function Schedule({ title = "Year by year", head, rows }: { title?: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground">
        {title}
        <span className="text-xs font-normal text-muted-foreground group-open:hidden">Show {rows.length} rows</span>
        <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="max-h-80 overflow-auto border-t" data-lenis-prevent>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={cn("px-4 py-2 font-semibold text-muted-foreground", i === 0 ? "text-left" : "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t">
                {row.map((cell, i) => (
                  <td key={i} className={cn("px-4 py-2 tabular-nums", i === 0 ? "text-left" : "text-right")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Copies a link to this calculation (the inputs are in the address). */
export function ShareLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the address bar still has the link.
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-text hover:underline"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      {copied ? "Link copied" : "Copy a link to this calculation"}
    </button>
  );
}

/**
 * Keeps the inputs in the page address, so a calculation can be bookmarked or
 * shared. Uses replaceState: no navigation, no server request.
 */
export function useUrlSync(values: Record<string, string | number | boolean>) {
  const first = useRef(true);
  const key = JSON.stringify(values);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string | number | boolean>)) params.set(k, String(v));
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [key]);
}

/** Reads a number from the address, falling back when absent or out of range. */
export type Params = { get(key: string): string | null } | null;

export function numberParam(params: Params, key: string, fallback: number, min: number, max: number): number {
  const raw = params?.get(key);
  if (raw === null || raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function choiceParam<T extends string>(params: Params, key: string, fallback: T, allowed: readonly T[]): T {
  const raw = params?.get(key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * Wraps a calculator so it starts from the values in the address. Must sit
 * inside <Suspense>: the page prerenders the plain calculator as the fallback.
 */
export function fromUrl<P extends { params?: Params }>(Calculator: React.ComponentType<P>) {
  function CalculatorFromUrl(props: Omit<P, "params">) {
    const params = useSearchParams();
    return <Calculator {...(props as P)} params={params} />;
  }
  return CalculatorFromUrl;
}
