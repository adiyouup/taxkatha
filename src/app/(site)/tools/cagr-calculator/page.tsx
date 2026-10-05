import { Suspense } from "react";

import { CagrCalculator, CagrCalculatorFromUrl } from "@/components/tools/calculators/withdrawals";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("cagr-calculator");

export default function Page() {
  return (
    <ToolPage slug="cagr-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<CagrCalculator />}>
        <CagrCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
