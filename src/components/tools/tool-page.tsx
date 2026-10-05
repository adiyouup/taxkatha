import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import { GoldRule } from "@/components/brand/motif";
import { PageHeader } from "@/components/layout/section";
import { ToolIcon } from "@/components/tools/tool-icon";
import { siteConfig } from "@/lib/site";
import { getTool, RATES_CHECKED, TOOL_CATEGORIES } from "@/lib/tools/registry";

export function toolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  return {
    title: { absolute: `${tool.title} | ${siteConfig.name}` },
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { type: "website", title: tool.title, description: tool.description, url: `/tools/${tool.slug}` },
    twitter: { card: "summary_large_image", title: tool.title, description: tool.description },
  };
}

function jsonLd(slug: string) {
  const tool = getTool(slug);
  const url = `${siteConfig.url}/tools/${tool.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.name,
        url,
        description: tool.description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Tools", item: `${siteConfig.url}/tools` },
          { "@type": "ListItem", position: 2, name: tool.name, item: url },
        ],
      },
    ],
  };
}

/**
 * Every calculator page: the navy header, the calculator itself, then how it
 * works, the formula, questions and related tools. The calculator runs in
 * the browser; this page is fully prerendered.
 */
export function ToolPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const tool = getTool(slug);
  const category = TOOL_CATEGORIES[tool.category];
  const related = tool.related.map(getTool);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(slug)).replace(/</g, "\\u003c") }} />
      <PageHeader eyebrow={`Calculators · ${category.label}`} title={tool.name} description={tool.summary}>
        <nav aria-label="Breadcrumb">
          <ol className="type-caption flex items-center gap-1.5 text-muted-foreground">
            <li>
              <Link href="/tools" className="hover:text-paper hover:underline">
                All calculators
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
            <li className="text-paper/80">{tool.name}</li>
          </ol>
        </nav>
      </PageHeader>

      <div className="bg-paper-2">
        <div className="container-wide -mt-px py-10 sm:py-14">{children}</div>
      </div>

      <div className="container-content grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16 lg:py-20">
        <div className="min-w-0 max-w-[44rem] space-y-12">
          <section aria-labelledby="how-heading">
            <h2 id="how-heading" className="type-display-md">
              How it works
            </h2>
            <GoldRule align="start" className="mt-5" />
            <div className="mt-6 space-y-4">
              {tool.howItWorks.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="type-body text-foreground/85">
                  {paragraph}
                </p>
              ))}
            </div>
            {tool.formula ? (
              <div className="mt-8 rounded-xl border bg-card p-5 shadow-soft">
                <p className="type-eyebrow text-[0.6875rem] text-gold-text">Formula</p>
                <p className="mt-3 font-mono text-[0.9375rem] text-foreground">{tool.formula.expression}</p>
                {tool.formula.legend.length > 0 ? (
                  <ul className="type-small mt-3 space-y-1 text-muted-foreground">
                    {tool.formula.legend.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="type-display-md">
              Questions
            </h2>
            <GoldRule align="start" className="mt-5" />
            <div className="mt-6 divide-y rounded-xl border bg-card">
              {tool.faqs.map((faq) => (
                <details key={faq.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-foreground">
                    {faq.q}
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-gold-700 transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  <p className="type-body mt-3 text-foreground/85">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="type-caption border-t pt-6 text-muted-foreground">
            Results are estimates for planning, not tax, legal or investment advice. Rates and rules were checked on {RATES_CHECKED}; confirm the
            figures that apply to you with your bank, fund house or tax adviser.
          </p>
        </div>

        <aside className="space-y-4">
          <p className="type-eyebrow text-[0.6875rem] text-gold-text">Related calculators</p>
          <ul className="space-y-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/tools/${r.slug}`} className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-gold-600">
                  <ToolIcon name={r.icon} className="size-5 shrink-0 text-gold-700" />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{r.name}</span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-text hover:underline">
            All calculators <ArrowRight className="size-4" aria-hidden />
          </Link>
        </aside>
      </div>
    </>
  );
}
