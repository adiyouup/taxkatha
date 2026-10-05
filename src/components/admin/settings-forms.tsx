"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { SettingsSection, SiteSettings } from "@/lib/site-settings";
import { saveSettings, type SettingsFormState } from "@/server/actions/settings";

const initial: SettingsFormState = { error: null, field: null, savedAt: null };

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: React.ReactNode;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`setting-${name}`}>{label}</Label>
      {children}
      {error ? (
        <p id={`setting-${name}-error`} role="alert" className="type-caption text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="type-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** One settings section as its own form: validated on the server, saved on its own. */
export function SettingsForm<S extends SettingsSection>({
  section,
  values,
  updated,
}: {
  section: S;
  values: SiteSettings[S];
  updated: { at: string; by: string | null } | null;
}) {
  const [state, action, pending] = useActionState(saveSettings.bind(null, section), initial);
  const shown = useRef<number | null>(null);
  // The fields are uncontrolled: they keep what was typed, so their defaults stay the values the form opened with.
  const [defaults] = useState(values);

  useEffect(() => {
    if (state.savedAt && shown.current !== state.savedAt) {
      shown.current = state.savedAt;
      toast.success("Saved. The site shows the change now.");
    }
  }, [state.savedAt]);

  const err = (name: string) => (state.field === name ? state.error : null);
  const input = (name: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={`setting-${name}`} name={name} aria-invalid={err(name) ? true : undefined} aria-describedby={err(name) ? `setting-${name}-error` : undefined} {...props} />
  );

  let fields: React.ReactNode;
  switch (section) {
    case "announcement": {
      const v = defaults as SiteSettings["announcement"];
      fields = (
        <>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="enabled" defaultChecked={v.enabled} className="mt-1 size-4 accent-(--color-gold-700)" />
            <span>
              <span className="block text-sm font-semibold">Show the announcement bar</span>
              <span className="type-caption block text-muted-foreground">A thin bar above the header on every public page.</span>
            </span>
          </label>
          <Field name="text" label="Message" error={err("text")} hint="Up to 140 characters. Keep it to one sentence.">
            {input("text", { defaultValue: v.text, maxLength: 140, placeholder: "New: Budget 2026 changes to GST appeals, explained" })}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Field name="linkLabel" label="Link text" error={err("linkLabel")}>
              {input("linkLabel", { defaultValue: v.linkLabel, maxLength: 40, placeholder: "Read the insight" })}
            </Field>
            <Field name="href" label="Link" error={err("href")} hint="A page on this site (/insights/…) or a full https:// address.">
              {input("href", { defaultValue: v.href, maxLength: 300, placeholder: "/insights/…" })}
            </Field>
          </div>
        </>
      );
      break;
    }
    case "hero": {
      const v = defaults as SiteSettings["hero"];
      fields = (
        <>
          <Field name="eyebrow" label="Line above the headline" error={err("eyebrow")}>
            {input("eyebrow", { defaultValue: v.eyebrow, maxLength: 60 })}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="headline" label="Headline" error={err("headline")}>
              {input("headline", { defaultValue: v.headline, maxLength: 80, required: true })}
            </Field>
            <Field name="accent" label="Gold phrase after it" error={err("accent")} hint="Set in italic gold. Optional.">
              {input("accent", { defaultValue: v.accent, maxLength: 60 })}
            </Field>
          </div>
          <Field name="lede" label="Introduction" error={err("lede")} hint="40–280 characters.">
            <Textarea id="setting-lede" name="lede" defaultValue={v.lede} maxLength={280} rows={3} required aria-invalid={err("lede") ? true : undefined} />
          </Field>
        </>
      );
      break;
    }
    case "seo": {
      const v = defaults as SiteSettings["seo"];
      fields = (
        <>
          <Field name="title" label="Home page title" error={err("title")} hint="Shown in search results and browser tabs. Up to 70 characters.">
            {input("title", { defaultValue: v.title, maxLength: 70, required: true })}
          </Field>
          <Field name="description" label="Description" error={err("description")} hint="The snippet under the title in search results and link previews. 50–170 characters.">
            <Textarea id="setting-description" name="description" defaultValue={v.description} maxLength={170} rows={3} required aria-invalid={err("description") ? true : undefined} />
          </Field>
        </>
      );
      break;
    }
    case "social": {
      const v = defaults as SiteSettings["social"];
      fields = (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["linkedin", "x", "instagram", "youtube"] as const).map((key) => (
            <Field key={key} name={key} label={{ linkedin: "LinkedIn", x: "X (Twitter)", instagram: "Instagram", youtube: "YouTube" }[key]} error={err(key)}>
              {input(key, { defaultValue: v[key], maxLength: 300, placeholder: "https://", inputMode: "url" })}
            </Field>
          ))}
          <p className="type-caption text-muted-foreground sm:col-span-2">Shown in the footer. Leave a field empty to hide that icon.</p>
        </div>
      );
      break;
    }
    case "community": {
      const v = defaults as SiteSettings["community"];
      fields = (
        <Field
          name="blockedWords"
          label="Blocked words and phrases"
          error={err("blockedWords")}
          hint="One per line. Comments containing any of them as a whole word are refused, and the member is asked to rephrase."
        >
          <Textarea id="setting-blockedWords" name="blockedWords" defaultValue={v.blockedWords.join("\n")} rows={6} className="font-mono text-sm" />
        </Field>
      );
      break;
    }
  }

  return (
    <form action={action} className="space-y-5">
      {fields}
      {state.error && !state.field ? (
        <p role="alert" className="type-small rounded-md border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="type-caption text-muted-foreground">{updated ? `Last changed ${formatDateTime(updated.at)}${updated.by ? ` by ${updated.by}` : ""}` : "Using the defaults"}</p>
        <Button type="submit" variant="navy" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}
