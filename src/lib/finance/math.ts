/*
 * Shared arithmetic for the calculators. Everything here is pure and runs
 * identically in the browser, on the server and in unit tests.
 */

/**
 * The monthly rate that compounds to the given annual return: 12% a year is
 * 0.9489% a month, not 1% (which would compound to 12.68%). Used for
 * market-linked investments, where the expected return is quoted as a
 * yearly growth rate.
 */
export function monthlyFromAnnual(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

/** Clamps a number into [min, max]; NaN becomes `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Rounds half away from zero to the given number of decimals. */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.sign(value) * Math.round(Math.abs(value) * factor) / factor;
}

/** Rounds to the nearest multiple of ten, as income and tax are under the Income-tax Act. */
export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}
