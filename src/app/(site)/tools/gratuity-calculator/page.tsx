import { Suspense } from "react";

import { GratuityCalculator, GratuityCalculatorFromUrl } from "@/components/tools/calculators/retirement";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("gratuity-calculator");

export default function Page() {
  return (
    <ToolPage slug="gratuity-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<GratuityCalculator />}>
        <GratuityCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
