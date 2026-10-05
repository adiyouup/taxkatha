import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bookmark } from "lucide-react";

import { PageHeader, Section } from "@/components/layout/section";
import { CaseCard } from "@/components/posts/case-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/format";
import { requireViewer } from "@/server/auth/dal";
import { listSavedPostIds } from "@/server/queries/member";
import { getPostCards } from "@/server/queries/posts";

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };

async function SavedList() {
  const viewer = await requireViewer("/saved");
  const cards = await getPostCards(await listSavedPostIds(viewer.id));

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <Bookmark strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
        <h2 className="type-display-sm mt-5">Nothing saved yet</h2>
        <p className="type-small mt-2 max-w-md text-muted-foreground">
          Tap the bookmark on any ruling to keep it here for later — handy for the cases you cite most.
        </p>
        <Link href="/case-laws" className={buttonVariants({ className: "mt-6" })}>
          Browse case laws
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="type-small mb-5 text-muted-foreground">{pluralize(cards.length, "saved ruling")}</p>
      <ol className="grid gap-4">
        {cards.map((post) => (
          <li key={post.id}>
            <CaseCard post={post} headingLevel="h2" />
          </li>
        ))}
      </ol>
    </>
  );
}

export default function SavedPage() {
  return (
    <>
      <PageHeader eyebrow="Your library" title="Saved" description="The rulings you have bookmarked, most recent first." />
      <Section className="py-10 md:py-14">
        <div className="container-wide max-w-4xl">
          <Suspense
            fallback={
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-44 w-full rounded-xl" />
                ))}
              </div>
            }
          >
            <SavedList />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
