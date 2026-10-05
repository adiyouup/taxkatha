import { Suspense } from "react";

import { GstCalculator, GstCalculatorFromUrl } from "@/components/tools/calculators/tax";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("gst-calculator");

export default function Page() {
  return (
    <ToolPage slug="gst-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<GstCalculator />}>
        <GstCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
