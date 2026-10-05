/*
 * House rent allowance exemption (old tax regime only). The exempt part is the
 * least of: the HRA received; rent paid minus 10% of salary; and 50% of salary
 * in a metro city or 40% elsewhere — "salary" being basic pay plus dearness
 * allowance that counts for retirement benefits.
 *
 * From tax year 2026-27 the Income-tax Rules, 2026 treat eight cities as
 * metros (Rule 279): Bengaluru, Hyderabad, Pune and Ahmedabad join Delhi,
 * Mumbai, Kolkata and Chennai.
 */

export const METROS_UNTIL_2026 = ["Delhi", "Mumbai", "Kolkata", "Chennai"] as const;
export const METROS_FROM_2026 = [...METROS_UNTIL_2026, "Bengaluru", "Hyderabad", "Pune", "Ahmedabad"] as const;

export function isMetro(city: string, taxYear: "2026-27" | "2025-26"): boolean {
  const list: readonly string[] = taxYear === "2026-27" ? METROS_FROM_2026 : METROS_UNTIL_2026;
  return list.includes(city);
}

export function hraExemption({ salary, hraReceived, rentPaid, metro }: { salary: number; hraReceived: number; rentPaid: number; metro: boolean }) {
  const limits = {
    actual: Math.max(0, hraReceived),
    rentOverTenPercent: Math.max(0, rentPaid - salary * 0.1),
    shareOfSalary: Math.max(0, salary * (metro ? 0.5 : 0.4)),
  };
  const exempt = Math.min(limits.actual, limits.rentOverTenPercent, limits.shareOfSalary);
  return { exempt, taxable: Math.max(0, hraReceived - exempt), limits };
}
