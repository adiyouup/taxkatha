import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, Section } from "@/components/layout/section";
import { DirectorySearch } from "@/components/posts/directory-controls";
import { DirectorySkeleton, DirectoryView } from "@/components/posts/directory-view";
import { parseDirectoryParams } from "@/lib/directory-params";
import { getViewer } from "@/server/auth/dal";

export const metadata: Metadata = {
  title: "Case laws",
  description:
    "Search Indian GST and tax rulings by case, court, section or topic. Clear summaries of Supreme Court, High Court, GSTAT and advance-ruling decisions.",
  alternates: { canonical: "/case-laws" },
};

type Props = Pick<PageProps<"/case-laws">, "searchParams">;

async function SearchBar({ searchParams }: Props) {
  const params = parseDirectoryParams(await searchParams);
  return <DirectorySearch key={params.q ?? ""} params={params} placeholder="Search by party, section, court or subject" />;
}

async function Results({ searchParams }: Props) {
  const params = parseDirectoryParams(await searchParams);
  const member = (await getViewer()) !== null;
  return <DirectoryView params={params} member={member} />;
}

export default function CaseLawsPage({ searchParams }: PageProps<"/case-laws">) {
  return (
    <>
      <PageHeader
        eyebrow="Case-law directory"
        title="Every ruling, in plain sight."
        description="Search and filter tax rulings from the Supreme Court, the High Courts, the GST Appellate Tribunal and the advance-ruling authorities."
      >
        <div className="max-w-3xl">
          <Suspense fallback={<div className="h-14 rounded-lg border border-white/18 bg-white/8" />}>
            <SearchBar searchParams={searchParams} />
          </Suspense>
        </div>
      </PageHeader>
      <Section className="py-10 md:py-12 lg:py-14">
        <Suspense fallback={<DirectorySkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </Section>
    </>
  );
}
