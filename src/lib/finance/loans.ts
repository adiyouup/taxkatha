/** Monthly instalment on a reducing-balance loan. `annualRate` is in percent. */
export function emi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  const growth = Math.pow(1 + r, months);
  return (principal * r * growth) / (growth - 1);
}

export type LoanYear = { year: number; principal: number; interest: number; balance: number };

export type LoanResult = {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  /** Principal repaid, interest paid and the balance left, for each year of the loan. */
  years: LoanYear[];
};

/** The full repayment schedule, month by month, summarised by loan year. */
export function loan(principal: number, annualRate: number, months: number): LoanResult {
  const instalment = emi(principal, annualRate, months);
  const r = annualRate / 12 / 100;
  const years: LoanYear[] = [];
  let balance = principal;
  let totalInterest = 0;
  let current: LoanYear = { year: 1, principal: 0, interest: 0, balance };

  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    // The last instalment clears whatever rounding has left.
    const repaid = month === months ? balance : Math.min(balance, instalment - interest);
    balance = Math.max(0, balance - repaid);
    totalInterest += interest;
    current.principal += repaid;
    current.interest += interest;
    current.balance = balance;
    if (month % 12 === 0 || month === months) {
      years.push(current);
      current = { year: current.year + 1, principal: 0, interest: 0, balance };
    }
  }

  return { emi: instalment, totalInterest, totalPayment: principal + totalInterest, years };
}
