import { Suspense } from "react";

import { LoanCalculator, LoanCalculatorFromUrl } from "@/components/tools/calculators/loan";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("home-loan-emi-calculator");

export default function Page() {
  return (
    <ToolPage slug="home-loan-emi-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<LoanCalculator kind="home" />}>
        <LoanCalculatorFromUrl kind="home" />
      </Suspense>
    </ToolPage>
  );
}
