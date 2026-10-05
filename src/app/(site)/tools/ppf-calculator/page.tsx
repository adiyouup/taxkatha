import { Suspense } from "react";

import { PpfCalculator, PpfCalculatorFromUrl } from "@/components/tools/calculators/deposits";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("ppf-calculator");

export default function Page() {
  return (
    <ToolPage slug="ppf-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<PpfCalculator />}>
        <PpfCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
