"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { GoogleIcon, LinkedInIcon, MicrosoftIcon } from "@/components/auth/provider-icons";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export type ProviderId = "google" | "linkedin" | "microsoft";

const PROVIDER_META: Record<ProviderId, { label: string; Icon: (p: { className?: string }) => React.ReactNode }> = {
  google: { label: "Google", Icon: GoogleIcon },
  linkedin: { label: "LinkedIn", Icon: LinkedInIcon },
  microsoft: { label: "Microsoft", Icon: MicrosoftIcon },
};

/**
 * OAuth sign-in buttons. `next` is where the member returns after signing in;
 * brand-new members pass through /welcome first.
 */
export function OAuthButtons({
  providers,
  next,
  className,
}: {
  providers: ProviderId[];
  next: string;
  className?: string;
}) {
  const [pending, setPending] = useState<ProviderId | null>(null);

  async function signIn(provider: ProviderId) {
    setPending(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: next,
      newUserCallbackURL: `/welcome?next=${encodeURIComponent(next)}`,
      errorCallbackURL: "/auth/error",
    });
    if (error) {
      toast.error(error.message ?? "Sign-in could not be started. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {providers.map((id) => {
        const { label, Icon } = PROVIDER_META[id];
        const busy = pending === id;
        return (
          <button
            key={id}
            type="button"
            disabled={pending !== null}
            onClick={() => signIn(id)}
            className="group relative flex h-13 w-full items-center justify-center gap-3 rounded-md border border-input bg-card px-5 text-[0.9375rem] font-semibold text-foreground shadow-soft transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:-translate-y-px hover:border-gold-600 hover:shadow-lift disabled:pointer-events-none disabled:opacity-60 dark:bg-white dark:text-navy-900"
          >
            <span className="absolute left-5 flex size-5 items-center justify-center">
              {busy ? <Loader2 className="size-5 animate-spin text-gold-700" /> : <Icon className="size-5" />}
            </span>
            Continue with {label}
          </button>
        );
      })}
    </div>
  );
}
