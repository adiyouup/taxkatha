import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GoldRule } from "@/components/brand/motif";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign-in problem", robots: { index: false, follow: false } };

const MESSAGES: Record<string, { title: string; body: string }> = {
  account_not_linked: {
    title: "This email is already registered",
    body: "You first signed in with a different provider. Please sign in with that provider — you can then link more accounts from Settings.",
  },
  access_denied: {
    title: "Sign-in was cancelled",
    body: "You declined the request, so nothing was shared. You can try again whenever you are ready.",
  },
  email_not_found: {
    title: "We could not read your email address",
    body: "The provider did not share an email address. Please allow email access, or try another provider.",
  },
  banned: {
    title: "This account is suspended",
    body: "Your account cannot sign in at the moment. If you believe this is a mistake, please contact us.",
  },
};

const FALLBACK = {
  title: "We could not sign you in",
  body: "Something went wrong while talking to the sign-in provider. Please try again in a moment.",
};

async function ErrorMessage({ searchParams }: Pick<PageProps<"/auth/error">, "searchParams">) {
  const params = await searchParams;
  const raw = Array.isArray(params.error) ? params.error[0] : params.error;
  const code = (raw ?? "").toLowerCase();
  const message = MESSAGES[code] ?? (code.includes("banned") ? MESSAGES.banned : FALLBACK);
  return (
    <>
      <h1 className="type-display-lg mt-4">{message.title}</h1>
      <GoldRule align="start" className="mt-6" />
      <p className="type-body mt-6 text-muted-foreground">{message.body}</p>
    </>
  );
}

export default function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  return (
    <div>
      <p className="type-eyebrow text-gold-text">Sign-in</p>
      <Suspense fallback={<h1 className="type-display-lg mt-4">{FALLBACK.title}</h1>}>
        <ErrorMessage searchParams={searchParams} />
      </Suspense>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          Try again
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
