import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ThreadSkeleton, ThreadView } from "@/components/comments/thread-page";
import { formatDate } from "@/lib/format";
import { getCaseTeaser } from "@/server/queries/posts";

type Props = PageProps<"/case-laws/[slug]/thread/[commentId]">;

// Discussions are members-only, so thread pages stay out of search results.
export const metadata: Metadata = { title: "Discussion thread", robots: { index: false, follow: true } };

async function Content({ params }: Pick<Props, "params">) {
  const { slug, commentId } = await params;
  const post = await getCaseTeaser(slug);
  if (!post) notFound();
  return (
    <ThreadView
      commentId={commentId}
      post={{
        id: post.id,
        title: post.title,
        path: `/case-laws/${post.slug}`,
        eyebrow: `Thread · ${post.caseLaw.court.shortName} · ${formatDate(post.caseLaw.decisionDate)}`,
        backLabel: "Back to the ruling",
      }}
    />
  );
}

export default function CaseThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
