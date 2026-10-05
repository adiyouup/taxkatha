import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader, Section } from "@/components/layout/section";
import { DirectorySearch } from "@/components/posts/directory-controls";
import { DirectorySkeleton, DirectoryView } from "@/components/posts/directory-view";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDirectoryParams } from "@/lib/directory-params";
import { getViewer } from "@/server/auth/dal";
import { getDirectoryFacets, getTopicBySlug } from "@/server/queries/posts";

type Props = PageProps<"/topics/[slug]">;

export async function generateStaticParams() {
  const { topics } = await getDirectoryFacets();
  return topics.length > 0 ? topics.map((topic) => ({ slug: topic.slug })) : [{ slug: "placeholder" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) return { title: "Topic not found", robots: { index: false } };
  return {
    title: `${topic.name} — tax rulings`,
    description: `${topic.description ?? `Rulings on ${topic.name.toLowerCase()}.`} Summaries of Supreme Court, High Court and tribunal decisions.`,
    alternates: { canonical: `/topics/${topic.slug}` },
  };
}

async function Header({ params, searchParams }: Props) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) notFound();
  const query = parseDirectoryParams(await searchParams);
  return (
    <PageHeader eyebrow="Topic" title={topic.name} description={topic.description}>
      <div className="max-w-3xl">
        <DirectorySearch
          key={query.q ?? ""}
          params={query}
          basePath={`/topics/${topic.slug}`}
          placeholder={`Search within ${topic.name.toLowerCase()}`}
        />
      </div>
    </PageHeader>
  );
}

async function Results({ params, searchParams }: Props) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) notFound();
  const query = parseDirectoryParams(await searchParams);
  const member = (await getViewer()) !== null;
  return (
    <DirectoryView
      params={{ ...query, topic: undefined }}
      member={member}
      basePath={`/topics/${topic.slug}`}
      fixed={{ topic: topic.slug }}
      hide={["topic"]}
    />
  );
}

export default function TopicPage(props: Props) {
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
