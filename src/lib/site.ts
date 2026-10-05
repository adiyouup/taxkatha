/** Site-wide constants shared by server and client code. */

export const siteConfig = {
  name: "TaxKatha",
  tagline: "Simplifying tax. Empowering you.",
  descriptor: "Insights • Analysis • Summary",
  description:
    "TaxKatha distils Indian tax rulings into clear, searchable summaries — with expert insights and a professional community to discuss what each decision means.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_IN",
  contactEmail: "hello@taxkatha.com",
  social: {
    linkedin: "https://www.linkedin.com/company/taxkatha",
    x: "https://x.com/taxkatha",
    instagram: "https://www.instagram.com/taxkatha",
  },
} as const;

export type NavItem = { label: string; href: string; description?: string };

export const mainNav: NavItem[] = [
  { label: "Case Laws", href: "/case-laws", description: "Search every ruling by court, section or topic" },
  { label: "Insights", href: "/insights", description: "Editorial analysis from the TaxKatha desk" },
  { label: "Topics", href: "/topics", description: "Browse rulings by subject" },
  { label: "Tools", href: "/tools/income-tax-calculator", description: "Income-tax calculator" },
  { label: "About", href: "/about", description: "Who we are and how we work" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Explore",
    items: [
      { label: "Case laws", href: "/case-laws" },
      { label: "Insights", href: "/insights" },
      { label: "Topics", href: "/topics" },
      { label: "Courts", href: "/courts" },
    ],
  },
  {
    title: "Tools",
    items: [{ label: "Income-tax calculator", href: "/tools/income-tax-calculator" }],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
];
