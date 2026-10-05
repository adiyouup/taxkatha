"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Link2, Mail, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useEngagement } from "@/components/engagement/engagement-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { intentUrl, shareUrl, type ShareChannel } from "@/lib/share";
import { cn } from "@/lib/utils";
import { recordShare } from "@/server/actions/engagement";

export type ShareTarget = { id: string; slug: string; title: string; path: string };

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5.1 5.2-1.36A9.93 9.93 0 1 0 12.04 2Zm0 1.8a8.12 8.12 0 0 1 6.88 12.44 8.13 8.13 0 0 1-10.9 2.74l-.3-.18-3.08.8.83-3-.2-.31A8.12 8.12 0 0 1 12.04 3.8Zm-3.5 4.3c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.59.13.17 1.76 2.8 4.33 3.82 2.14.84 2.58.68 3.04.63.47-.04 1.5-.61 1.72-1.2.21-.6.21-1.1.15-1.21-.07-.11-.24-.17-.5-.3-.26-.13-1.5-.74-1.74-.83-.23-.08-.4-.13-.57.13-.17.25-.66.83-.8 1-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.06-1.27a7.7 7.7 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.11.26-.3.39-.45.13-.15.17-.25.26-.42.08-.17.04-.32-.02-.45-.07-.13-.56-1.38-.78-1.88-.2-.48-.41-.42-.57-.43h-.45Z" />
    </svg>
  );
}

function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm7 0h3.8v1.6h.06c.53-.95 1.83-1.95 3.76-1.95 4.02 0 4.76 2.5 4.76 5.75v5.6h-4v-4.96c0-1.18-.02-2.7-1.74-2.7-1.74 0-2 1.28-2 2.61v5.05h-4v-11Z" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5 fill-current" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}

function Tile({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const className =
    "group flex flex-col items-center gap-2 rounded-lg p-2 text-center outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";
  const inner = (
    <>
      <span className="flex size-12 items-center justify-center rounded-full border border-input bg-card text-navy-900 transition-colors group-hover:border-gold-600 group-hover:text-gold-700">
        {children}
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/**
 * Instagram-style share sheet: social targets, copy link, the device's own
 * share menu, and branded image cards (story / square) that can be posted to
 * Instagram, WhatsApp status or LinkedIn.
 */
export function ShareSheet({ target, open, onOpenChange }: { target: ShareTarget; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { userId } = useEngagement();
  const [copied, setCopied] = useState(false);
  // This component only ever mounts in the browser (after a tap), so the capability can be read directly.
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  // iOS only allows navigator.share() directly inside the tap handler, so the
  // image files are fetched as soon as the sheet opens, not on tap.
  const files = useRef<Partial<Record<"story" | "square", File>>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    for (const format of ["story", "square"] as const) {
      if (files.current[format]) continue;
      fetch(`/api/cards/${target.slug}/${format}`)
        .then((response) => (response.ok ? response.blob() : null))
        .then((blob) => {
          if (blob && !cancelled) files.current[format] = new File([blob], `taxkatha-${target.slug.slice(0, 40)}-${format}.png`, { type: "image/png" });
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [open, target.slug]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = (channel: ShareChannel) => shareUrl(origin, target.path, channel, userId);
  const track = (channel: ShareChannel) => void recordShare(target.id, channel);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link("copy_link"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track("copy_link");
    } catch {
      toast.error("Could not copy the link. Copy it from the address bar instead.");
    }
  }

  async function native() {
    try {
      await navigator.share({ title: target.title, text: `${target.title} — TaxKatha`, url: link("native") });
      track("native");
    } catch {
      // The visitor dismissed the system sheet.
    }
  }

  function card(format: "story" | "square") {
    const channel: ShareChannel = format === "story" ? "story_card" : "square_card";
    const file = files.current[format];
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file], title: target.title })
        .then(() => track(channel))
        .catch(() => undefined);
      return;
    }
    // Desktop (or the image is still loading): download it instead.
    const anchor = document.createElement("a");
    anchor.href = file ? URL.createObjectURL(file) : `/api/cards/${target.slug}/${format}`;
    anchor.download = `taxkatha-${target.slug.slice(0, 40)}-${format}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    track(channel);
    toast.success(format === "story" ? "Story card saved. Add it to your Instagram or WhatsApp story." : "Card saved. Post it to your feed.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this ruling</DialogTitle>
          <DialogDescription className="line-clamp-2 text-muted-foreground">{target.title}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          <Tile label="WhatsApp" href={intentUrl("whatsapp", link("whatsapp"), target.title)} onClick={() => track("whatsapp")}>
            <WhatsAppIcon />
          </Tile>
          <Tile label="LinkedIn" href={intentUrl("linkedin", link("linkedin"), target.title)} onClick={() => track("linkedin")}>
            <LinkedInGlyph />
          </Tile>
          <Tile label="X" href={intentUrl("x", link("x"), target.title)} onClick={() => track("x")}>
            <XGlyph />
          </Tile>
          <Tile label="Telegram" href={intentUrl("telegram", link("telegram"), target.title)} onClick={() => track("telegram")}>
            <Send strokeWidth={1.5} className="size-5" />
          </Tile>
          <Tile label="Email" href={intentUrl("email", link("email"), target.title)} onClick={() => track("email")}>
            <Mail strokeWidth={1.5} className="size-5" />
          </Tile>
          {canNativeShare ? (
            <Tile label="More" onClick={native}>
              <Share2 strokeWidth={1.5} className="size-5" />
            </Tile>
          ) : null}
        </div>

        <button
          type="button"
          onClick={copy}
          className="flex h-12 w-full items-center gap-3 rounded-md border border-input bg-paper px-3.5 text-left transition-colors hover:border-gold-600"
        >
          {copied ? <Check className="size-4 shrink-0 text-gold-700" /> : <Link2 strokeWidth={1.5} className="size-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{origin.replace(/^https?:\/\//, "")}{target.path}</span>
          <span className="shrink-0 text-sm font-semibold text-gold-text">{copied ? "Copied" : "Copy link"}</span>
        </button>

        <div>
          <p className="type-eyebrow text-[0.625rem] text-gold-text">Share as an image</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["story", "square"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => card(format)}
                className="group flex items-center gap-3 rounded-lg border border-input bg-card p-2.5 text-left transition-colors hover:border-gold-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG preview; next/image would re-optimise it */}
                <img
                  src={`/api/cards/${target.slug}/${format}`}
                  alt=""
                  loading="lazy"
                  className={cn("w-12 shrink-0 rounded-xs border border-navy-900/15 object-cover", format === "story" ? "aspect-[9/16]" : "aspect-square")}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{format === "story" ? "Story card" : "Square card"}</span>
                  <span className="type-caption flex items-center gap-1 text-muted-foreground">
                    <Download className="size-3" /> {format === "story" ? "Instagram, WhatsApp" : "Feed, LinkedIn"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
