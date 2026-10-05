import { Suspense } from "react";

import { SwpCalculator, SwpCalculatorFromUrl } from "@/components/tools/calculators/withdrawals";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("swp-calculator");

export default function Page() {
  return (
    <ToolPage slug="swp-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<SwpCalculator />}>
        <SwpCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
