import Link from "next/link";
import { cacheLife } from "next/cache";

import { BrandLogo } from "@/components/brand/logo";
import { footerNav, siteConfig } from "@/lib/site";
import { getSiteSettings } from "@/server/settings";

async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-md border border-white/12 text-paper/80 transition-colors hover:border-gold-500 hover:text-gold-400"
    >
      {children}
    </a>
  );
}

const ICONS = {
  linkedin: (
    <svg viewBox="0 0 24 24" className="size-4.5 fill-current" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm7 0h3.8v1.6h.06c.53-.95 1.83-1.95 3.76-1.95 4.02 0 4.76 2.5 4.76 5.75v5.6h-4v-4.96c0-1.18-.02-2.7-1.74-2.7-1.74 0-2 1.28-2 2.61v5.05h-4v-11Z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="size-4.5 fill-current" aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  ),
};

const SOCIAL_LABEL = { linkedin: "LinkedIn", x: "X", instagram: "Instagram", youtube: "YouTube" } as const;

export async function SiteFooter() {
  const [year, settings] = await Promise.all([currentYear(), getSiteSettings()]);
  const social = (Object.keys(SOCIAL_LABEL) as (keyof typeof SOCIAL_LABEL)[])
    .filter((key) => settings.social[key])
    .map((key) => ({ href: settings.social[key], label: `${siteConfig.name} on ${SOCIAL_LABEL[key]}`, icon: ICONS[key] }));
  return (
    <footer className="theme-navy grain border-t border-gold-500/25">
      <div className="container-wide py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:gap-20">
          <div className="flex flex-col items-start">
            <BrandLogo tone="reverse" className="h-40 w-auto sm:h-44" />
            <p className="type-eyebrow mt-6 text-gold-500">{siteConfig.tagline}</p>
            <p className="type-small mt-4 max-w-sm text-muted-foreground">
              Clear, searchable summaries of Indian tax rulings — and a professional community to discuss what each
              decision means in practice.
            </p>
            {social.length > 0 ? (
              <div className="mt-6 flex gap-3">
                {social.map(({ href, label, icon }) => (
                  <SocialLink key={label} href={href} label={label}>
                    {icon}
                  </SocialLink>
                ))}
              </div>
            ) : null}
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {footerNav.map((group) => (
              <div key={group.title}>
                <h2 className="type-eyebrow text-[0.6875rem] text-gold-500">{group.title}</h2>
                <ul className="mt-5 space-y-3.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="gold-underline pb-0.5 text-[0.9375rem] text-paper/80 transition-colors hover:text-paper"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 h-px bg-linear-to-r from-transparent via-gold-500/45 to-transparent" />

        <div className="mt-8 flex flex-col gap-4 text-muted-foreground lg:flex-row lg:items-start lg:justify-between">
          <p className="type-caption max-w-3xl">
            Summaries on TaxKatha are for general information only and do not constitute legal or tax advice. Read the
            full decision and the applicable law before relying on any ruling.
          </p>
          <p className="type-caption shrink-0">
            © {year} {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
