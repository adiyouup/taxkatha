import { Suspense } from "react";

import { FdCalculator, FdCalculatorFromUrl } from "@/components/tools/calculators/deposits";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("fd-calculator");

export default function Page() {
  return (
    <ToolPage slug="fd-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<FdCalculator />}>
        <FdCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
