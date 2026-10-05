import Link from "next/link";
import { Fragment } from "react";

import { docHeadings, inlineText, type RichBlock, type RichDoc, type RichInline } from "@/lib/rich-text/schema";

/*
 * Renders a validated Insights document to React elements on the server.
 * There is no raw HTML anywhere: every node becomes an explicit element, so
 * the output is safe by construction.
 */

function Inline({ nodes }: { nodes?: RichInline[] }) {
  return (
    <>
      {(nodes ?? []).map((node, i) => {
        if (node.type === "hardBreak") return <br key={i} />;
        let element: React.ReactNode = node.text;
        for (const mark of node.marks ?? []) {
          switch (mark.type) {
            case "bold":
              element = <strong className="font-semibold text-foreground">{element}</strong>;
              break;
            case "italic":
              element = <em>{element}</em>;
              break;
            case "underline":
              element = <span className="underline underline-offset-4">{element}</span>;
              break;
            case "strike":
              element = <s>{element}</s>;
              break;
            case "code":
              element = <code className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{element}</code>;
              break;
            case "link": {
              const href = mark.attrs.href;
              const className = "font-medium text-gold-text underline decoration-gold-600/50 underline-offset-4 hover:decoration-gold-700";
              element = href.startsWith("/") ? (
                <Link href={href} className={className}>
                  {element}
                </Link>
              ) : (
                <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                  {element}
                </a>
              );
              break;
            }
          }
        }
        return <Fragment key={i}>{element}</Fragment>;
      })}
    </>
  );
}

export type EmbedRenderer = (slug: string) => React.ReactNode;

function Blocks({ blocks, headingIds, embed, top = false }: { blocks: RichBlock[]; headingIds: string[]; embed: EmbedRenderer; top?: boolean }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            // Editors leave empty paragraphs around images and embeds; they are spacing, not content.
            if (!block.content?.length) return null;
            return (
              <p key={i} className="text-[1.125rem] leading-[1.8] text-foreground/90">
                <Inline nodes={block.content} />
              </p>
            );
          case "heading": {
            // Only top-level headings are anchors (they are the ones in the table of contents).
            // Blank headings are skipped here exactly as docHeadings() skips them, so the ids stay in step.
            if (!inlineText(block.content).trim()) return null;
            const id = top ? headingIds.shift() : undefined;
            return block.attrs.level === 2 ? (
              <h2 key={i} id={id} className="type-display-md scroll-mt-28 pt-6 text-foreground">
                <Inline nodes={block.content} />
              </h2>
            ) : (
              <h3 key={i} id={id} className="type-display-sm scroll-mt-28 pt-3 text-foreground">
                <Inline nodes={block.content} />
              </h3>
            );
          }
          case "blockquote":
            return (
              <blockquote key={i} className="space-y-4 border-l-2 border-gold-500 pl-6 font-display text-xl leading-relaxed text-foreground italic">
                <Blocks blocks={block.content} headingIds={headingIds} embed={embed} />
              </blockquote>
            );
          case "bulletList":
            return (
              <ul key={i} className="list-disc space-y-2.5 pl-6 marker:text-gold-600">
                {block.content.map((item, j) => (
                  <li key={j} className="space-y-3 pl-1.5">
                    <Blocks blocks={item.content} headingIds={headingIds} embed={embed} />
                  </li>
                ))}
              </ul>
            );
          case "orderedList":
            return (
              <ol key={i} start={block.attrs?.start ?? undefined} className="list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-gold-700">
                {block.content.map((item, j) => (
                  <li key={j} className="space-y-3 pl-1.5">
                    <Blocks blocks={item.content} headingIds={headingIds} embed={embed} />
                  </li>
                ))}
              </ol>
            );
          case "horizontalRule":
            return <hr key={i} className="mx-auto my-4 h-px w-40 border-0 bg-linear-to-r from-transparent via-gold-500 to-transparent" />;
          case "image":
            return (
              <figure key={i} className="py-2">
                {/* Stored at upload size; plain <img> avoids an optimiser round-trip for editorial images. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.attrs.src} alt={block.attrs.alt ?? ""} loading="lazy" decoding="async" className="w-full rounded-xl border" />
                {block.attrs.title ? <figcaption className="type-caption mt-2.5 text-center text-muted-foreground">{block.attrs.title}</figcaption> : null}
              </figure>
            );
          case "caseEmbed":
            return <div key={i}>{embed(block.attrs.slug)}</div>;
        }
      })}
    </>
  );
}

export function RichText({ doc, embed }: { doc: RichDoc; embed: EmbedRenderer }) {
  // Heading ids are consumed in document order while rendering.
  const headingIds = docHeadings(doc).map((h) => h.id);
  return (
    <div className="space-y-6">
      <Blocks blocks={doc.content} headingIds={headingIds} embed={embed} top />
    </div>
  );
}
