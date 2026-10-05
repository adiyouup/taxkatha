import { Suspense } from "react";

import { EpfCalculator, EpfCalculatorFromUrl } from "@/components/tools/calculators/retirement";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("epf-calculator");

export default function Page() {
  return (
    <ToolPage slug="epf-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<EpfCalculator />}>
        <EpfCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
