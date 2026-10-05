import { formatDate } from "@/lib/format";
import { CARD_FORMATS, caseCardContent, renderCard, type CardContent, type CardFormat } from "@/server/cards/render";
import { getInsight } from "@/server/queries/insights";
import { getCaseTeaser } from "@/server/queries/posts";

/*
 * Share cards for download or for the native share sheet:
 *   /api/cards/<slug>/story   1080×1920 (Instagram / WhatsApp stories)
 *   /api/cards/<slug>/square  1080×1080 (feed posts)
 *   /api/cards/<slug>/og      1200×630  (link preview)
 * Public: built from the teaser only, so it is safe to cache at the CDN.
 */
export async function GET(_request: Request, context: RouteContext<"/api/cards/[slug]/[format]">) {
  const { slug, format } = await context.params;
  if (!(format in CARD_FORMATS)) return new Response("Unknown format", { status: 404 });

  let content: CardContent;
  const post = await getCaseTeaser(slug);
  if (post) {
    content = caseCardContent(post);
  } else {
    const insight = await getInsight(slug);
    if (!insight) return new Response("Not found", { status: 404 });
    content = {
      kind: "Insight",
      eyebrow: `${insight.authorName ?? "TaxKatha"}  ·  ${formatDate(insight.publishedAt)}`,
      title: insight.title,
      summary: insight.excerpt,
      chips: insight.topic ? [insight.topic.name] : [],
    };
  }

  return renderCard(content, format as CardFormat, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="taxkatha-${slug.slice(0, 60)}-${format}.png"`,
    },
  });
}
