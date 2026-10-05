import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PageHeader, Section } from "@/components/layout/section";
import { formatNumber } from "@/lib/format";
import { getDirectoryFacets } from "@/server/queries/posts";

export const metadata: Metadata = {
  title: "Topics",
  description: "Browse Indian tax rulings by subject: demands, input tax credit, registration, refunds, appeals, penalties and more.",
  alternates: { canonical: "/topics" },
};

export default async function TopicsPage() {
  const facets = await getDirectoryFacets();

  return (
    <>
      <PageHeader
        eyebrow="Browse by subject"
        title="Topics"
        description="Every ruling is filed under the question it answers. Pick a subject to see how the courts have decided it."
      />
      <Section>
        <div className="container-wide">
          <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {facets.topics.map((topic) => (
              <li key={topic.slug} className="bg-card">
                <Link
                  href={`/topics/${topic.slug}`}
                  className="group relative flex h-full flex-col p-6 transition-colors hover:bg-gold-50/60 sm:p-7"
                >
                  <span aria-hidden className="absolute inset-x-6 top-0 h-px origin-left scale-x-0 bg-gold-500 transition-transform duration-500 ease-out-expo group-hover:scale-x-100" />
                  <span className="flex items-start justify-between gap-4">
                    <span className="type-display-sm text-foreground">{topic.name}</span>
                    <ArrowUpRight strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                  {topic.description ? <span className="type-small mt-2.5 text-muted-foreground">{topic.description}</span> : null}
                  <span className="type-caption mt-auto pt-5 font-semibold text-gold-text">
                    {formatNumber(topic.count)} {topic.count === 1 ? "ruling" : "rulings"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}
