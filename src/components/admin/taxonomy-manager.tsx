"use client";

import { useRef, useState, useTransition } from "react";
import { Check, GitMerge, Loader2, PenLine, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber, pluralize } from "@/lib/format";
import { COURT_TYPE_LABEL, type CourtType } from "@/lib/labels";
import { addTopicAlias, deleteTopic, mergeCourt, mergeTopic, removeTopicAlias, saveCourt, saveTopic } from "@/server/actions/taxonomy";
import type { AdminCourt, AdminTopic } from "@/server/queries/admin-taxonomy";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const select = "select-chevron h-10 w-full rounded-md border border-input bg-card pr-9 pl-3 text-sm hover:border-navy-300";

/* --------------------------------- Topics --------------------------------- */

function TopicDialog({ topic, open, onOpenChange }: { topic: AdminTopic | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState(topic?.name ?? "");
  const [slug, setSlug] = useState(topic?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(topic));
  const [description, setDescription] = useState(topic?.description ?? "");
  const [reviewed, setReviewed] = useState(topic?.reviewed ?? true);
  const [alias, setAlias] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await saveTopic({ id: topic?.id ?? null, name, slug, description, reviewed });
              if (!result.ok) return void toast.error(result.error);
              toast.success(topic ? "Topic saved." : "Topic added.");
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{topic ? "Edit topic" : "New topic"}</DialogTitle>
            <DialogDescription>Topics group rulings in the directory and have their own page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Name</Label>
              <Input
                id="topic-name"
                value={name}
                maxLength={80}
                required
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugEdited) setSlug(slugify(event.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-slug">Web address</Label>
              <Input
                id="topic-slug"
                value={slug}
                maxLength={80}
                required
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(slugify(event.target.value));
                }}
                className="font-mono text-sm"
              />
              <p className="type-caption text-muted-foreground">/topics/{slug || "…"}{topic && topic.slug !== slug ? " — links to the old address will stop working" : ""}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-description">Description</Label>
              <Textarea id="topic-description" value={description} maxLength={300} rows={3} onChange={(event) => setDescription(event.target.value)} />
              <p className="type-caption text-muted-foreground">One or two sentences for the topic page and search engines.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1 size-4 accent-(--color-gold-700)" />
              <span>
                <span className="block text-sm font-semibold">Show to visitors</span>
                <span className="type-caption block text-muted-foreground">Unreviewed topics are kept out of the public directory.</span>
              </span>
            </label>

            {topic ? (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">Spreadsheet labels</p>
                <p className="type-caption text-muted-foreground">Rows whose background starts with one of these labels are filed under this topic.</p>
                {topic.aliases.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {topic.aliases.map((key) => (
                      <li key={key} className="inline-flex items-center gap-1 rounded-xs border bg-muted/50 py-0.5 pr-1 pl-2 font-mono text-xs">
                        {key}
                        <button
                          type="button"
                          aria-label={`Remove the label ${key}`}
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await removeTopicAlias(key);
                              if (!result.ok) toast.error(result.error);
                            })
                          }
                          className="rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex gap-2">
                  <Input value={alias} maxLength={80} placeholder="e.g. IInterest" aria-label="New spreadsheet label" onChange={(event) => setAlias(event.target.value)} className="h-9" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || alias.trim().length < 2}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await addTopicAlias({ topicId: topic.id, label: alias });
                        if (!result.ok) return void toast.error(result.error);
                        setAlias("");
                      })
                    }
                  >
                    Add label
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {topic ? "Save topic" : "Add topic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog<T extends { id: string; name: string }>({
  kind,
  source,
  options,
  open,
  onOpenChange,
  onMerge,
}: {
  kind: "topic" | "court";
  source: T & { count: number };
  options: T[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerge: (targetId: string) => Promise<boolean>;
}) {
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  const noun = kind === "topic" ? "posts" : "rulings";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              if (await onMerge(target)) onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Merge “{source.name}”</DialogTitle>
            <DialogDescription>
              Its {pluralize(source.count, kind === "topic" ? "post" : "ruling")} move to the {kind} you choose, and “{source.name}” is removed. Future imports that
              use it land in the {kind} you choose too.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`merge-${kind}`}>Merge into</Label>
            <select id={`merge-${kind}`} required value={target} onChange={(event) => setTarget(event.target.value)} className={select}>
              <option value="" disabled>
                Choose a {kind}…
              </option>
              {options
                .filter((option) => option.id !== source.id)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy" disabled={pending || !target}>
              {pending ? <Loader2 className="animate-spin" /> : <GitMerge />}
              Merge {noun}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TopicPanel = { kind: "edit"; topic: AdminTopic | null } | { kind: "merge"; topic: AdminTopic } | { kind: "delete"; topic: AdminTopic };

export function TopicManager({ topics }: { topics: AdminTopic[] }) {
  const [panel, setPanel] = useState<(TopicPanel & { nonce: number }) | null>(null);
  const [pending, startTransition] = useTransition();
  const opened = useRef(0);
  const open = (next: TopicPanel) => {
    opened.current += 1;
    setPanel({ ...next, nonce: opened.current });
  };
  const close = () => setPanel(null);
  const unreviewed = topics.filter((t) => !t.reviewed);
  const reviewed = topics.filter((t) => t.reviewed);

  const actions = (topic: AdminTopic, merge = true) => (
    <div className="flex items-center justify-end gap-1">
      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${topic.name}`} onClick={() => open({ kind: "edit", topic })}>
        <PenLine />
      </Button>
      {merge ? (
        <Button size="icon-sm" variant="ghost" aria-label={`Merge ${topic.name} into another topic`} onClick={() => open({ kind: "merge", topic })}>
          <GitMerge />
        </Button>
      ) : null}
      {topic.posts === 0 ? (
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${topic.name}`} onClick={() => open({ kind: "delete", topic })}>
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => open({ kind: "edit", topic: null })}>
          <Plus strokeWidth={1.75} /> New topic
        </Button>
      </div>

      {unreviewed.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-gold-600/40 bg-gold-50/60 shadow-soft">
          <div className="border-b border-gold-600/25 px-5 py-4 sm:px-6">
            <h2 className="font-display text-lg font-semibold">Needs review</h2>
            <p className="type-caption mt-1 text-muted-foreground">
              Imports created these from labels they did not recognise. Approve a topic to list it publicly, or merge it into an existing one.
            </p>
          </div>
          <ul className="divide-y divide-gold-600/20">
            {unreviewed.map((topic) => (
              <li key={topic.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div className="min-w-0">
                  <p className="font-semibold">{topic.name}</p>
                  <p className="type-caption text-muted-foreground">{pluralize(topic.posts, "post")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="navy"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await saveTopic({ id: topic.id, name: topic.name, slug: topic.slug, description: topic.description ?? "", reviewed: true });
                        if (!result.ok) return void toast.error(result.error);
                        toast.success(`“${topic.name}” is now listed.`);
                      })
                    }
                  >
                    <Check /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => open({ kind: "merge", topic })}>
                    <GitMerge /> Merge…
                  </Button>
                  {actions(topic, false)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="type-caption px-5 py-3 font-semibold text-muted-foreground sm:px-6">
                  Topic
                </th>
                <th scope="col" className="type-caption py-3 pr-4 text-right font-semibold text-muted-foreground">
                  Published
                </th>
                <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                  Spreadsheet labels
                </th>
                <th scope="col" className="py-3 pr-5 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((topic) => (
                <tr key={topic.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 sm:px-6">
                    <p className="font-semibold">{topic.name}</p>
                    <p className="type-caption font-mono text-muted-foreground">/topics/{topic.slug}</p>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(topic.published)}
                    {topic.posts > topic.published ? <span className="text-muted-foreground"> / {formatNumber(topic.posts)}</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{topic.aliases.length > 0 ? pluralize(topic.aliases.length, "label") : "—"}</td>
                  <td className="py-3 pr-5 sm:pr-6">{actions(topic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {panel?.kind === "edit" ? (
        <TopicDialog
          key={panel.nonce}
          // The live row, so labels added in the dialog appear as soon as they are saved.
          topic={panel.topic ? (topics.find((t) => t.id === panel.topic!.id) ?? panel.topic) : null}
          open
          onOpenChange={(o) => !o && close()}
        />
      ) : null}
      {panel?.kind === "merge" ? (
        <MergeDialog
          key={panel.nonce}
          kind="topic"
          source={{ ...panel.topic, count: panel.topic.posts }}
          options={topics}
          open
          onOpenChange={(o) => !o && close()}
          onMerge={async (targetId) => {
            const result = await mergeTopic({ sourceId: panel.topic.id, targetId });
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            toast.success(`Merged. ${pluralize(result.data.moved, "post")} moved.`);
            return true;
          }}
        />
      ) : null}
      {panel?.kind === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Delete “${panel.topic.name}”?`}
          description="No posts use this topic. Its spreadsheet labels are removed too."
          confirmLabel="Delete topic"
          destructive
          pending={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteTopic(panel.topic.id);
              if (!result.ok) return void toast.error(result.error);
              toast.success("Topic deleted.");
              close();
            })
          }
        />
      ) : null}
    </div>
  );
}

/* --------------------------------- Courts --------------------------------- */

function CourtDialog({ court, open, onOpenChange }: { court: AdminCourt; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({
    name: court.name,
    shortName: court.shortName,
    type: court.type,
    location: court.location ?? "",
    slug: court.slug,
    description: court.description ?? "",
  });
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await saveCourt({ id: court.id, ...form });
              if (!result.ok) return void toast.error(result.error);
              toast.success("Court saved.");
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit court</DialogTitle>
            <DialogDescription>Shown on rulings, in the directory filters and on the court’s own page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="court-name">Full name</Label>
              <Input id="court-name" value={form.name} maxLength={160} required onChange={(event) => set("name", event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="court-short">Short name</Label>
                <Input id="court-short" value={form.shortName} maxLength={60} required onChange={(event) => set("shortName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="court-location">Seat or bench</Label>
                <Input id="court-location" value={form.location} maxLength={80} onChange={(event) => set("location", event.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="court-type">Type</Label>
                <select id="court-type" value={form.type} onChange={(event) => set("type", event.target.value)} className={select}>
                  {(Object.keys(COURT_TYPE_LABEL) as CourtType[]).map((type) => (
                    <option key={type} value={type}>
                      {COURT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="court-slug">Web address</Label>
                <Input id="court-slug" value={form.slug} maxLength={80} required onChange={(event) => set("slug", slugify(event.target.value))} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="court-description">Introduction</Label>
              <Textarea id="court-description" value={form.description} maxLength={600} rows={3} onChange={(event) => set("description", event.target.value)} />
              <p className="type-caption text-muted-foreground">Shown at the top of /courts/{form.slug} and used by search engines.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save court
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CourtManager({ courts }: { courts: AdminCourt[] }) {
  const [panel, setPanel] = useState<{ kind: "edit" | "merge"; court: AdminCourt; nonce: number } | null>(null);
  const opened = useRef(0);
  const open = (kind: "edit" | "merge", court: AdminCourt) => {
    opened.current += 1;
    setPanel({ kind, court, nonce: opened.current });
  };
  const close = () => setPanel(null);

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="type-caption px-5 py-3 font-semibold text-muted-foreground sm:px-6">
                Court or authority
              </th>
              <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                Type
              </th>
              <th scope="col" className="type-caption py-3 pr-4 text-right font-semibold text-muted-foreground">
                Rulings
              </th>
              <th scope="col" className="py-3 pr-5 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {courts.map((court) => (
              <tr key={court.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-5 py-3 sm:px-6">
                  <p className="font-semibold">{court.name}</p>
                  <p className="type-caption text-muted-foreground">
                    {court.shortName}
                    {court.aliases.length > 0 ? ` · also matches ${pluralize(court.aliases.length, "merged name")}` : ""}
                    {court.description ? "" : " · no introduction"}
                  </p>
                </td>
                <td className="py-3 pr-4">
                  <Badge variant="secondary">{COURT_TYPE_LABEL[court.type]}</Badge>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatNumber(court.rulings)}</td>
                <td className="py-3 pr-5 sm:pr-6">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${court.name}`} onClick={() => open("edit", court)}>
                      <PenLine />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Merge ${court.name} into another court`}
                      onClick={() => open("merge", court)}
                    >
                      <GitMerge />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {panel?.kind === "edit" ? <CourtDialog key={panel.nonce} court={panel.court} open onOpenChange={(o) => !o && close()} /> : null}
      {panel?.kind === "merge" ? (
        <MergeDialog
          key={panel.nonce}
          kind="court"
          source={{ ...panel.court, count: panel.court.rulings }}
          options={courts}
          open
          onOpenChange={(o) => !o && close()}
          onMerge={async (targetId) => {
            const result = await mergeCourt({ sourceId: panel.court.id, targetId });
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            toast.success(`Merged. ${pluralize(result.data.moved, "ruling")} moved.`);
            return true;
          }}
        />
      ) : null}
    </section>
  );
}
