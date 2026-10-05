import { CARD_FORMATS, renderCard } from "@/server/cards/render";
import { getTool, TOOL_CATEGORIES } from "@/lib/tools/registry";

export const size = CARD_FORMATS.og;
export const contentType = "image/png";

/** Link-preview image for a calculator page. */
export function toolCard(slug: string) {
  const tool = getTool(slug);
  return renderCard(
    { kind: "Calculator", eyebrow: `Free calculator · ${TOOL_CATEGORIES[tool.category].label}`, title: tool.name, summary: tool.summary, chips: ["Current rules", "Shows the working"] },
    "og",
  );
}
