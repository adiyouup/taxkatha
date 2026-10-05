import Link from "next/link";
import { BookOpenText, Bookmark, MessagesSquare } from "lucide-react";

import { BrandLockup } from "@/components/brand/logo";
import { GoldRule, SealRings } from "@/components/brand/motif";
import { siteConfig } from "@/lib/site";

const benefits = [
  { Icon: BookOpenText, text: "The full analysis of every ruling: background, issue and decision." },
  { Icon: MessagesSquare, text: "Discuss each decision with CAs, advocates and tax professionals." },
  { Icon: Bookmark, text: "Save rulings and share branded summaries with your clients." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="theme-navy grain relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <SealRings className="pointer-events-none absolute -right-48 -bottom-48 w-[40rem] opacity-50" />
        <Link href="/" aria-label={`${siteConfig.name} home`} className="relative w-fit rounded-sm">
          <BrandLockup tone="reverse" />
        </Link>
        <div className="relative max-w-lg">
          <p className="type-eyebrow text-gold-500">{siteConfig.descriptor}</p>
          <p className="type-display-lg mt-5 text-paper">
            The rulings that matter, <em className="text-gold-400">explained with clarity.</em>
          </p>
          <GoldRule align="start" className="mt-8" />
          <ul className="mt-8 space-y-5">
            {benefits.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-gold-500/35 text-gold-400">
                  <Icon strokeWidth={1.5} className="size-4.5" />
                </span>
                <span className="type-body text-paper/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="type-eyebrow relative text-[0.6875rem] text-gold-500">{siteConfig.tagline}</p>
      </aside>

      <main id="main" className="flex flex-col bg-background">
        <div className="theme-navy flex h-18 items-center px-4 sm:px-6 lg:hidden">
          <Link href="/" aria-label={`${siteConfig.name} home`} className="rounded-sm">
            <BrandLockup tone="reverse" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
