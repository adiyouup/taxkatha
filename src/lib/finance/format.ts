const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹12,34,567 */
export function rupees(value: number): string {
  return INR.format(Math.round(Number.isFinite(value) ? value : 0));
}

/** 12,34,567 (no symbol) */
export function digits(value: number): string {
  return NUMBER.format(Math.round(Number.isFinite(value) ? value : 0));
}

/** ₹12.35 lakh, ₹1.25 crore, ₹45,000 — for headlines and chart labels. */
export function rupeesShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} crore`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} lakh`;
  return rupees(value);
}

/** Axis labels: ₹12L, ₹1.2Cr, ₹45K */
export function rupeesAxis(value: number): string {
  if (value >= 1_00_00_000) return `₹${trim(value / 1_00_00_000, 1)}Cr`;
  if (value >= 1_00_000) return `₹${trim(value / 1_00_000, 1)}L`;
  if (value >= 1_000) return `₹${trim(value / 1_000, 0)}K`;
  return `₹${Math.round(value)}`;
}

function trim(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function percent(value: number, decimals = 2): string {
  return `${trim(value, decimals)}%`;
}

/** ₹1,234.56 — for GST and other amounts where paise matter. */
export function rupeesExact(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}
