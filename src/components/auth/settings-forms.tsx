"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { GoogleIcon, LinkedInIcon, MicrosoftIcon } from "@/components/auth/provider-icons";
import type { ProviderId } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { PROFESSIONS } from "@/lib/professions";
import { deleteAccount, updateProfile, type ProfileState } from "@/server/actions/account";

const initial: ProfileState = { error: null, saved: false };

export function ProfileForm({ profession, headline, marketingOptIn }: { profession: string | null; headline: string | null; marketingOptIn: boolean }) {
  const [state, formAction, pending] = useActionState(updateProfile, initial);

  useEffect(() => {
    if (state.saved) toast.success("Profile saved.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-7">
      <div className="space-y-2">
        <Label htmlFor="profession">Profession</Label>
        <select id="profession" name="profession" defaultValue={profession ?? ""} required className="select-chevron h-11 w-full rounded-md border border-input bg-card pl-3.5 text-[0.9375rem] hover:border-navy-300">
          <option value="" disabled>
            Choose…
          </option>
          {PROFESSIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="type-caption text-muted-foreground">Shown as a badge next to your name in discussions.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="headline">
          Headline <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="headline" name="headline" maxLength={80} defaultValue={headline ?? ""} placeholder="e.g. Partner, Indirect Tax · Mumbai" />
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="marketingOptIn" defaultChecked={marketingOptIn} className="mt-1 size-4 accent-(--color-gold-700)" />
        <span className="type-small text-muted-foreground">Email me TaxKatha&apos;s weekly digest of notable rulings.</span>
      </label>

      {state.error ? (
        <p role="alert" className="type-small rounded-md border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="navy" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save changes
      </Button>
    </form>
  );
}

const PROVIDER = {
  google: { label: "Google", Icon: GoogleIcon },
  linkedin: { label: "LinkedIn", Icon: LinkedInIcon },
  microsoft: { label: "Microsoft", Icon: MicrosoftIcon },
} as const;

export function ConnectedAccounts({ available, linked }: { available: ProviderId[]; linked: string[] }) {
  const [pending, setPending] = useState<ProviderId | null>(null);

  async function link(provider: ProviderId) {
    setPending(provider);
    const { error } = await authClient.linkSocial({ provider, callbackURL: "/settings" });
    if (error) {
      toast.error(error.message ?? "This account could not be connected.");
      setPending(null);
    }
  }

  return (
    <ul className="divide-y">
      {(Object.keys(PROVIDER) as ProviderId[]).map((id) => {
        const { label, Icon } = PROVIDER[id];
        const isLinked = linked.includes(id);
        return (
          <li key={id} className="flex items-center justify-between gap-4 py-3.5">
            <span className="flex items-center gap-3 text-[0.9375rem] font-medium text-foreground">
              <Icon className="size-5" /> {label}
            </span>
            {isLinked ? (
              <span className="type-caption flex items-center gap-1.5 font-semibold text-gold-text">
                <Check className="size-3.5" /> Connected
              </span>
            ) : available.includes(id) ? (
              <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => link(id)}>
                {pending === id ? <Loader2 className="animate-spin" /> : null}
                Connect
              </Button>
            ) : (
              <span className="type-caption text-muted-foreground">Not available</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>Delete my account</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This permanently removes your profile, likes, saved rulings and notifications. Your comments are erased. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteAccount} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
            <Input id="confirm-delete" name="confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" variant="destructive" className="w-full" disabled={confirm.trim().toUpperCase() !== "DELETE"}>
            Permanently delete my account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
