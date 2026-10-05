import { notFound } from "next/navigation";

import { formatDate } from "@/lib/format";
import { CARD_FORMATS, renderCard } from "@/server/cards/render";
import { getInsight } from "@/server/queries/insights";

export const alt = "TaxKatha insight";
export const size = CARD_FORMATS.og;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const insight = await getInsight(slug);
  if (!insight) notFound();
  return renderCard(
    {
      kind: "Insight",
      eyebrow: `${insight.authorName ?? "TaxKatha"}  ·  ${formatDate(insight.publishedAt)}`,
      title: insight.title,
      summary: insight.excerpt,
      chips: insight.topic ? [insight.topic.name] : [],
    },
    "og",
  );
}
