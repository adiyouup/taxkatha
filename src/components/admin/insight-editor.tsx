"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { NodeSelection } from "@tiptap/pm/state";
import { EditorContent, mergeAttributes, Node, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  ExternalLink,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Scale,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PostPicker } from "@/components/admin/post-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { DOMAIN_LABEL, type TaxDomain } from "@/lib/labels";
import { isSafeHref, type RichDoc } from "@/lib/rich-text/schema";
import { cn } from "@/lib/utils";
import { deleteInsight, saveInsight } from "@/server/actions/insights";

/** A ruling embedded in an article. Rendered as a full case card on the public page. */
const CaseEmbed = Node.create({
  name: "caseEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { slug: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-case-embed]", getAttrs: (element) => ({ slug: (element as HTMLElement).getAttribute("data-case-embed") ?? "" }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-case-embed": node.attrs.slug }), String(node.attrs.slug)];
  },
});

export type InsightDraft = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: RichDoc;
  coverImageUrl: string | null;
  coverImageAlt: string;
  topicId: string | null;
  domain: TaxDomain;
  seoTitle: string;
  seoDescription: string;
  membersOnly: boolean;
  status: "draft" | "scheduled" | "published" | "archived";
  publishedAt: string | null;
};

/**
 * Inserts an image or an embedded ruling followed by an empty paragraph, so the
 * cursor lands after the block. If another block is selected, the new one goes
 * after it instead of replacing it.
 */
function insertBlock(editor: Editor, node: JSONContent) {
  const { selection } = editor.state;
  const content = [node, { type: "paragraph" }];
  if (selection instanceof NodeSelection) editor.chain().focus().insertContentAt(selection.to, content).run();
  else editor.chain().focus().insertContent(content).run();
}

async function upload(file: File): Promise<string | null> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) {
    toast.error(data.error ?? "The image could not be uploaded.");
    return null;
  }
  return data.url;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the selection in the editor when a toolbar button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-navy-900 text-gold-400 hover:bg-navy-900 hover:text-gold-400",
      )}
    >
      {children}
    </button>
  );
}

type ToolbarPanel =
  | { kind: "link"; href: string; needsText: boolean; existing: boolean }
  | { kind: "image"; url: string }
  | { kind: "embed" };

