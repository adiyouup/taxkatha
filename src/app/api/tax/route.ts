import * as z from "zod";

import { compareRegimes, TAX_YEARS } from "@/lib/tax/income-tax";

/*
 * Income-tax calculation as JSON, for partners and integrations. Uses the
 * same module as the calculator at /tools/income-tax-calculator.
 */

const money = z.coerce.number().min(0).max(1_00_00_00_000).default(0);

const inputSchema = z.object({
  taxYear: z.enum(TAX_YEARS).default("2026-27"),
  age: z.enum(["below60", "60to79", "80plus"]).default("below60"),
  salary: money,
  otherIncome: money,
  employerNps: money,
  deductions: z
    .object({ investments: money, healthInsurance: money, homeLoanInterest: money, nps: money, hraExemption: money, other: money })
    .default({ investments: 0, healthInsurance: 0, homeLoanInterest: 0, nps: 0, hraExemption: 0, other: 0 }),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { taxYear, ...input } = parsed.data;
  const result = compareRegimes(input);
  return Response.json({ taxYear, ...result }, { headers: { "Cache-Control": "no-store" } });
}
