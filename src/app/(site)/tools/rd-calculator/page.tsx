import { Suspense } from "react";

import { RdCalculator, RdCalculatorFromUrl } from "@/components/tools/calculators/deposits";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("rd-calculator");

export default function Page() {
  return (
    <ToolPage slug="rd-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<RdCalculator />}>
        <RdCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
