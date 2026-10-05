"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COURT_TYPE_LABEL, DOMAIN_LABEL, type CourtType, type OutcomeSide, type TaxDomain } from "@/lib/labels";
import { splitPoints } from "@/lib/legal-text";
import { bulkPostAction, saveCaseLaw } from "@/server/actions/admin-posts";

export type CaseDraft = {
  id: string | null;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  courtId: string;
  bench: string;
  decisionDate: string;
  caseNumber: string;
  relevantSections: string;
  sectionRefs: string[];
  excerpt: string;
  background: string;
  decision: string;
  outcomeSide: OutcomeSide;
  remanded: boolean;
  topicId: string | null;
  domain: TaxDomain;
  domainLabel: string;
  locked: boolean;
};

/** Stored text is clauses joined by " - "; the editor shows one clause per line. */
const toLines = (text: string) => splitPoints(text).join("\n");
const fromLines = (lines: string) =>
  lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" - ");

const OUTCOME_OPTIONS: { value: OutcomeSide; label: string }[] = [
  { value: "assessee", label: "In favour of the assessee" },
  { value: "revenue", label: "In favour of the revenue" },
  { value: "partly", label: "Partly in favour of the assessee" },
  { value: "unknown", label: "Not stated / see decision" },
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-soft">
      <h2 className="type-eyebrow border-b px-5 py-3.5 text-[0.6875rem] text-gold-text">{title}</h2>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

const field = "select-chevron h-10 w-full rounded-md border border-input bg-card pl-3 pr-9 text-sm hover:border-navy-300";

export function CaseEditor({
  initial,
  courts,
  topics,
}: {
  initial: CaseDraft;
  courts: { id: string; name: string; shortName: string; type: CourtType }[];
  topics: { id: string; name: string; reviewed: boolean }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [lines, setLines] = useState(() => ({ background: toLines(initial.background), decision: toLines(initial.decision) }));
  // What the point editors held at the last save: an untouched field is sent as "unchanged".
  const [baseline, setBaseline] = useState(lines);
  const [lockTouched, setLockTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const isNew = draft.id === null;

  /** Editing the content protects it from the next import, unless the admin has decided otherwise. */
  function edited(key?: keyof CaseDraft) {
    setDirty(true);
    if (key !== "status" && !lockTouched) setDraft((current) => (current.locked ? current : { ...current, locked: true }));
  }

  const set = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    edited(key);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save() {
    startTransition(async () => {
      const result = await saveCaseLaw({
        id: draft.id,
        title: draft.title,
        slug: draft.slug,
        status: draft.status,
        courtId: draft.courtId,
        bench: draft.bench,
        decisionDate: draft.decisionDate,
        caseNumber: draft.caseNumber,
        relevantSections: draft.relevantSections,
        excerpt: draft.excerpt,
        background: !isNew && lines.background === baseline.background ? null : fromLines(lines.background),
        decision: !isNew && lines.decision === baseline.decision ? null : fromLines(lines.decision),
        outcomeSide: draft.outcomeSide,
        remanded: draft.remanded,
        topicId: draft.topicId,
        domain: draft.domain,
        domainLabel: draft.domainLabel,
        lockFromImports: draft.locked,
      });
      if (!result.ok) return void toast.error(result.error);
      setDirty(false);
      setBaseline(lines);
      setDraft((current) => ({ ...current, id: result.data.id, slug: result.data.slug }));
      toast.success(isNew ? "Ruling added." : "Changes saved.");
      if (isNew) router.replace(`/admin/case-laws/${result.data.id}`);
    });
  }

  function remove() {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const result = await bulkPostAction({ ids: [id], action: "delete" });
      if (!result.ok) return void toast.error(result.error);
      setDirty(false);
      setConfirmDelete(false);
      toast.success("Ruling deleted.");
      router.push("/admin/case-laws");
    });
  }

  const courtGroups = new Map<CourtType, typeof courts>();
  for (const court of courts) courtGroups.set(court.type, [...(courtGroups.get(court.type) ?? []), court]);

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="min-w-0 space-y-5">
        <section className="rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <Label htmlFor="case-title" className="type-eyebrow text-[0.6875rem] text-gold-text">
            Case name
          </Label>
          <Textarea
            id="case-title"
            value={draft.title}
            rows={1}
            maxLength={400}
            required
            onChange={(event) => set("title", event.target.value.replace(/\n/g, " "))}
            placeholder="Example Traders (P.) Ltd. v. State Tax Officer"
            className="mt-2 min-h-0 resize-none border-0 bg-transparent p-0 font-display text-2xl leading-snug font-medium shadow-none focus-visible:ring-0 md:text-3xl"
          />
          <div className="mt-6 space-y-2 border-t pt-6">
            <Label htmlFor="case-excerpt">Case summary (public)</Label>
            <Textarea
              id="case-excerpt"
              value={draft.excerpt}
              rows={5}
              maxLength={8000}
              required
              onChange={(event) => set("excerpt", event.target.value)}
              className="min-h-32 text-[0.9375rem] leading-relaxed"
            />
            <p className="type-caption text-muted-foreground">The headnote. Everyone can read it, and it is used in search results and share cards.</p>
          </div>
        </section>

        <section className="space-y-6 rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="type-display-sm">Members-only analysis</h2>
            <span className="type-caption text-muted-foreground">One point per line</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="case-background">Background and issue</Label>
            <Textarea
              id="case-background"
              value={lines.background}
              rows={10}
              onChange={(event) => {
                setLines((current) => ({ ...current, background: event.target.value }));
                edited();
              }}
              className="min-h-48 text-[0.9375rem] leading-relaxed"
            />
            <p className="type-caption text-muted-foreground">
              Start with the subject labels (such as “Input tax credit”), each on its own line, then the facts.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="case-decision">Decision</Label>
            <Textarea
              id="case-decision"
              value={lines.decision}
              rows={10}
              onChange={(event) => {
                setLines((current) => ({ ...current, decision: event.target.value }));
                edited();
              }}
              className="min-h-48 text-[0.9375rem] leading-relaxed"
            />
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <Panel title="Publish">
          <div className="space-y-2">
            <Label htmlFor="case-status">Status</Label>
            <select id="case-status" value={draft.status} onChange={(event) => set("status", event.target.value as CaseDraft["status"])} className={field}>
              <option value="published">Published — visible on the site</option>
              <option value="draft">Draft — hidden</option>
              <option value="archived">Archived — hidden</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {isNew ? "Add ruling" : "Save changes"}
          </Button>
          <p className="type-caption text-center text-muted-foreground" aria-live="polite">
            {dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "All changes saved"}
          </p>
          {!isNew && initial.status === "published" ? (
            <Link
              href={`/case-laws/${draft.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-text hover:underline"
            >
              View on the site <ExternalLink className="size-3.5" />
            </Link>
          ) : null}
        </Panel>

        <Panel title="Court and date">
          <div className="space-y-2">
            <Label htmlFor="case-court">Court or authority</Label>
            <select id="case-court" value={draft.courtId} required onChange={(event) => set("courtId", event.target.value)} className={field}>
              <option value="" disabled>
                Choose…
              </option>
              {[...courtGroups].map(([type, list]) => (
                <optgroup key={type} label={COURT_TYPE_LABEL[type]}>
                  {list.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="case-date">Decided on</Label>
              <Input
                id="case-date"
                type="date"
                required
                value={draft.decisionDate}
                onChange={(event) => set("decisionDate", event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-number">Case number</Label>
              <Input id="case-number" value={draft.caseNumber} maxLength={400} onChange={(event) => set("caseNumber", event.target.value)} className="h-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="case-bench">Bench</Label>
            <Input id="case-bench" value={draft.bench} maxLength={400} onChange={(event) => set("bench", event.target.value)} className="h-10" />
          </div>
        </Panel>

        <Panel title="Outcome and subject">
          <div className="space-y-2">
            <Label htmlFor="case-outcome">Decided</Label>
            <select id="case-outcome" value={draft.outcomeSide} onChange={(event) => set("outcomeSide", event.target.value as OutcomeSide)} className={field}>
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.remanded}
              onChange={(event) => set("remanded", event.target.checked)}
              className="size-4 accent-(--color-gold-700)"
            />
            Matter remanded
          </label>
          <div className="space-y-2">
            <Label htmlFor="case-topic">Topic</Label>
            <select id="case-topic" value={draft.topicId ?? ""} onChange={(event) => set("topicId", event.target.value || null)} className={field}>
              <option value="">No topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.reviewed ? topic.name : `${topic.name} (unreviewed)`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="case-domain">Tax area</Label>
              <select id="case-domain" value={draft.domain} onChange={(event) => set("domain", event.target.value as TaxDomain)} className={field}>
                {(Object.keys(DOMAIN_LABEL) as TaxDomain[]).map((key) => (
                  <option key={key} value={key}>
                    {DOMAIN_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-domain-label">Label</Label>
              <Input
                id="case-domain-label"
                value={draft.domainLabel}
                maxLength={60}
                placeholder="GST"
                onChange={(event) => set("domainLabel", event.target.value)}
                className="h-10"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Provisions">
          <div className="space-y-2">
            <Label htmlFor="case-sections">Relevant sections</Label>
            <Textarea
              id="case-sections"
              value={draft.relevantSections}
              rows={4}
              maxLength={6000}
              onChange={(event) => set("relevantSections", event.target.value)}
              className="min-h-24 text-sm"
            />
          </div>
          {draft.sectionRefs.length > 0 ? (
            <div>
              <p className="type-caption text-muted-foreground">Section tags (updated when you save)</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {draft.sectionRefs.map((ref) => (
                  <li key={ref} className="rounded-xs border px-2 py-0.5 text-xs font-medium">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel title="Web address and imports">
          <div className="space-y-2">
            <Label htmlFor="case-slug">Web address</Label>
            <Input
              id="case-slug"
              value={draft.slug}
              maxLength={120}
              placeholder="made from the case name and date"
              onChange={(event) => set("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
              className="h-10 font-mono text-sm"
            />
            <p className="type-caption break-all text-muted-foreground">/case-laws/{draft.slug || "…"}</p>
            {!isNew ? <p className="type-caption text-muted-foreground">Changing it keeps the old address working as a redirect.</p> : null}
          </div>
          {isNew ? null : (
            <label className="flex cursor-pointer items-start gap-3 border-t pt-4">
              <input
                type="checkbox"
                checked={draft.locked}
                onChange={(event) => {
                  setLockTouched(true);
                  setDraft((current) => ({ ...current, locked: event.target.checked }));
                  setDirty(true);
                }}
                className="mt-1 size-4 accent-(--color-gold-700)"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">Protect from imports</span>
                <span className="type-caption block text-muted-foreground">
                  A later upload of the same ruling will not overwrite it. Edited rulings are protected automatically.
                </span>
              </span>
            </label>
          )}
        </Panel>

        {!isNew ? (
          <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)} disabled={pending}>
            <Trash2 strokeWidth={1.5} /> Delete ruling
          </Button>
        ) : null}
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this ruling?"
        description="Its discussion, likes and saves are deleted with it, and its page stops working. This cannot be undone. To take it off the site but keep it, set it to Draft instead."
        confirmLabel="Delete ruling"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </form>
  );
}
