import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";

import { PageHeader, Section } from "@/components/layout/section";
import { InsightCard } from "@/components/posts/insight-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchPosts } from "@/server/queries/posts";

export const metadata: Metadata = {
  title: "Insights",
  description: "Analysis from the TaxKatha desk: what the latest tax rulings mean in practice, and how to act on them.",
  alternates: { canonical: "/insights" },
};

const PAGE_SIZE = 13;

async function InsightList({ searchParams }: Pick<PageProps<"/insights">, "searchParams">) {
  const query = await searchParams;
  const raw = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.min(Math.max(Number.parseInt(raw ?? "1", 10) || 1, 1), 500);
  const { items, total } = await searchPosts({ type: "insight" }, { page, member: false, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-20 text-center">
        <PenLine strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
        <h2 className="type-display-sm mt-5">The first insights are being written</h2>
        <p className="type-small mt-2 max-w-md text-muted-foreground">
          In the meantime, every ruling in the directory already comes with a clear summary.
        </p>
        <Link href="/case-laws" className={buttonVariants({ className: "mt-6" })}>
          Browse case laws
        </Link>
      </div>
    );
  }

  const [lead, ...rest] = items;
  return (
    <>
      {page === 1 && lead ? (
        <div className="mb-6">
          <InsightCard post={lead} headingLevel="h2" large className="lg:flex-row [&>div:first-child]:lg:aspect-auto [&>div:first-child]:lg:w-3/5" />
        </div>
      ) : null}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(page === 1 ? rest : items).map((post) => (
          <li key={post.id}>
            <InsightCard post={post} headingLevel="h2" />
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between border-t pt-6">
          {page > 1 ? (
            <Link href={page === 2 ? "/insights" : `/insights?page=${page - 1}`} rel="prev" className={buttonVariants({ variant: "outline" })}>
              <ChevronLeft /> Newer
            </Link>
          ) : (
            <span />
          )}
          <p className="type-caption text-muted-foreground">
            Page {page} of {pages}
          </p>
          {page < pages ? (
            <Link href={`/insights?page=${page + 1}`} rel="next" className={buttonVariants({ variant: "outline" })}>
              Older <ChevronRight />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

export default function InsightsPage({ searchParams }: PageProps<"/insights">) {
  return (
    <>
      <PageHeader
        eyebrow="From the TaxKatha desk"
        title="Insights"
        description="What the rulings mean in practice — analysis you can act on, written by people who read the judgments."
      />
      <Section className="py-10 md:py-14">
        <div className="container-wide">
          <Suspense
            fallback={
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-80 w-full rounded-xl" />
                ))}
              </div>
            }
          >
            <InsightList searchParams={searchParams} />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
