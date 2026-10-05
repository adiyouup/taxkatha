import { toolCard } from "@/server/cards/tool-card";

export { contentType, size } from "@/server/cards/tool-card";
export const alt = "TaxKatha calculator";

export default function Image() {
  return toolCard("epf-calculator");
}
