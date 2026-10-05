import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PageHeader, Section } from "@/components/layout/section";
import { ToolIcon } from "@/components/tools/tool-icon";
import { TOOL_CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "Tax and Finance Calculators — Income Tax, SIP, EMI, GST",
  description:
    "Free calculators for India: income tax (old vs new regime), GST, HRA, gratuity, EMI for home, car and personal loans, SIP, lumpsum, SWP, CAGR, FD, RD, PPF, Sukanya Samriddhi, EPF and NPS.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Calculators"
        title="Tax and money, worked out"
        description="Free calculators built on the current rules — the Income-tax Act, 2025, GST 2.0, and this quarter's scheme rates. Every result shows its working."
      />
      <Section tint>
        <div className="container-wide space-y-16">
          {(Object.keys(TOOL_CATEGORIES) as ToolCategory[]).map((category) => (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-4">
                <h2 id={`cat-${category}`} className="type-display-md">
                  {TOOL_CATEGORIES[category].label}
                </h2>
                <p className="type-small text-muted-foreground">{TOOL_CATEGORIES[category].description}</p>
              </div>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TOOLS.filter((tool) => tool.category === category).map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="group relative flex h-full flex-col rounded-xl border bg-card p-5 shadow-soft transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-gold-600/60 hover:shadow-lift"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex size-11 items-center justify-center rounded-lg bg-navy-900 text-gold-400">
                          <ToolIcon name={tool.icon} className="size-5" />
                        </span>
                        {tool.popular ? (
                          <span className="rounded-xs border border-gold-600/40 bg-gold-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-gold-800">Most used</span>
                        ) : null}
                      </div>
                      <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{tool.name}</h3>
                      <p className="type-small mt-1.5 flex-1 text-muted-foreground">{tool.summary}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-text">
                        Open <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Section>
    </>
  );
}
