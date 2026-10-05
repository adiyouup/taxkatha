/*
 * The calculators: names, search-engine text and the explanations shown under
 * each one. Rates and rules were checked on 4 October 2026; see `RATES_CHECKED`.
 */

export const RATES_CHECKED = "4 October 2026";

export type ToolCategory = "tax" | "loans" | "investments" | "savings";

export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; description: string }> = {
  tax: { label: "Tax", description: "Income tax, GST, HRA and gratuity under the current rules." },
  loans: { label: "Loans", description: "Instalments, interest and repayment schedules." },
  investments: { label: "Investments", description: "SIPs, lump sums, withdrawals and returns." },
  savings: { label: "Savings and retirement", description: "Deposits, small savings schemes, EPF and NPS." },
};

export type ToolIcon =
  | "receipt"
  | "percent"
  | "home"
  | "gift"
  | "landmark"
  | "house"
  | "car"
  | "wallet"
  | "trending"
  | "stairs"
  | "coins"
  | "arrow-down"
  | "chart"
  | "vault"
  | "calendar"
  | "shield"
  | "flower"
  | "briefcase"
  | "sunset";

export type Tool = {
  slug: string;
  category: ToolCategory;
  /** Short name, as in navigation and cards. */
  name: string;
  /** The page's <title>. */
  title: string;
  /** One line for cards and the page header. */
  summary: string;
  /** Meta description. */
  description: string;
  icon: ToolIcon;
  /** Among the most searched calculators in India. */
  popular?: boolean;
  howItWorks: string[];
  formula?: { expression: string; legend: string[] };
  faqs: { q: string; a: string }[];
  related: string[];
};

const LOAN_FORMULA = {
  expression: "EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)",
  legend: ["P — loan amount", "r — monthly interest rate (annual rate ÷ 12 ÷ 100)", "n — number of monthly instalments"],
};

const LOAN_HOW = [
  "Your EMI is the same every month, but its make-up changes: early instalments are mostly interest, and as the balance falls more of each payment goes towards the principal. The year-by-year schedule shows exactly how.",
  "The calculation uses a reducing balance — interest is charged only on what you still owe — which is how banks and housing finance companies price home, car and personal loans in India.",
];

const SIP_FORMULA = {
  expression: "Value = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i)",
  legend: [
    "P — monthly investment",
    "i — monthly return equivalent to the yearly return: (1 + annual)^(1/12) − 1",
    "n — number of months; each instalment is invested at the start of the month",
  ],
};

