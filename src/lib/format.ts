/** Display formatting shared by server and client. Dates are shown in Indian style. */

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_LONG = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const NUMBER = new Intl.NumberFormat("en-IN");
const COMPACT = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

function toDate(value: string | Date): Date {
  // "2026-08-01" (a calendar date) must not shift with the viewer's timezone.
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
}

/** "1 Aug 2026" — for calendar dates such as a decision date. */
export function formatDate(value: string | Date): string {
  return DATE.format(toDate(value));
}

/** "1 August 2026" */
export function formatDateLong(value: string | Date): string {
  return DATE_LONG.format(toDate(value));
}

/** "1 Aug 2026, 4:30 pm" in India time — for timestamps. */
export function formatDateTime(value: string | Date): string {
  return DATE_TIME.format(new Date(value));
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** 1,240 → "1.2K" */
export function formatCompact(value: number): string {
  return value < 1000 ? String(value) : COMPACT.format(value);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];
const RELATIVE = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto", style: "short" });

/** "3 hr ago", "yesterday". `now` is passed in so callers control the clock. */
export function formatRelative(value: string | Date, now: Date): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
