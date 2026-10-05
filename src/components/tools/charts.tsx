import { rupeesAxis, rupeesShort } from "@/lib/finance/format";

/*
 * Small SVG charts for the calculators. No chart library: two shapes are all
 * the calculators need, and plain SVG keeps the pages light.
 */

export type Segment = { label: string; value: number; tone: "navy" | "gold" | "muted" };

const COLOR = { navy: "var(--color-navy-800)", gold: "var(--color-gold-500)", muted: "var(--color-navy-200)" } as const;

/** A ring showing how a total splits into parts. */
export function Donut({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  // Where each arc starts: the running total of the arcs before it.
  const lengths = segments.map((s) => (Math.max(0, s.value) / total) * c);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <figure className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="size-32 shrink-0 -rotate-90 sm:size-36" role="img" aria-label={label}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="16" />
        {segments.map((s, i) => {
          const length = lengths[i]!;
          return (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={COLOR[s.tone]}
              strokeWidth="16"
              strokeDasharray={`${length} ${c - length}`}
              strokeDashoffset={-starts[i]!}
            />
          );
        })}
      </svg>
      <figcaption className="space-y-2.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: COLOR[s.tone] }} />
            <div>
              <p className="type-caption text-muted-foreground">{s.label}</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {rupeesShort(s.value)} <span className="font-normal text-muted-foreground">· {Math.round((Math.max(0, s.value) / total) * 100)}%</span>
              </p>
            </div>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

/** Stacked yearly bars, e.g. amount invested and growth, or principal and interest. */
export function YearBars({
  rows,
  series,
  caption,
}: {
  rows: { label: string; values: number[] }[];
  series: { label: string; tone: Segment["tone"] }[];
  caption: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.values.reduce((a, b) => a + Math.max(0, b), 0)));
  const every = Math.ceil(rows.length / 10);
  return (
    <figure>
      <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={caption}>
        {rows.map((row, index) => (
          <div key={row.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${row.label}: ${series.map((s, i) => `${s.label} ${rupeesShort(row.values[i] ?? 0)}`).join(", ")}`}>
            {[...row.values].reverse().map((value, i) => {
              const tone = series[row.values.length - 1 - i]!.tone;
              return <div key={i} style={{ height: `${(Math.max(0, value) / max) * 100}%`, background: COLOR[tone] }} className="w-full first:rounded-t-[3px]" />;
            })}
            <span aria-hidden className="mt-1.5 h-3 text-center text-[0.625rem] text-muted-foreground">
              {index % every === 0 || index === rows.length - 1 ? row.label : ""}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLOR[s.tone] }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto">Top: {rupeesAxis(max)}</span>
      </figcaption>
    </figure>
  );
}
