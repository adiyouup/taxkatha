import { describe, expect, it } from "vitest";

import { docEmbeds, docHeadings, docToText, isAllowedImageSrc, isSafeHref, readingMinutes, richDocSchema } from "./schema";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("rich text schema", () => {
  it("accepts the formatting editors can produce", () => {
    const result = richDocSchema.safeParse(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Why it matters")] },
        { type: "paragraph", content: [text("Read "), text("the ruling", [{ type: "link", attrs: { href: "/case-laws/abc", target: "_blank" } }]), { type: "hardBreak" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("One", [{ type: "bold" }])] }] }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [text("Held.")] }] },
        { type: "image", attrs: { src: "/uploads/insights/a1b2.webp", alt: "Chart" } },
        { type: "caseEmbed", attrs: { slug: "alpha-v-state-2026-08-01" } },
        { type: "horizontalRule" },
      ),
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["script links", doc({ type: "paragraph", content: [text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])] })],
    ["data links", doc({ type: "paragraph", content: [text("x", [{ type: "link", attrs: { href: "data:text/html,<script>" } }])] })],
    ["hot-linked images", doc({ type: "image", attrs: { src: "https://evil.example/x.png" } })],
    ["path traversal in images", doc({ type: "image", attrs: { src: "/uploads/../../etc/passwd" } })],
    ["unknown nodes", doc({ type: "iframe", attrs: { src: "https://example.com" } })],
    ["unknown marks", doc({ type: "paragraph", content: [text("x", [{ type: "textStyle", attrs: { color: "red" } }])] })],
    ["h1 headings", doc({ type: "heading", attrs: { level: 1 }, content: [text("Title")] })],
    ["bad embed slugs", doc({ type: "caseEmbed", attrs: { slug: "../admin" } })],
  ])("rejects %s", (_name, value) => {
    expect(richDocSchema.safeParse(value).success).toBe(false);
  });

  it("validates link and image sources", () => {
    expect(isSafeHref("https://example.com/a")).toBe(true);
    expect(isSafeHref("mailto:hello@taxkatha.com")).toBe(true);
    expect(isSafeHref("/case-laws")).toBe(true);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isAllowedImageSrc("https://abc123.public.blob.vercel-storage.com/insights/x.webp")).toBe(true);
    expect(isAllowedImageSrc("https://public.blob.vercel-storage.com.evil.example/x.webp")).toBe(false);
  });

  it("derives text, reading time, headings and embeds", () => {
    const parsed = richDocSchema.parse(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Background")] },
        { type: "paragraph", content: [text("word ".repeat(440))] },
        { type: "heading", attrs: { level: 2 }, content: [text("Background")] },
        { type: "caseEmbed", attrs: { slug: "a-v-b" } },
        { type: "blockquote", content: [{ type: "caseEmbed", attrs: { slug: "a-v-b" } }, { type: "caseEmbed", attrs: { slug: "c-v-d" } }] },
      ),
    );
    expect(docToText(parsed).startsWith("Background")).toBe(true);
    expect(readingMinutes(docToText(parsed))).toBe(2);
    expect(docHeadings(parsed).map((h) => h.id)).toEqual(["background", "background-2"]);
    expect(docEmbeds(parsed)).toEqual(["a-v-b", "c-v-d"]);
  });
});
