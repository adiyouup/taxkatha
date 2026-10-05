"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFESSIONS } from "@/lib/professions";
import { completeOnboarding, type OnboardingState } from "@/server/actions/onboarding";

const initial: OnboardingState = { error: null };

export function OnboardingForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(completeOnboarding, initial);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="next" value={next} />

      <fieldset>
        <legend className="text-sm font-semibold text-foreground">What best describes you?</legend>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROFESSIONS.map((p) => (
            <label
              key={p.value}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-input bg-card px-3.5 py-3 text-[0.9375rem] transition-colors hover:border-navy-300 has-checked:border-gold-600 has-checked:bg-gold-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input type="radio" name="profession" value={p.value} required className="peer sr-only" />
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input peer-checked:border-gold-700 peer-checked:[&>span]:scale-100">
                <span className="size-2 scale-0 rounded-full bg-gold-700 transition-transform" />
              </span>
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="headline">
          Headline <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="headline" name="headline" maxLength={80} placeholder="e.g. Partner, Indirect Tax · Mumbai" />
        <p className="type-caption text-muted-foreground">Shown next to your name in discussions.</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="marketingOptIn"
          className="mt-1 size-4 rounded-xs border-input accent-(--color-gold-700)"
        />
        <span className="type-small text-muted-foreground">
          Email me TaxKatha&apos;s weekly digest of notable rulings. You can unsubscribe at any time.
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="type-small rounded-md border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Continue
        {pending ? null : <ArrowRight strokeWidth={1.75} />}
      </Button>
    </form>
  );
}
