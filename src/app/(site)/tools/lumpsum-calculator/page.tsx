import { Suspense } from "react";

import { LumpsumCalculator, LumpsumCalculatorFromUrl } from "@/components/tools/calculators/sip";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("lumpsum-calculator");

export default function Page() {
  return (
    <ToolPage slug="lumpsum-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<LumpsumCalculator />}>
        <LumpsumCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
