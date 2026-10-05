import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader, Section } from "@/components/layout/section";
import { DirectorySearch } from "@/components/posts/directory-controls";
import { DirectorySkeleton, DirectoryView } from "@/components/posts/directory-view";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDirectoryParams } from "@/lib/directory-params";
import { COURT_TYPE_LABEL } from "@/lib/labels";
import { getViewer } from "@/server/auth/dal";
import { getCourtBySlug, getDirectoryFacets } from "@/server/queries/posts";

type Props = PageProps<"/courts/[slug]">;

export async function generateStaticParams() {
  const { courts } = await getDirectoryFacets();
  return courts.length > 0 ? courts.map((court) => ({ slug: court.slug })) : [{ slug: "placeholder" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) return { title: "Court not found", robots: { index: false } };
  return {
    title: `${court.name} — tax rulings`,
    description: court.description ?? `Summaries of tax rulings from the ${court.name}, searchable by section, topic and outcome.`,
    alternates: { canonical: `/courts/${court.slug}` },
  };
}

async function Header({ params, searchParams }: Props) {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) notFound();
  const query = parseDirectoryParams(await searchParams);
  return (
    <PageHeader eyebrow={COURT_TYPE_LABEL[court.type]} title={court.name} description={court.description ?? `Rulings of the ${court.name}, newest first.`}>
      <div className="max-w-3xl">
        <DirectorySearch
          key={query.q ?? ""}
          params={query}
          basePath={`/courts/${court.slug}`}
          placeholder={`Search ${court.shortName} rulings`}
        />
      </div>
    </PageHeader>
  );
}

async function Results({ params, searchParams }: Props) {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) notFound();
  const query = parseDirectoryParams(await searchParams);
  const member = (await getViewer()) !== null;
  return (
    <DirectoryView
      params={{ ...query, court: undefined, forum: undefined }}
      member={member}
      basePath={`/courts/${court.slug}`}
      fixed={{ court: court.slug }}
      hide={["court", "forum"]}
    />
  );
}

export default function CourtPage(props: Props) {
  return (
    <>
      <Suspense
        fallback={
          <div className="theme-navy">
            <div className="container-wide space-y-5 pt-32 pb-16 sm:pt-36">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-14 w-2/3" />
              <Skeleton className="h-14 w-full max-w-3xl" />
            </div>
          </div>
        }
      >
        <Header {...props} />
      </Suspense>
      <Section className="py-10 md:py-12 lg:py-14">
        <Suspense fallback={<DirectorySkeleton />}>
          <Results {...props} />
        </Suspense>
      </Section>
    </>
  );
}