export const TOOLS: Tool[] = [
  /* ---------------------------------- Tax ---------------------------------- */
  {
    slug: "income-tax-calculator",
    category: "tax",
    name: "Income tax calculator",
    title: "Income Tax Calculator 2026-27 — Old vs New Regime",
    summary: "Compare your tax under the old and new regimes for tax year 2026-27.",
    description:
      "Free income tax calculator for tax year 2026-27 (Income-tax Act, 2025) and FY 2025-26. Compare the old and new regimes with the ₹12 lakh rebate, marginal relief, surcharge and cess.",
    icon: "receipt",
    popular: true,
    howItWorks: [
      "Enter your salary and other income for the year. The calculator applies the standard deduction (₹75,000 in the new regime, ₹50,000 in the old), the slab rates, the rebate, surcharge with marginal relief and the 4% health and education cess.",
      "Deductions — investments under section 80C of the 1961 Act, health insurance, home-loan interest, your own NPS contribution and the exempt part of HRA — lower your tax only in the old regime. Your employer's NPS contribution is deductible in both.",
      "Tax year 2026-27 is the first under the Income-tax Act, 2025. Budget 2026 left the slabs, rebate and standard deduction unchanged, so the rates are the same as FY 2025-26.",
    ],
    faqs: [
      {
        q: "How much income is tax-free in the new regime?",
        a: "Taxable income up to ₹12 lakh pays no tax because of the rebate, so a salaried person pays nothing on salary up to ₹12.75 lakh after the ₹75,000 standard deduction. Just above ₹12 lakh, marginal relief caps the tax at the amount by which your income crosses ₹12 lakh.",
      },
      {
        q: "Which regime should I choose?",
        a: "The new regime has lower rates and is cheaper for most people. The old regime can still win if your deductions are large — typically HRA, home-loan interest and full 80C and health-insurance claims together. The calculator works out both so you can compare.",
      },
      {
        q: "Does this include capital gains?",
        a: "No. Capital gains and other income taxed at special rates are calculated separately and do not get the new-regime rebate. Use this calculator for salary, pension, interest, rent and business income.",
      },
      {
        q: "What changed with the Income-tax Act, 2025?",
        a: "From 1 April 2026 the Income-tax Act, 2025 replaced the 1961 Act. 'Previous year' and 'assessment year' became a single 'tax year', and many section numbers changed, but the rates and slabs stayed the same.",
      },
    ],
    related: ["hra-calculator", "gratuity-calculator", "nps-calculator", "epf-calculator"],
  },
  {
    slug: "gst-calculator",
    category: "tax",
    name: "GST calculator",
    title: "GST Calculator — Add or Remove GST at 5%, 18% and 40%",
    summary: "Add GST to a price or take it out, with the CGST, SGST and IGST split.",
    description: "Free GST calculator with the GST 2.0 rates (5%, 18% and 40%). Add GST to a price or remove it from an inclusive amount, with the CGST, SGST and IGST split.",
    icon: "percent",
    popular: true,
    howItWorks: [
      "Choose whether your amount is before tax (GST is added) or already includes GST (it is taken out). Within a state the tax is split equally into CGST and SGST; for supplies between states it is charged as IGST.",
      "Since 22 September 2025 (GST 2.0), most goods and services are taxed at 5% or 18%, with 40% on luxury and sin goods. The 12% and 28% slabs have gone; 3% (gold and silver) and 0.25% (rough diamonds) remain.",
    ],
    formula: {
      expression: "GST = Net × rate      Net = Inclusive amount ÷ (1 + rate)",
      legend: ["rate — the GST rate as a fraction (18% = 0.18)"],
    },
    faqs: [
      {
        q: "What are the GST rates now?",
        a: "Nil, 5%, 18% and 40% are the main rates since 22 September 2025. Most items that were at 12% moved to 5%, most at 28% moved to 18%, and luxury and sin goods moved to 40%. Check the rate for your specific goods or services before invoicing.",
      },
      {
        q: "How do I take GST out of an inclusive price?",
        a: "Divide the price by 1 plus the rate. For an ₹1,180 price at 18%: 1,180 ÷ 1.18 = ₹1,000 net, so the GST is ₹180.",
      },
      {
        q: "When is IGST charged instead of CGST and SGST?",
        a: "IGST applies when the supplier and the place of supply are in different states (and on imports). Within one state, the same total is charged as CGST and SGST in equal halves.",
      },
    ],
    related: ["income-tax-calculator", "cagr-calculator", "emi-calculator"],
  },
  {
    slug: "hra-calculator",
    category: "tax",
    name: "HRA exemption calculator",
    title: "HRA Exemption Calculator 2026-27 — 8 Metro Cities",
    summary: "Work out how much of your house rent allowance is tax-free.",
    description:
      "Free HRA exemption calculator for tax year 2026-27. Uses the new list of eight metro cities (Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune, Ahmedabad) for the 50% limit.",
    icon: "home",
    popular: true,
    howItWorks: [
      "The tax-free part of HRA is the least of three amounts: the HRA you receive; the rent you pay minus 10% of your salary; and 50% of salary if you live in a metro city, 40% elsewhere. Salary here means basic pay plus dearness allowance that counts for retirement benefits.",
      "From tax year 2026-27, the Income-tax Rules, 2026 treat eight cities as metros — Bengaluru, Hyderabad, Pune and Ahmedabad joined Delhi, Mumbai, Kolkata and Chennai. Choose FY 2025-26 to see the earlier four-city rule.",
      "The HRA exemption is available only in the old regime.",
    ],
    formula: {
      expression: "Exempt HRA = least of (HRA received, Rent − 10% of salary, 50% or 40% of salary)",
      legend: ["Salary — basic pay + dearness allowance (for retirement benefits)"],
    },
    faqs: [
      {
        q: "Which cities count as metros for HRA?",
        a: "From tax year 2026-27: Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune and Ahmedabad (Rule 279 of the Income-tax Rules, 2026). Up to FY 2025-26 only the first four counted.",
      },
      { q: "Can I claim HRA in the new regime?", a: "No. The HRA exemption is available only if you choose the old regime." },
      {
        q: "What if I pay rent to my parents?",
        a: "You can, if the arrangement is genuine: pay the rent through the bank, keep a rent agreement, and your parent must show the rent as income in their own return.",
      },
    ],
    related: ["income-tax-calculator", "gratuity-calculator", "epf-calculator"],
  },
  {
    slug: "gratuity-calculator",
    category: "tax",
    name: "Gratuity calculator",
    title: "Gratuity Calculator — New Labour Code Rules and Tax",
    summary: "Estimate your gratuity and how much of it is tax-free.",
    description:
      "Free gratuity calculator under the Code on Social Security, 2020: 15 days' wages for each year of service, the 26-day month, rounding of part-years and the ₹20 lakh tax-free limit.",
    icon: "gift",
    howItWorks: [
      "Employees covered by the Code on Social Security, 2020 (in force from 21 November 2025, replacing the Payment of Gratuity Act) receive 15 days' wages for every year of service, with a month counted as 26 working days. A final part-year of more than six months counts as a full year.",
      "Wages means basic pay plus dearness allowance; under the new labour codes it must be at least half of your total pay. Employees not covered by the law get half a month's wages for each completed year.",
      "Up to ₹20 lakh of gratuity is tax-free for non-government employees, across all employers in your career. Government employees' gratuity is fully exempt.",
    ],
    formula: {
      expression: "Gratuity = Last wages × 15 × Years of service ÷ 26",
      legend: ["Last wages — last month's basic pay + dearness allowance"],
    },
    faqs: [
      {
        q: "Who is eligible for gratuity?",
        a: "Employees with at least five years of continuous service. Fixed-term employees qualify after one year under the new labour codes, and the minimum does not apply on death or disablement.",
      },
      { q: "Why is the month taken as 26 days?", a: "The law counts a month as 26 working days, so 15 days' wages is 15/26 of a month's pay." },
      {
        q: "Is gratuity taxable?",
        a: "For non-government employees, gratuity is tax-free up to ₹20 lakh in a lifetime; anything above is taxed as salary. For government employees it is fully exempt.",
      },
    ],
    related: ["income-tax-calculator", "epf-calculator", "nps-calculator"],
  },

  /* --------------------------------- Loans --------------------------------- */
  {
    slug: "emi-calculator",
    category: "loans",
    name: "EMI calculator",
    title: "EMI Calculator — Monthly Instalment and Interest for Any Loan",
    summary: "Monthly instalment, total interest and a year-by-year repayment schedule.",
    description: "Free EMI calculator for home, car and personal loans. See your monthly instalment, total interest and a year-by-year repayment schedule.",
    icon: "landmark",
    popular: true,
    howItWorks: LOAN_HOW,
    formula: LOAN_FORMULA,
    faqs: [
      {
        q: "What is an EMI?",
        a: "An equated monthly instalment — the fixed amount you pay every month until the loan is repaid. Each EMI covers that month's interest and repays part of the principal.",
      },
      {
        q: "How can I reduce my EMI?",
        a: "Borrow less, choose a longer tenure, or get a lower rate. A longer tenure lowers the EMI but raises the total interest you pay; part-prepayments reduce both.",
      },
      {
        q: "What is the difference between flat and reducing rates?",
        a: "A flat rate charges interest on the original amount for the whole term; a reducing rate charges it only on what you still owe. A flat rate of 6% costs roughly as much as a reducing rate of 11%, so always compare reducing rates.",
      },
    ],
    related: ["home-loan-emi-calculator", "car-loan-emi-calculator", "personal-loan-emi-calculator", "sip-calculator"],
  },
  {
    slug: "home-loan-emi-calculator",
    category: "loans",
    name: "Home loan EMI calculator",
    title: "Home Loan EMI Calculator — EMI, Interest and Schedule",
    summary: "Your home loan EMI, the total interest and how the balance falls each year.",
    description: "Free home loan EMI calculator. See your monthly EMI, total interest and a year-by-year amortisation schedule for any loan amount, rate and tenure.",
    icon: "house",
    popular: true,
    howItWorks: [
      ...LOAN_HOW,
      "In the old tax regime, interest on a loan for a self-occupied house is deductible up to ₹2 lakh a year, and principal repayment counts towards the ₹1.5 lakh 80C limit. The new regime does not allow these for a self-occupied home.",
    ],
    formula: LOAN_FORMULA,
    faqs: [
      {
        q: "How much home loan can I get?",
        a: "Lenders usually cap total EMIs at 40–50% of your monthly income and lend up to 75–90% of the property's value, depending on the loan size.",
      },
      {
        q: "Does prepaying a home loan help?",
        a: "Yes. A part-prepayment goes straight to the principal, so later instalments carry less interest. Banks do not charge prepayment penalties on floating-rate home loans to individuals.",
      },
      {
        q: "What tax benefits does a home loan give?",
        a: "In the old regime: up to ₹2 lakh a year of interest on a self-occupied house, and principal repayment within the ₹1.5 lakh 80C limit. In the new regime these deductions are not available for a self-occupied home.",
      },
    ],
    related: ["emi-calculator", "income-tax-calculator", "hra-calculator", "sip-calculator"],
  },
  {
    slug: "car-loan-emi-calculator",
    category: "loans",
    name: "Car loan EMI calculator",
    title: "Car Loan EMI Calculator — EMI and Total Interest",
    summary: "The EMI and total cost of a new or used car loan.",
    description: "Free car loan EMI calculator. Work out the monthly EMI, total interest and total cost of a car loan for any amount, rate and tenure.",
    icon: "car",
    howItWorks: LOAN_HOW,
    formula: LOAN_FORMULA,
    faqs: [
      {
        q: "What tenure should I choose for a car loan?",
        a: "Car loans run up to seven years, but a shorter tenure keeps the total interest down. A useful guide is to repay the loan well before the car's value drops below what you still owe.",
      },
      {
        q: "Is the dealer's quoted rate flat or reducing?",
        a: "Ask. Dealers sometimes quote a flat rate, which looks lower than the equivalent reducing rate. This calculator uses the reducing method banks use.",
      },
      {
        q: "Are there charges beyond the EMI?",
        a: "Usually a processing fee, insurance, and possibly a foreclosure charge if you repay early. Include them when you compare offers.",
      },
    ],
    related: ["emi-calculator", "personal-loan-emi-calculator", "home-loan-emi-calculator"],
  },
  {
    slug: "personal-loan-emi-calculator",
    category: "loans",
    name: "Personal loan EMI calculator",
    title: "Personal Loan EMI Calculator — EMI and Interest",
    summary: "The EMI and total interest on a personal loan.",
    description: "Free personal loan EMI calculator. See the monthly EMI, total interest and repayment schedule for any personal loan amount, rate and tenure.",
    icon: "wallet",
    howItWorks: LOAN_HOW,
    formula: LOAN_FORMULA,
    faqs: [
      {
        q: "Why are personal loan rates higher?",
        a: "Personal loans are unsecured — there is no house or car backing them — so lenders charge more. Your rate depends mostly on your credit score and income.",
      },
      {
        q: "Can I prepay a personal loan?",
        a: "Usually after a lock-in period, often with a foreclosure charge of 2–5% of the outstanding amount. Check your loan agreement.",
      },
      {
        q: "How does tenure affect the total cost?",
        a: "A longer tenure lowers the EMI but increases the total interest considerably at personal-loan rates. Choose the shortest tenure whose EMI you can comfortably pay.",
      },
    ],
    related: ["emi-calculator", "car-loan-emi-calculator", "sip-calculator"],
  },

  /* ------------------------------ Investments ------------------------------ */
  {
    slug: "sip-calculator",
    category: "investments",
    name: "SIP calculator",
    title: "SIP Calculator — Monthly SIP Returns",
    summary: "What a monthly SIP could grow to, year by year.",
    description: "Free SIP calculator. Estimate what a monthly systematic investment plan could grow to, with an optional yearly step-up and a year-by-year growth table.",
    icon: "trending",
    popular: true,
    howItWorks: [
      "A systematic investment plan puts a fixed amount into a mutual fund every month. Each instalment then grows for the time it stays invested, so earlier instalments grow the most — that is compounding.",
      "The yearly return you enter is converted into the equivalent monthly return (12% a year is about 0.95% a month, not 1%), so the result matches a fund growing at that yearly rate. Actual returns vary and are not guaranteed.",
    ],
    formula: SIP_FORMULA,
    faqs: [
      {
        q: "What return should I assume?",
        a: "There is no guaranteed return on equity funds. Many people use 10–12% a year for long-term equity and 6–8% for debt funds, and check a lower figure too.",
      },
      {
        q: "Why is the result lower than on some other calculators?",
        a: "Some calculators divide the yearly return by 12, which compounds to more than the rate you entered (1% a month is 12.68% a year). We use the monthly rate that compounds to exactly your yearly return.",
      },
      {
        q: "Are SIP returns taxed?",
        a: "Gains on equity funds held over a year are long-term capital gains, taxed at 12.5% above ₹1.25 lakh a year; shorter holdings are taxed at 20%. Debt fund gains are taxed at your slab rate.",
      },
    ],
    related: ["step-up-sip-calculator", "lumpsum-calculator", "swp-calculator", "cagr-calculator"],
  },
  {
    slug: "step-up-sip-calculator",
    category: "investments",
    name: "Step-up SIP calculator",
    title: "Step-Up SIP Calculator — SIP With Yearly Increase",
    summary: "See how raising your SIP every year speeds up growth.",
    description: "Free step-up SIP calculator. See how increasing your monthly SIP by a fixed percentage every year changes the amount you invest and what it could grow to.",
    icon: "stairs",
    howItWorks: [
      "A step-up (or top-up) SIP raises your monthly instalment by a fixed percentage every year — usually in line with your salary increases. Even a 10% annual step-up makes a large difference over 15–20 years.",
      "Each year's instalments grow at the monthly equivalent of the yearly return you enter. Actual returns vary and are not guaranteed.",
    ],
    formula: {
      expression: "Each month: Value = (Value + Instalment) × (1 + i);  each year: Instalment × (1 + step-up)",
      legend: ["i — monthly return equivalent to the yearly return", "step-up — the yearly increase in your instalment"],
    },
    faqs: [
      {
        q: "How much should I step up my SIP?",
        a: "Many investors match their expected salary growth, often 5–10% a year. Any regular increase helps, because the extra money has longer to compound.",
      },
      { q: "Can I step up an existing SIP?", a: "Most fund houses and platforms let you add a top-up when you register a SIP, or start a second SIP later." },
      {
        q: "Is a step-up SIP better than a bigger SIP?",
        a: "If you can afford the bigger amount today, starting higher grows more. A step-up suits people whose income rises over time.",
      },
    ],
    related: ["sip-calculator", "lumpsum-calculator", "nps-calculator"],
  },
  {
    slug: "lumpsum-calculator",
    category: "investments",
    name: "Lumpsum calculator",
    title: "Lumpsum Calculator — One-Time Investment Returns",
    summary: "What a one-time investment could grow to.",
    description: "Free lumpsum calculator. Estimate what a one-time mutual fund investment could grow to at an expected yearly return.",
    icon: "coins",
    howItWorks: [
      "A lump sum is invested once and compounds every year at the return you enter. Use it for a bonus, maturity proceeds or any one-time investment.",
      "Actual market returns vary from year to year; the calculator shows the result of a steady yearly rate.",
    ],
    formula: { expression: "Value = P × (1 + r)ᵗ", legend: ["P — amount invested", "r — yearly return", "t — years"] },
    faqs: [
      {
        q: "Lump sum or SIP?",
        a: "A lump sum invested earlier has more time to grow, but it is fully exposed to the market's level on the day you invest. A SIP spreads the risk across many dates. Many investors combine the two.",
      },
      { q: "How long does money take to double?", a: "Divide 72 by the yearly return: at 12% money doubles in about six years, at 8% in about nine." },
    ],
    related: ["sip-calculator", "cagr-calculator", "fd-calculator"],
  },
  {
    slug: "swp-calculator",
    category: "investments",
    name: "SWP calculator",
    title: "SWP Calculator — Systematic Withdrawal Plan",
    summary: "How long a corpus lasts with a fixed monthly withdrawal.",
    description: "Free SWP calculator. See how much a corpus is worth after regular monthly withdrawals, and how long it lasts, at an expected return.",
    icon: "arrow-down",
    howItWorks: [
      "A systematic withdrawal plan pays you a fixed amount every month from a mutual fund. The withdrawal is taken at the start of each month and the rest stays invested.",
      "If your withdrawals are more than the corpus earns, it shrinks — the calculator shows how long the money lasts.",
    ],
    faqs: [
      {
        q: "How much can I withdraw safely?",
        a: "A withdrawal close to what the corpus earns keeps the capital roughly intact. Withdrawing more draws down the capital; the year-by-year table shows when it would run out.",
      },
      {
        q: "How are SWP withdrawals taxed?",
        a: "Each withdrawal is treated as a sale of units, so only the gain portion is taxed as capital gains — usually far less tax than on interest of the same amount.",
      },
    ],
    related: ["sip-calculator", "lumpsum-calculator", "nps-calculator"],
  },
  {
    slug: "cagr-calculator",
    category: "investments",
    name: "CAGR calculator",
    title: "CAGR Calculator — Compound Annual Growth Rate",
    summary: "The yearly growth rate between a starting and an ending value.",
    description: "Free CAGR calculator. Work out the compound annual growth rate of an investment, a business or any value over a number of years.",
    icon: "chart",
    popular: true,
    howItWorks: [
      "CAGR is the steady yearly rate that would take a value from where it started to where it ended over the same period. It smooths out the ups and downs in between.",
      "Use it to compare investments held for different lengths of time, or to describe a company's revenue growth.",
    ],
    formula: { expression: "CAGR = (End ÷ Start)^(1 ÷ years) − 1", legend: [] },
    faqs: [
      {
        q: "Is CAGR the same as average return?",
        a: "No. Averaging yearly returns overstates growth when returns swing. CAGR is the rate that actually links the starting and ending values.",
      },
      {
        q: "When should I use XIRR instead?",
        a: "When money went in or came out at different times, as with a SIP. CAGR suits a single amount invested at the start.",
      },
    ],
    related: ["lumpsum-calculator", "sip-calculator", "fd-calculator"],
  },

  /* ------------------------- Savings and retirement ------------------------- */
  {
    slug: "fd-calculator",
    category: "savings",
    name: "FD calculator",
    title: "FD Calculator — Fixed Deposit Maturity and Interest",
    summary: "Maturity value and interest on a fixed deposit.",
    description: "Free FD calculator. Work out the maturity value and interest on a fixed deposit with quarterly, monthly, half-yearly or yearly compounding.",
    icon: "vault",
    popular: true,
    howItWorks: [
      "A cumulative fixed deposit adds interest to the balance, so later interest is earned on earlier interest. Most Indian banks compound quarterly; choose another frequency if your deposit uses one.",
      "FD interest is taxed at your slab rate. Banks deduct TDS when interest from a bank exceeds ₹50,000 in a year (₹1 lakh for senior citizens), unless you submit Form 15G or 15H where eligible.",
    ],
    formula: {
      expression: "Maturity = P × (1 + r ÷ k)^(k × t)",
      legend: ["P — deposit", "r — yearly rate", "k — compounding periods a year (4 for quarterly)", "t — years"],
    },
    faqs: [
      {
        q: "What is the difference between cumulative and payout FDs?",
        a: "A cumulative FD adds interest to the deposit and pays everything at maturity. A payout FD pays interest monthly or quarterly and returns only the deposit at the end, so it earns less in total.",
      },
      {
        q: "Do senior citizens get more?",
        a: "Usually 0.25–0.5% a year more. Enter your bank's senior-citizen rate to see the difference.",
      },
    ],
    related: ["rd-calculator", "ppf-calculator", "lumpsum-calculator"],
  },
  {
    slug: "rd-calculator",
    category: "savings",
    name: "RD calculator",
    title: "RD Calculator — Recurring Deposit Maturity",
    summary: "What a monthly recurring deposit will be worth at maturity.",
    description: "Free RD calculator. Work out the maturity value and interest on a bank or post office recurring deposit, compounded quarterly.",
    icon: "calendar",
    howItWorks: [
      "In a recurring deposit you deposit the same amount every month. Each instalment earns interest compounded quarterly for as long as it stays deposited — the first for the whole term, the last for just a month. Banks and the post office calculate maturity this way.",
      "The post office 5-year RD pays 6.7% for October–December 2026. RD interest is taxed at your slab rate.",
    ],
    faqs: [
      {
        q: "RD or SIP?",
        a: "An RD gives a fixed, guaranteed return; a SIP in an equity fund can earn more over the long term but its value moves with the market. RDs suit short-term goals; SIPs suit goals five or more years away.",
      },
      {
        q: "What happens if I miss an instalment?",
        a: "Banks and the post office usually charge a small penalty for each missed instalment, and several missed instalments can close the account.",
      },
    ],
    related: ["fd-calculator", "sip-calculator", "ppf-calculator"],
  },
  {
    slug: "ppf-calculator",
    category: "savings",
    name: "PPF calculator",
    title: "PPF Calculator — Public Provident Fund Maturity 2026",
    summary: "Your PPF balance at maturity, at the current 7.1% rate.",
    description: "Free PPF calculator at the current 7.1% rate. See the maturity value, total interest and year-by-year balance of a Public Provident Fund account.",
    icon: "shield",
    popular: true,
    howItWorks: [
      "You can deposit ₹500 to ₹1.5 lakh a year in a PPF account for 15 years, and extend it in blocks of five years. Interest is compounded yearly; the calculator assumes each year's deposit is made at the start of the year (by 5 April for that month's interest).",
      "The government sets the PPF rate every quarter; it is 7.1% for October–December 2026. Deposits qualify for the 80C deduction in the old regime, and the interest and maturity amount are tax-free.",
    ],
    formula: {
      expression: "Maturity = P × ((1 + r)ⁿ − 1) ÷ r × (1 + r)",
      legend: ["P — yearly deposit", "r — yearly rate (7.1% = 0.071)", "n — years"],
    },
    faqs: [
      { q: "What is the PPF interest rate?", a: "7.1% a year for October–December 2026, unchanged for ten quarters. The rate can change every quarter." },
      {
        q: "Can I withdraw before 15 years?",
        a: "Partial withdrawals are allowed from the seventh financial year, and loans from the third. Premature closure is allowed after five years for specific reasons such as treatment or higher education, at a lower rate.",
      },
      {
        q: "Is PPF tax-free?",
        a: "Yes — it is exempt at all three stages: deposits are deductible (old regime), and interest and maturity are tax-free.",
      },
    ],
    related: ["sukanya-samriddhi-calculator", "epf-calculator", "fd-calculator", "income-tax-calculator"],
  },
  {
    slug: "sukanya-samriddhi-calculator",
    category: "savings",
    name: "Sukanya Samriddhi calculator",
    title: "Sukanya Samriddhi Yojana Calculator — SSY Maturity 2026",
    summary: "What an SSY account for your daughter will be worth at 21 years.",
    description: "Free Sukanya Samriddhi Yojana (SSY) calculator at the current 8.2% rate. See the maturity value of deposits for 15 years, maturing 21 years after opening.",
    icon: "flower",
    howItWorks: [
      "A Sukanya Samriddhi account can be opened for a girl below 10 years. You deposit ₹250 to ₹1.5 lakh a year for 15 years; the account matures 21 years after it was opened, earning interest all the while.",
      "The rate is 8.2% for October–December 2026, compounded yearly. Deposits qualify for the 80C deduction in the old regime, and the interest and maturity amount are tax-free.",
    ],
    faqs: [
      {
        q: "When can the money be withdrawn?",
        a: "Up to half of the balance can be withdrawn for higher education once she turns 18 or passes class 10. The account can also be closed on her marriage after 18.",
      },
      { q: "What is the current SSY rate?", a: "8.2% a year for October–December 2026. The government reviews it every quarter." },
    ],
    related: ["ppf-calculator", "sip-calculator", "income-tax-calculator"],
  },
  {
    slug: "epf-calculator",
    category: "savings",
    name: "EPF calculator",
    title: "EPF Calculator — Provident Fund Corpus at Retirement",
    summary: "Your EPF balance at retirement at the 8.25% rate.",
    description: "Free EPF calculator. Project your Employees' Provident Fund balance at retirement with your and your employer's contributions, salary growth and the 8.25% rate.",
    icon: "briefcase",
    howItWorks: [
      "You contribute 12% of your basic pay and dearness allowance to EPF every month. Your employer also contributes 12%, but 8.33% of wages up to ₹15,000 (at most ₹1,250 a month) goes to the pension scheme (EPS) instead of your EPF account.",
      "Interest is worked out monthly on the running balance and credited once a year. EPFO declared 8.25% for FY 2025-26, the same as the two years before.",
    ],
    faqs: [
      { q: "What is the EPF interest rate?", a: "8.25% for FY 2025-26, notified by EPFO in July 2026." },
      {
        q: "Can I contribute more than 12%?",
        a: "Yes, through the Voluntary Provident Fund (VPF). It earns the same rate; interest on your own contributions above ₹2.5 lakh a year is taxable.",
      },
      {
        q: "Is the employer's pension share included?",
        a: "No. The EPS share builds a pension, not your EPF balance, so the calculator leaves it out of the corpus.",
      },
    ],
    related: ["nps-calculator", "gratuity-calculator", "ppf-calculator", "income-tax-calculator"],
  },
  {
    slug: "nps-calculator",
    category: "savings",
    name: "NPS calculator",
    title: "NPS Calculator — Pension, Lump Sum and Corpus 2026",
    summary: "Your NPS corpus, lump sum and monthly pension at retirement.",
    description: "Free NPS calculator with the 2025 PFRDA exit rules. Estimate your National Pension System corpus, tax-free lump sum and monthly pension.",
    icon: "sunset",
    howItWorks: [
      "Your monthly contributions grow until you retire. At exit, part of the corpus buys an annuity that pays a monthly pension, and the rest can be taken as a lump sum.",
      "Since PFRDA's December 2025 changes, non-government subscribers with a corpus above ₹12 lakh can take up to 80% as a lump sum and must annuitise at least 20%. Only 60% of the corpus is tax-free on withdrawal until the income-tax law is amended, so the calculator shows the taxable part separately.",
      "Your own contributions are deductible up to ₹50,000 extra in the old regime; your employer's contribution is deductible in both regimes.",
    ],
    faqs: [
      {
        q: "How much of the corpus can I take as a lump sum?",
        a: "Non-government subscribers can take up to 80% if the corpus is above ₹12 lakh, with at least 20% buying an annuity. Smaller corpuses have more flexible options, including the full amount if it is ₹8 lakh or less.",
      },
      { q: "What annuity rate should I assume?", a: "Annuity rates for a life pension are around 6–7% a year at 60. Rates for joint-life or return-of-purchase-price options are lower." },
      {
        q: "Is the lump sum taxable?",
        a: "Up to 60% of the corpus is tax-free. The rules now allow up to 80%, but the part above 60% is taxable until the income-tax law catches up. The pension is taxed as income each year.",
      },
    ],
    related: ["epf-calculator", "sip-calculator", "swp-calculator", "income-tax-calculator"],
  },
];

const BY_SLUG = new Map(TOOLS.map((tool) => [tool.slug, tool]));

export function getTool(slug: string): Tool {
  const tool = BY_SLUG.get(slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}

export const TOOL_SLUGS = TOOLS.map((tool) => tool.slug);
