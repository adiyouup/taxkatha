import { CARD_FORMATS, renderCard } from "@/server/cards/render";

export const alt = "TaxKatha — Indian tax rulings, distilled";
export const size = CARD_FORMATS.og;
export const contentType = "image/png";

/** Default link-preview image for pages without their own. */
export default function Image() {
  return renderCard(
    {
      kind: "Case law",
      eyebrow: "Simplifying tax. Empowering you.",
      title: "Every tax ruling, distilled.",
      summary: "",
      chips: ["Supreme Court", "High Courts", "GSTAT"],
    },
    "og",
  );
}
