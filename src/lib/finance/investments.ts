import { monthlyFromAnnual } from "./math";

export type GrowthYear = { year: number; invested: number; value: number };

export type SipResult = { invested: number; value: number; gains: number; years: GrowthYear[] };

/**
 * A monthly SIP, invested at the start of each month. With `stepUp`, the
 * monthly amount rises by that percentage every year.
 *   Without step-up this equals P × [((1 + i)^n − 1) / i] × (1 + i).
 */
export function sip({ monthly, annualReturn, years, stepUp = 0 }: { monthly: number; annualReturn: number; years: number; stepUp?: number }): SipResult {
  const i = monthlyFromAnnual(annualReturn);
  const schedule: GrowthYear[] = [];
  let amount = monthly;
  let invested = 0;
  let value = 0;

  for (let month = 1; month <= Math.round(years * 12); month++) {
    if (month > 1 && (month - 1) % 12 === 0) amount *= 1 + stepUp / 100;
    invested += amount;
    value = (value + amount) * (1 + i);
    if (month % 12 === 0) schedule.push({ year: month / 12, invested, value });
  }
  return { invested, value, gains: value - invested, years: schedule };
}

/** A one-time investment growing at the annual rate, compounded yearly. */
export function lumpsum({ amount, annualReturn, years }: { amount: number; annualReturn: number; years: number }): SipResult {
  const schedule: GrowthYear[] = [];
  for (let year = 1; year <= Math.round(years); year++) {
    schedule.push({ year, invested: amount, value: amount * Math.pow(1 + annualReturn / 100, year) });
  }
  const value = amount * Math.pow(1 + annualReturn / 100, years);
  return { invested: amount, value, gains: value - amount, years: schedule };
}

export type SwpYear = { year: number; withdrawn: number; returns: number; balance: number };

export type SwpResult = {
  withdrawn: number;
  returns: number;
  finalValue: number;
  /** Months the money lasted (equals the plan length when it never runs out). */
  monthsPaid: number;
  years: SwpYear[];
};

/**
 * A systematic withdrawal plan: the withdrawal is taken at the start of each
 * month and the rest stays invested for the month.
 */
export function swp({ corpus, monthlyWithdrawal, annualReturn, years }: { corpus: number; monthlyWithdrawal: number; annualReturn: number; years: number }): SwpResult {
  const i = monthlyFromAnnual(annualReturn);
  const schedule: SwpYear[] = [];
  let balance = corpus;
  let withdrawn = 0;
  let returns = 0;
  let monthsPaid = 0;
  let year: SwpYear = { year: 1, withdrawn: 0, returns: 0, balance };

  for (let month = 1; month <= Math.round(years * 12); month++) {
    const take = Math.min(monthlyWithdrawal, balance);
    if (take > 0) monthsPaid += take >= monthlyWithdrawal ? 1 : 0;
    balance -= take;
    const earned = balance * i;
    balance += earned;
    withdrawn += take;
    returns += earned;
    year.withdrawn += take;
    year.returns += earned;
    year.balance = balance;
    if (month % 12 === 0) {
      schedule.push(year);
      year = { year: year.year + 1, withdrawn: 0, returns: 0, balance };
    }
  }
  return { withdrawn, returns, finalValue: balance, monthsPaid, years: schedule };
}

/** Compound annual growth rate, in percent. */
export function cagr({ start, end, years }: { start: number; end: number; years: number }): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}
