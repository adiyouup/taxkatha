import { Suspense } from "react";

import { SsyCalculator, SsyCalculatorFromUrl } from "@/components/tools/calculators/deposits";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("sukanya-samriddhi-calculator");

export default function Page() {
  return (
    <ToolPage slug="sukanya-samriddhi-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<SsyCalculator />}>
        <SsyCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
