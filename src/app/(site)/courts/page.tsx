import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Section, SectionHeading } from "@/components/layout/section";
import { formatNumber } from "@/lib/format";
import { COURT_TYPE_LABEL, type CourtType } from "@/lib/labels";
import { getDirectoryFacets } from "@/server/queries/posts";

export const metadata: Metadata = {
  title: "Courts and tribunals",
  description: "Browse tax rulings by forum: the Supreme Court, every High Court, GST Appellate Tribunal benches and the advance-ruling authorities.",
  alternates: { canonical: "/courts" },
};

const ORDER: CourtType[] = ["supreme_court", "high_court", "gstat", "cestat", "itat", "aaar", "aar", "naa", "tribunal", "other"];

export default async function CourtsPage() {
  const facets = await getDirectoryFacets();
  const groups = ORDER.map((type) => ({ type, courts: facets.courts.filter((c) => c.type === type) })).filter((g) => g.courts.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Browse by forum"
        title="Courts and tribunals"
        description="From the Supreme Court to the advance-ruling authorities — every forum whose decisions we summarise."
      />
      <Section>
        <div className="container-wide space-y-16">
          {groups.map((group) => (
            <section key={group.type} aria-labelledby={`group-${group.type}`}>
              <SectionHeading
                as="h2"
                title={<span id={`group-${group.type}`}>{COURT_TYPE_LABEL[group.type]}</span>}
                className="[&_h2]:type-display-md"
              />
              <ul className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
                {group.courts.map((court) => (
                  <li key={court.slug} className="bg-card">
                    <Link
                      href={`/courts/${court.slug}`}
                      className="flex h-full items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gold-50/60"
                    >
                      <span className="text-[0.9375rem] font-semibold text-foreground">{court.name}</span>
                      <span className="type-caption shrink-0 tabular-nums text-gold-text">{formatNumber(court.count)}</span>
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
