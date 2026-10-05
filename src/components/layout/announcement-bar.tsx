import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Diamond } from "@/components/brand/motif";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The thin bar above the header that administrators switch on from Settings.
 * Its height is fixed (two lines on phones, one above) because the fixed
 * header sits directly below it — see `SiteHeader`'s `offset`.
 */
export function AnnouncementBar({ announcement }: { announcement: SiteSettings["announcement"] }) {
  if (!announcement.enabled || !announcement.text) return null;
  const label = announcement.linkLabel || "Read more";
  const external = /^https?:\/\//.test(announcement.href);

  return (
    <aside aria-label="Announcement" className="theme-navy relative z-50 border-b border-gold-500/25 bg-navy-950">
      <div className="container-wide flex h-11 items-center justify-center gap-3 sm:h-9">
        <Diamond className="hidden size-1.5 shrink-0 text-gold-500 sm:block" />
        <p className="line-clamp-2 min-w-0 text-[0.75rem] leading-snug text-paper/90 sm:truncate sm:text-[0.8125rem]">{announcement.text}</p>
        {announcement.href ? (
          external ? (
            <a
              href={announcement.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-gold-400 hover:text-gold-300 hover:underline sm:text-[0.8125rem]"
            >
              {label} <ArrowRight className="size-3.5" aria-hidden />
            </a>
          ) : (
            <Link
              href={announcement.href}
              className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-gold-400 hover:text-gold-300 hover:underline sm:text-[0.8125rem]"
            >
              {label} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )
        ) : null}
      </div>
    </aside>
  );
}
