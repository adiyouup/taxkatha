import { Suspense } from "react";

import { LoanCalculator, LoanCalculatorFromUrl } from "@/components/tools/calculators/loan";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("personal-loan-emi-calculator");

export default function Page() {
  return (
    <ToolPage slug="personal-loan-emi-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<LoanCalculator kind="personal" />}>
        <LoanCalculatorFromUrl kind="personal" />
      </Suspense>
    </ToolPage>
  );
}