function LinkForm({ panel, onApply, onRemove, onCancel }: { panel: Extract<ToolbarPanel, { kind: "link" }>; onApply: (href: string, text: string) => void; onRemove: () => void; onCancel: () => void }) {
  const [href, setHref] = useState(panel.href);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        const target = href.trim();
        if (!isSafeHref(target)) return setError("Use a web address (https://…), an email link (mailto:) or a path on this site (/case-laws/…).");
        onApply(target, text.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>{panel.existing ? "Edit link" : "Add a link"}</DialogTitle>
        <DialogDescription>{panel.needsText ? "Nothing is selected, so the link is inserted with the text below." : "The selected text becomes the link."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="link-href">Link address</Label>
          <Input
            id="link-href"
            value={href}
            placeholder="https://"
            inputMode="url"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "link-error" : undefined}
            onChange={(event) => {
              setHref(event.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p id="link-error" role="alert" className="type-caption text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        {panel.needsText ? (
          <div className="space-y-2">
            <Label htmlFor="link-text">Text to show</Label>
            <Input id="link-text" value={text} placeholder="Uses the address" maxLength={200} onChange={(event) => setText(event.target.value)} />
          </div>
        ) : null}
      </div>
      <DialogFooter>
        {panel.existing ? (
          <Button type="button" variant="ghost" className="sm:mr-auto" onClick={onRemove}>
            Remove link
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="navy">
          {panel.existing ? "Update link" : "Add link"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ImageForm({ url, onInsert, onCancel }: { url: string; onInsert: (alt: string) => void; onCancel: () => void }) {
  const [alt, setAlt] = useState("");
  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        onInsert(alt.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>Describe the image</DialogTitle>
        <DialogDescription>Readers using a screen reader hear this instead of seeing the picture.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image */}
        <img src={url} alt="" className="max-h-48 w-full rounded-lg border bg-muted object-contain" />
        <div className="space-y-2">
          <Label htmlFor="image-alt">Alt text</Label>
          <Input id="image-alt" value={alt} maxLength={200} placeholder="e.g. Chart of GST demands set aside, by year" onChange={(event) => setAlt(event.target.value)} />
          <p className="type-caption text-muted-foreground">Leave empty only if the image is purely decorative.</p>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="navy">
          Insert image
        </Button>
      </DialogFooter>
    </form>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<(ToolbarPanel & { nonce: number }) | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const nonce = useRef(0);
  const used = useRef(0);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function show(next: ToolbarPanel) {
    nonce.current += 1;
    setPanel({ ...next, nonce: nonce.current });
    setOpen(true);
  }

  /**
   * Runs a dialog's result once and closes it. The dialog stays on screen for a
   * moment while it fades out, and a second click or key press in that moment
   * must not insert the same thing again.
   */
  function finish(action: () => void) {
    if (!panel || used.current === panel.nonce) return;
    used.current = panel.nonce;
    action();
    setOpen(false);
  }

  function openLink() {
    const current = editor.getAttributes("link").href as string | undefined;
    const { from, to } = editor.state.selection;
    // No text selected (a bare cursor, or an image): the link brings its own text.
    show({ kind: "link", href: current ?? "", existing: Boolean(current), needsText: !current && editor.state.doc.textBetween(from, to).length === 0 });
  }

  function applyLink(href: string, text: string) {
    if (panel?.kind !== "link") return;
    const { needsText } = panel;
    finish(() => {
      if (!needsText) return void editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      const { selection } = editor.state;
      const linked = { type: "text", text: text || href, marks: [{ type: "link", attrs: { href } }] };
      if (selection instanceof NodeSelection) editor.chain().focus().insertContentAt(selection.to, { type: "paragraph", content: [linked] }).run();
      else editor.chain().focus().insertContent(linked).unsetMark("link").run();
    });
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const url = await upload(file);
    setUploading(false);
    if (url) show({ kind: "image", url });
  }

  const icon = { strokeWidth: 1.75, className: "size-4" } as const;

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 px-3 py-2 backdrop-blur">
      <ToolbarButton label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Sub-heading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 {...icon} />
      </ToolbarButton>
      <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
      <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Link" active={state.link} onClick={openLink}>
        <Link2 {...icon} />
      </ToolbarButton>
      <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
      <ToolbarButton label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote {...icon} />
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus {...icon} />
      </ToolbarButton>
      <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
      <ToolbarButton label="Insert image" disabled={uploading} onClick={() => imageInput.current?.click()}>
        {uploading ? <Loader2 {...icon} className="size-4 animate-spin" /> : <ImagePlus {...icon} />}
      </ToolbarButton>
      <ToolbarButton label="Embed a ruling" onClick={() => show({ kind: "embed" })}>
        <Scale {...icon} />
      </ToolbarButton>
      <span className="ml-auto flex items-center gap-0.5">
        <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 {...icon} />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 {...icon} />
        </ToolbarButton>
      </span>
      <input
        ref={imageInput}
        type="file"
        aria-label="Image file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void pickImage(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className={panel?.kind === "embed" ? "sm:max-w-lg" : undefined}>
          {panel?.kind === "link" ? (
            <LinkForm
              key={panel.nonce}
              panel={panel}
              onApply={applyLink}
              onCancel={() => setOpen(false)}
              onRemove={() => finish(() => editor.chain().focus().extendMarkRange("link").unsetLink().run())}
            />
          ) : panel?.kind === "image" ? (
            <ImageForm
              key={panel.nonce}
              url={panel.url}
              onCancel={() => setOpen(false)}
              onInsert={(alt) => finish(() => insertBlock(editor, { type: "image", attrs: { src: panel.url, alt } }))}
            />
          ) : panel?.kind === "embed" ? (
            <>
              <DialogHeader>
                <DialogTitle>Embed a ruling</DialogTitle>
                <DialogDescription>Readers see it as a case card that links to the full ruling.</DialogDescription>
              </DialogHeader>
              <PostPicker
                key={panel.nonce}
                type="case_law"
                label="Find a ruling"
                onPick={(post) =>
                  finish(() => {
                    insertBlock(editor, { type: "caseEmbed", attrs: { slug: post.slug } });
                    toast.success(`Embedded: ${post.title}`);
                  })
                }
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-soft">
      <h2 className="type-eyebrow border-b px-5 py-3.5 text-[0.6875rem] text-gold-text">{title}</h2>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

const STATUS_LABEL = { draft: "Draft", scheduled: "Scheduled", published: "Published", archived: "Archived" } as const;

export function InsightEditor({ initial, topics }: { initial: InsightDraft; topics: { id: string; name: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
      Image,
      CaseEmbed,
      Placeholder.configure({ placeholder: "Write the analysis. Use the scale icon to embed a ruling." }),
    ],
    content: initial.body,
    onUpdate: () => setDirty(true),
  });

  const set = <K extends keyof InsightDraft>(key: K, value: InsightDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save(intent: "draft" | "publish" | "schedule") {
    if (!editor) return;
    // ProseMirror builds node attributes as prototype-less objects, which a Server
    // Action cannot receive as data. A JSON round trip makes them plain objects.
    const body = JSON.parse(JSON.stringify(editor.getJSON())) as RichDoc;
    startTransition(async () => {
      const result = await saveInsight({
        id: draft.id,
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        body,
        coverImageUrl: draft.coverImageUrl,
        coverImageAlt: draft.coverImageAlt,
        topicId: draft.topicId,
        domain: draft.domain,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        membersOnly: draft.membersOnly,
        intent,
        publishAt: intent === "schedule" && scheduleAt ? new Date(scheduleAt).toISOString() : null,
      });
      if (!result.ok) return void toast.error(result.error);

      setDirty(false);
      setDraft((current) => ({
        ...current,
        id: result.data.id,
        slug: result.data.slug,
        status: result.data.status as InsightDraft["status"],
        publishedAt: intent === "publish" ? (current.publishedAt ?? new Date().toISOString()) : current.publishedAt,
      }));
      toast.success(intent === "publish" ? "Published." : intent === "schedule" ? "Scheduled." : "Draft saved.");
      if (!draft.id) router.replace(`/admin/insights/${result.data.id}`);
      else router.refresh();
    });
  }

  function remove() {
    const id = draft.id;
    if (!id) return;
    startTransition(async () => {
      const result = await deleteInsight(id);
      if (!result.ok) return void toast.error(result.error);
      setDirty(false);
      setConfirmDelete(false);
      toast.success("Insight deleted.");
      router.push("/admin/insights");
    });
  }

  const live = draft.status === "published";
  const field = "select-chevron h-10 w-full rounded-md border border-input bg-card pl-3 text-sm hover:border-navy-300";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        <div className="rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <label className="sr-only" htmlFor="insight-title">
            Title
          </label>
          <Textarea
            id="insight-title"
            value={draft.title}
            onChange={(event) => set("title", event.target.value.replace(/\n/g, " "))}
            placeholder="Title"
            rows={1}
            maxLength={160}
            className="min-h-0 resize-none border-0 bg-transparent p-0 font-display text-3xl leading-tight font-medium shadow-none focus-visible:ring-0 md:text-4xl"
          />
          <label className="sr-only" htmlFor="insight-excerpt">
            Standfirst
          </label>
          <Textarea
            id="insight-excerpt"
            value={draft.excerpt}
            onChange={(event) => set("excerpt", event.target.value)}
            placeholder="Standfirst — one or two sentences that say why this matters. Shown publicly and in previews."
            rows={2}
            maxLength={320}
            className="mt-4 min-h-0 resize-none border-0 bg-transparent p-0 text-lg leading-relaxed text-muted-foreground shadow-none focus-visible:ring-0 md:text-lg"
          />
          <p className="type-caption mt-2 text-right text-muted-foreground">{draft.excerpt.length} / 320</p>
        </div>

        <div className="tk-editor overflow-clip rounded-xl border bg-card shadow-soft">
          {editor ? <Toolbar editor={editor} /> : <div className="h-[3.3125rem] border-b" />}
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <aside className="space-y-5">
        <Panel title="Publish">
          <p className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={cn("font-semibold", live ? "text-gold-text" : "text-foreground")}>
              {STATUS_LABEL[draft.status]}
              {dirty ? " · unsaved changes" : ""}
            </span>
          </p>
          {draft.publishedAt && draft.status !== "draft" ? (
            <p className="type-caption text-muted-foreground">
              {draft.status === "scheduled" ? "Goes live" : "Published"} {formatDateTime(draft.publishedAt)}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Button onClick={() => save("publish")} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {live ? "Update" : "Publish now"}
            </Button>
            <Button variant="outline" onClick={() => save("draft")} disabled={pending}>
              {live ? "Unpublish (back to draft)" : "Save draft"}
            </Button>
          </div>
          {!live ? (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="schedule-at">Or schedule for later</Label>
              <Input id="schedule-at" type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="h-10" />
              <Button variant="secondary" className="w-full" onClick={() => save("schedule")} disabled={pending || !scheduleAt}>
                Schedule
              </Button>
            </div>
          ) : null}
          {live ? (
            <Link href={`/insights/${draft.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-text hover:underline">
              View on the site <ExternalLink className="size-3.5" />
            </Link>
          ) : null}
        </Panel>

        <Panel title="Cover image">
          {draft.coverImageUrl ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image */}
              <img src={draft.coverImageUrl} alt="" className="aspect-[16/9] w-full rounded-lg border object-cover" />
              <div className="space-y-2">
                <Label htmlFor="cover-alt">Alt text</Label>
                <Input id="cover-alt" value={draft.coverImageAlt} maxLength={200} onChange={(event) => set("coverImageAlt", event.target.value)} className="h-10" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => set("coverImageUrl", null)}>
                Remove image
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => coverInput.current?.click()}>
              <ImagePlus strokeWidth={1.5} /> Upload cover
            </Button>
          )}
          <p className="type-caption text-muted-foreground">Landscape, at least 1600 px wide. JPEG, PNG or WebP up to 4 MB.</p>
          <input
            ref={coverInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            tabIndex={-1}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const url = await upload(file);
              if (url) set("coverImageUrl", url);
            }}
          />
        </Panel>

        <Panel title="Details">
          <div className="space-y-2">
            <Label htmlFor="insight-topic">Topic</Label>
            <select id="insight-topic" value={draft.topicId ?? ""} onChange={(event) => set("topicId", event.target.value || null)} className={field}>
              <option value="">No topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="insight-domain">Tax area</Label>
            <select id="insight-domain" value={draft.domain} onChange={(event) => set("domain", event.target.value as TaxDomain)} className={field}>
              {(Object.keys(DOMAIN_LABEL) as TaxDomain[]).map((key) => (
                <option key={key} value={key}>
                  {DOMAIN_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="insight-slug">Web address</Label>
            <Input
              id="insight-slug"
              value={draft.slug}
              maxLength={90}
              placeholder="made from the title"
              onChange={(event) => set("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
              className="h-10 font-mono text-sm"
            />
            <p className="type-caption text-muted-foreground">/insights/{draft.slug || "…"}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 border-t pt-4">
            <input type="checkbox" checked={draft.membersOnly} onChange={(event) => set("membersOnly", event.target.checked)} className="mt-1 size-4 accent-(--color-gold-700)" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Members only</span>
              <span className="type-caption block text-muted-foreground">Visitors see the title and standfirst; the article needs sign-in.</span>
            </span>
          </label>
        </Panel>

        <Panel title="Search preview">
          <div className="space-y-2">
            <Label htmlFor="seo-title">Title for search engines</Label>
            <Input id="seo-title" value={draft.seoTitle} maxLength={70} placeholder={draft.title || "Uses the title"} onChange={(event) => set("seoTitle", event.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seo-description">Description</Label>
            <Textarea id="seo-description" value={draft.seoDescription} maxLength={170} rows={3} placeholder="Uses the standfirst" onChange={(event) => set("seoDescription", event.target.value)} className="min-h-20" />
          </div>
        </Panel>

        {draft.id ? (
          <Button variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)} disabled={pending}>
            <Trash2 strokeWidth={1.5} /> Delete insight
          </Button>
        ) : null}
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this insight?"
        description="Its comments, likes and saves are deleted with it. This cannot be undone. To take it off the site but keep it, unpublish it instead."
        confirmLabel="Delete insight"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
