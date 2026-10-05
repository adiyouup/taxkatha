import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SealRings } from "@/components/brand/motif";
import { buttonVariants } from "@/components/ui/button";
import { enabledProviders } from "@/server/auth/options";

/**
 * Shown to anonymous visitors in place of member-only content. It renders no
 * part of the gated text — only placeholder bars — so nothing can be read
 * from the page source.
 */
export function SignInGate({
  next,
  title = "Read the full analysis",
  description = "The background, the issue before the court and the reasoning behind the decision are free for members — along with the professional discussion on this ruling.",
  sections = ["Background and issue", "Decision"],
}: {
  next: string;
  title?: string;
  description?: string;
  sections?: string[];
}) {
  const providers = enabledProviders();

  return (
    <div>
      <div aria-hidden className="relative select-none">
        {sections.map((section, index) => (
          <div key={section} className={index === 0 ? "" : "mt-9"}>
            <p className="type-display-sm text-foreground/60">{section}</p>
            <div className="mt-4 space-y-3">
              {[96, 100, 88, 94, 72].slice(0, index === 0 ? 5 : 3).map((width, i) => (
                <div key={i} className="h-3 rounded-full bg-navy-900/8" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-b from-transparent to-background" />
      </div>

      <section
        aria-labelledby="gate-title"
        className="theme-navy grain relative -mt-6 overflow-hidden rounded-2xl border border-gold-500/30 p-6 shadow-lift sm:p-9"
      >
        <SealRings className="pointer-events-none absolute -top-24 -right-24 w-80 opacity-50" />
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center">
          <div>
            <p className="type-eyebrow flex items-center gap-2 text-gold-500">
              <LockKeyhole strokeWidth={1.75} className="size-3.5" /> Members
            </p>
            <h2 id="gate-title" className="type-display-md mt-4 text-paper">
              {title}
            </h2>
            <p className="type-small mt-4 max-w-md text-muted-foreground">{description}</p>
            <p className="type-caption mt-5 text-paper/70">Free to join. No card required.</p>
          </div>
          <div>
            {providers.length > 0 ? (
              <OAuthButtons providers={providers} next={next} />
            ) : (
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className={buttonVariants({ size: "xl", className: "w-full" })}>
                Sign in to continue
              </Link>
            )}
            <p className="type-caption mt-4 text-center text-muted-foreground">
              Already a member?{" "}
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-gold-400 underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
