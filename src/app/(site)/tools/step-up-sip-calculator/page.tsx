import { Suspense } from "react";

import { SipCalculator, SipCalculatorFromUrl } from "@/components/tools/calculators/sip";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("step-up-sip-calculator");

export default function Page() {
  return (
    <ToolPage slug="step-up-sip-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<SipCalculator stepUpDefault={10} />}>
        <SipCalculatorFromUrl stepUpDefault={10} />
      </Suspense>
    </ToolPage>
  );
}
