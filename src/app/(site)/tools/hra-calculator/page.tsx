import { Suspense } from "react";

import { HraCalculator, HraCalculatorFromUrl } from "@/components/tools/calculators/tax";
import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const metadata = toolMetadata("hra-calculator");

export default function Page() {
  return (
    <ToolPage slug="hra-calculator">
      {/* Prerendered with the defaults; the values in a shared link load in the browser. */}
      <Suspense fallback={<HraCalculator />}>
        <HraCalculatorFromUrl />
      </Suspense>
    </ToolPage>
  );
}
