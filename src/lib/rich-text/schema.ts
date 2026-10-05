import * as z from "zod";

/*
 * The Insights document format: Tiptap/ProseMirror JSON restricted to an
 * allowlist. Every document is validated against this schema on save, and the
 * public renderer only understands these nodes — so nothing an editor pastes
 * (scripts, event handlers, `javascript:` links, foreign images) can ever
 * reach a reader's browser.
 */

export const MAX_DOC_BYTES = 400_000;

/** Links may point to the web, to email or to a path on this site — never to a script. */
export function isSafeHref(href: string): boolean {
  if (href.length > 2048) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

/** Images must come from our own storage: local uploads in development, Vercel Blob in production. */
export function isAllowedImageSrc(src: string): boolean {
  if (src.length > 2048) return false;
  if (/^\/uploads\/[A-Za-z0-9/_.-]+$/.test(src) && !src.includes("..")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("strike") }),
  z.object({ type: z.literal("code") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({ href: z.string().refine(isSafeHref, "Unsupported link") }).loose(),
  }),
]);

export type RichMark = z.infer<typeof markSchema>;

const textSchema = z.object({ type: z.literal("text"), text: z.string().max(20_000), marks: z.array(markSchema).max(6).optional() });
const hardBreakSchema = z.object({ type: z.literal("hardBreak") });
const inlineSchema = z.discriminatedUnion("type", [textSchema, hardBreakSchema]);

export type RichInline = z.infer<typeof inlineSchema>;

export type RichBlock =
  | { type: "paragraph"; content?: RichInline[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RichInline[] }
  | { type: "blockquote"; content: RichBlock[] }
  | { type: "bulletList"; content: RichListItem[] }
  | { type: "orderedList"; attrs?: { start?: number | null }; content: RichListItem[] }
  | { type: "horizontalRule" }
  | { type: "image"; attrs: { src: string; alt?: string | null; title?: string | null } }
  | { type: "caseEmbed"; attrs: { slug: string } };

export type RichListItem = { type: "listItem"; content: RichBlock[] };

const blockSchema: z.ZodType<RichBlock> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), content: z.array(inlineSchema).max(2000).optional() }),
    z.object({
      type: z.literal("heading"),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
      content: z.array(inlineSchema).max(200).optional(),
    }),
    z.object({ type: z.literal("blockquote"), content: z.array(blockSchema).min(1).max(200) }),
    z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1).max(500) }),
    z.object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().min(1).max(10_000).nullable().optional() }).loose().optional(),
      content: z.array(listItemSchema).min(1).max(500),
    }),
    z.object({ type: z.literal("horizontalRule") }),
    z.object({
      type: z.literal("image"),
      attrs: z.object({
        src: z.string().refine(isAllowedImageSrc, "Images must be uploaded to TaxKatha"),
        alt: z.string().max(300).nullable().optional(),
        title: z.string().max(300).nullable().optional(),
      }),
    }),
    z.object({ type: z.literal("caseEmbed"), attrs: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }) }),
  ]),
);

const listItemSchema: z.ZodType<RichListItem> = z.lazy(() =>
  z.object({ type: z.literal("listItem"), content: z.array(blockSchema).min(1).max(200) }),
);

export const richDocSchema = z.object({ type: z.literal("doc"), content: z.array(blockSchema).max(3000) });

export type RichDoc = z.infer<typeof richDocSchema>;

export const EMPTY_DOC: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

/* -------------------------------- utilities ------------------------------- */

export function inlineText(content: RichInline[] | undefined): string {
  return (content ?? []).map((node) => (node.type === "text" ? node.text : " ")).join("");
}

function blockText(block: RichBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return inlineText(block.content);
    case "blockquote":
      return block.content.map(blockText).join("\n");
    case "bulletList":
    case "orderedList":
      return block.content.map((item) => item.content.map(blockText).join("\n")).join("\n");
    case "image":
      return block.attrs.alt ?? "";
    default:
      return "";
  }
}

/** Plain text of a document — for search, excerpts and reading time. */
export function docToText(doc: RichDoc): string {
  return doc.content
    .map(blockText)
    .filter(Boolean)
    .join("\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** About 220 words a minute, never less than one minute. */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export type DocHeading = { id: string; text: string; level: 2 | 3 };

function slugId(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

/** Headings in document order with unique, stable anchor ids. */
export function docHeadings(doc: RichDoc): DocHeading[] {
  const used = new Map<string, number>();
  const headings: DocHeading[] = [];
  for (const block of doc.content) {
    if (block.type !== "heading") continue;
    const text = inlineText(block.content).trim();
    if (!text) continue;
    const base = slugId(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    headings.push({ id: count === 0 ? base : `${base}-${count + 1}`, text, level: block.attrs.level });
  }
  return headings;
}

/** Slugs of the case laws embedded in the document, in order, without repeats. */
export function docEmbeds(doc: RichDoc): string[] {
  const slugs: string[] = [];
  const visit = (blocks: RichBlock[]) => {
    for (const block of blocks) {
      if (block.type === "caseEmbed" && !slugs.includes(block.attrs.slug)) slugs.push(block.attrs.slug);
      else if (block.type === "blockquote") visit(block.content);
      else if (block.type === "bulletList" || block.type === "orderedList") block.content.forEach((item) => visit(item.content));
    }
  };
  visit(doc.content);
  return slugs;
}

/** True when the document has no readable content yet. */
export function isEmptyDoc(doc: RichDoc): boolean {
  return docToText(doc).length === 0 && !doc.content.some((b) => b.type === "image" || b.type === "caseEmbed");
}
