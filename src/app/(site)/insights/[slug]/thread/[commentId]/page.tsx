import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ThreadSkeleton, ThreadView } from "@/components/comments/thread-page";
import { formatDate } from "@/lib/format";
import { getInsight } from "@/server/queries/insights";

type Props = PageProps<"/insights/[slug]/thread/[commentId]">;

export const metadata: Metadata = { title: "Discussion thread", robots: { index: false, follow: true } };

async function Content({ params }: Pick<Props, "params">) {
  const { slug, commentId } = await params;
  const insight = await getInsight(slug);
  if (!insight) notFound();
  return (
    <ThreadView
      commentId={commentId}
      post={{
        id: insight.id,
        title: insight.title,
        path: `/insights/${insight.slug}`,
        eyebrow: `Thread · Insight · ${formatDate(insight.publishedAt)}`,
        backLabel: "Back to the article",
      }}
    />
  );
}

export default function InsightThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
