import { Suspense } from "react";

import { NpsCalculator, NpsCalculatorFromUrl } from "@/components/tools/calculators/retirement";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("nps-calculator");

export default function Page() {
  return (
    <ToolPage slug="nps-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<NpsCalculator />}>
        <NpsCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
