import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { GoldRule } from "@/components/brand/motif";
import { Skeleton } from "@/components/ui/skeleton";
import { safeNextPath } from "@/lib/safe-redirect";
import { getViewer } from "@/server/auth/dal";
import { devLoginEnabled } from "@/server/auth/dev-flag";
import { enabledProviders } from "@/server/auth/options";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to TaxKatha to read the full analysis of every ruling and join the discussion.",
  robots: { index: false, follow: true },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function SignInPanel({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next), "/");

  if (await getViewer()) redirect(next);

  const providers = enabledProviders();
  const devLogin = devLoginEnabled();

  return (
    <>
      {providers.length > 0 ? (
        <OAuthButtons providers={providers} next={next} />
      ) : (
        <p className="type-small rounded-md border border-dashed border-input bg-muted p-4 text-muted-foreground">
          No sign-in providers are configured yet. Add the Google, LinkedIn or Microsoft client credentials to{" "}
          <code className="font-mono text-foreground">.env.local</code> and restart the server.
        </p>
      )}

      {devLogin ? (
        <form
          action="/api/dev/login"
          method="post"
          className="mt-8 space-y-3 rounded-lg border border-dashed border-gold-600/50 bg-gold-50 p-4"
        >
          <p className="type-eyebrow text-[0.625rem] text-gold-800">Developer login — local only</p>
          <input type="hidden" name="next" value={next} />
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="dev-email">
              Email
            </label>
            <input
              id="dev-email"
              name="email"
              type="email"
              required
              defaultValue="admin@taxkatha.test"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm"
            />
            <label className="sr-only" htmlFor="dev-role">
              Role
            </label>
            <select
              id="dev-role"
              name="role"
              defaultValue="admin"
              className="h-10 rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="admin">admin</option>
              <option value="moderator">moderator</option>
              <option value="user">user</option>
            </select>
          </div>
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-navy-900 text-sm font-semibold text-paper hover:bg-navy-800"
          >
            Sign in as this user
          </button>
        </form>
      ) : null}
    </>
  );
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div>
      <p className="type-eyebrow text-gold-text">Members</p>
      <h1 className="type-display-lg mt-4">Welcome to TaxKatha</h1>
      <GoldRule align="start" className="mt-6" />
      <p className="type-body mt-6 text-muted-foreground">
        Sign in to read the full analysis of every ruling, save what matters and join the discussion.
      </p>

      <div className="mt-8">
        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <Skeleton className="h-13 w-full" />
              <Skeleton className="h-13 w-full" />
              <Skeleton className="h-13 w-full" />
            </div>
          }
        >
          <SignInPanel searchParams={searchParams} />
        </Suspense>
      </div>

      <p className="type-caption mt-8 text-muted-foreground">
        By continuing you agree to our{" "}
        <Link href="/terms" className="font-medium text-foreground underline underline-offset-4 hover:text-gold-text">
          Terms of use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4 hover:text-gold-text">
          Privacy policy
        </Link>
        . We never post on your behalf.
      </p>
    </div>
  );
}
