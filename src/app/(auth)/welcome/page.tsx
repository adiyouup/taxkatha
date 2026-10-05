import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { GoldRule } from "@/components/brand/motif";
import { Skeleton } from "@/components/ui/skeleton";
import { safeNextPath } from "@/lib/safe-redirect";
import { getFreshViewer } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function WelcomePanel({ searchParams }: Pick<PageProps<"/welcome">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next), "/");
  const viewer = await getFreshViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent("/welcome")}`);
  if (viewer.onboarded) redirect(next);

  return (
    <>
      <h1 className="type-display-lg mt-4">Welcome, {viewer.name.split(" ")[0]}</h1>
      <GoldRule align="start" className="mt-6" />
      <p className="type-body mt-6 mb-8 text-muted-foreground">
        One quick question so discussions show who is speaking. It takes ten seconds.
      </p>
      <OnboardingForm next={next} />
    </>
  );
}

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <div>
      <p className="type-eyebrow text-gold-text">Almost there</p>
      <Suspense
        fallback={
          <div className="mt-4 space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <WelcomePanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
