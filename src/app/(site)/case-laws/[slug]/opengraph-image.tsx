import { notFound } from "next/navigation";

import { CARD_FORMATS, caseCardContent, renderCard } from "@/server/cards/render";
import { getCaseTeaser } from "@/server/queries/posts";

export const alt = "TaxKatha case-law summary";
export const size = CARD_FORMATS.og;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getCaseTeaser(slug);
  if (!post) notFound();
  return renderCard(caseCardContent(post), "og");
}
