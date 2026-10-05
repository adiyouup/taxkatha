"use client";

import { useId, useState } from "react";

import { digits } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

type Unit = "rupees" | "percent" | "years" | "months" | "plain";

const SUFFIX: Record<Unit, string> = { rupees: "", percent: "%", years: "yr", months: "mo", plain: "" };

/**
 * A number with a slider: type an exact value or drag. The text box shows the
 * value with Indian digit grouping and accepts any typed value; it is clamped
 * to the allowed range when you leave the box.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "plain",
  hint,
  sliderMax,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: Unit;
  hint?: React.ReactNode;
  /** The slider can stop short of `max` (typing still allows up to `max`). */
  sliderMax?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const top = sliderMax ?? max;
  const fill = Math.min(100, Math.max(0, ((value - min) / (top - min)) * 100));
  const decimals = step < 1 ? (String(step).split(".")[1]?.length ?? 2) : 0;
  const shown = unit === "rupees" || unit === "plain" ? digits(value) : value.toFixed(decimals).replace(/\.0+$/, "");

  function commit(raw: string) {
    const parsed = Number(raw.replace(/[^0-9.]/g, ""));
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    onChange(decimals ? Number(next.toFixed(decimals)) : Math.round(next));
    setDraft(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <div className="flex h-10 w-40 shrink-0 items-center rounded-md border border-input bg-card px-3 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25 hover:border-navy-300">
          {unit === "rupees" ? <span className="mr-1 text-sm text-muted-foreground">₹</span> : null}
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={draft ?? shown}
            // Select the shown text as it is: changing it here would drop the selection,
            // and typing would then append to the old number instead of replacing it.
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setDraft(event.target.value);
              const parsed = Number(event.target.value.replace(/[^0-9.]/g, ""));
              if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
            }}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="w-full min-w-0 bg-transparent text-right text-sm font-semibold text-foreground tabular-nums outline-none"
          />
          {SUFFIX[unit] ? <span className="ml-1 text-sm text-muted-foreground">{SUFFIX[unit]}</span> : null}
        </div>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={unit === "rupees" ? `₹${digits(value)}` : `${shown}${SUFFIX[unit] ? ` ${unit}` : ""}`}
        min={min}
        max={top}
        step={step}
        value={Math.min(value, top)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="tool-range w-full"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
      {hint ? <p className="type-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A small set of mutually exclusive options shown as buttons. */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-2.5", className)}>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted/70 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex-1 cursor-pointer rounded-md px-3 py-2 text-center text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring",
              value === option.value && "bg-card text-foreground shadow-soft",
            )}
          >
            <input type="radio" className="sr-only" checked={value === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="select-chevron h-10 w-full rounded-md border border-input bg-card pr-9 pl-3 text-sm text-foreground hover:border-navy-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="type-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
