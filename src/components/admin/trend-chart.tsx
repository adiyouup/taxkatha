import { formatDate, formatNumber } from "@/lib/format";

export type TrendSeries = { label: string; values: number[]; tone: "gold" | "navy" };

const W = 720;
const H = 200;

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => value / s <= 4) ?? 10 * magnitude;
  return Math.ceil(value / step) * step;
}

/**
 * A daily trend drawn on the server as SVG — no chart library, no client
 * JavaScript. The first series is an area, the rest are lines on the same
 * scale. Hovering a day shows its values; the same data is in a hidden table
 * for screen readers.
 */
export function TrendChart({ days, series, caption }: { days: string[]; series: TrendSeries[]; caption: string }) {
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = Math.max(1, days.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - (v / max) * (H - 8);
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const colors = { gold: "var(--color-gold-500)", navy: "var(--color-navy-700)" } as const;
  const ticks = [0, max / 2, max];
  const labelDays = [0, Math.floor(days.length / 2), days.length - 1].filter((i, idx, all) => all.indexOf(i) === idx && days[i]);

  return (
    <figure className="w-full">
      <div className="flex gap-3">
        <div className="flex h-[200px] w-10 shrink-0 flex-col justify-between text-right text-[0.6875rem] text-muted-foreground tabular-nums" aria-hidden>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatNumber(Math.round(t))}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[200px] w-full overflow-visible" aria-hidden>
            {ticks.map((t) => (
              <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {series.map((s, index) =>
              index === 0 ? (
                <g key={s.label}>
                  <path d={`${path(s.values)} L${W} ${H} L0 ${H} Z`} fill={colors[s.tone]} fillOpacity="0.14" />
                  <path d={path(s.values)} fill="none" stroke={colors[s.tone]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </g>
              ) : (
                <path
                  key={s.label}
                  d={path(s.values)}
                  fill="none"
                  stroke={colors[s.tone]}
                  strokeWidth="1.75"
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              ),
            )}
            {days.map((day, i) => (
              <rect key={day} x={x(i) - W / n / 2} y="0" width={W / n} height={H} fill="transparent">
                <title>{`${formatDate(day)}: ${series.map((s) => `${s.label} ${formatNumber(s.values[i] ?? 0)}`).join(", ")}`}</title>
              </rect>
            ))}
          </svg>
          <div className="mt-2 flex justify-between text-[0.6875rem] text-muted-foreground" aria-hidden>
            {labelDays.map((i) => (
              <span key={i}>{formatDate(days[i]!).replace(/\s\d{4}$/, "")}</span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 pl-13 text-xs text-muted-foreground">
        {series.map((s, index) => (
          <span key={s.label} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-0.5 w-5 rounded-full"
              style={{ background: index === 0 ? colors[s.tone] : `repeating-linear-gradient(90deg, ${colors[s.tone]} 0 5px, transparent 5px 9px)` }}
            />
            {s.label} <span className="font-semibold text-foreground tabular-nums">{formatNumber(s.values.reduce((a, b) => a + b, 0))}</span>
          </span>
        ))}
        <span className="sr-only">{caption}</span>
      </figcaption>
      {/* Hidden through a wrapper: a table ignores the 1px box and would stretch the page. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {series.map((s) => (
                <th key={s.label} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, i) => (
              <tr key={day}>
                <th scope="row">{formatDate(day)}</th>
                {series.map((s) => (
                  <td key={s.label}>{s.values[i] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
