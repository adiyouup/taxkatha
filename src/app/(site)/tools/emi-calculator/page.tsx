import { Suspense } from "react";

import { LoanCalculator, LoanCalculatorFromUrl } from "@/components/tools/calculators/loan";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("emi-calculator");

export default function Page() {
  return (
    <ToolPage slug="emi-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<LoanCalculator kind="general" />}>
        <LoanCalculatorFromUrl kind="general" />
      </Suspense>
    </ToolPage>
  );
}
