const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Converts whatever a spreadsheet cell holds into YYYY-MM-DD.
 * Accepts Date objects, Excel serial numbers, ISO strings, and Indian-style
 * day-first text ("01-08-2026", "1/8/2026", "1 Aug 2026"). Returns null when
 * the value is not a real calendar date.
 */
export function parseDecisionDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // SheetJS builds date cells at UTC midnight; a few hours of drift means a
    // local-midnight Date, so round to the nearest UTC day.
    const rounded = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    return iso(rounded.getUTCFullYear(), rounded.getUTCMonth() + 1, rounded.getUTCDate());
  }

  if (typeof value === "number") {
    // Excel serial date (1900 system): day 25569 is 1970-01-01.
    if (value < 1 || value > 80000) return null;
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (match) return iso(+match[1]!, +match[2]!, +match[3]!);

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return iso(+match[3]!, +match[2]!, +match[1]!);

  match = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[2]!.slice(0, 4).toLowerCase()] ?? MONTHS[match[2]!.slice(0, 3).toLowerCase()];
    return month ? iso(+match[3]!, month, +match[1]!) : null;
  }

  match = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[1]!.slice(0, 4).toLowerCase()] ?? MONTHS[match[1]!.slice(0, 3).toLowerCase()];
    return month ? iso(+match[3]!, month, +match[2]!) : null;
  }

  return null;
}
