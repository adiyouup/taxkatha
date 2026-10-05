import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/logo";
import { GoldRule, SealRings } from "@/components/brand/motif";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="main" className="theme-navy grain relative flex min-h-dvh flex-col overflow-hidden">
      <SealRings className="pointer-events-none absolute top-1/2 left-1/2 w-[52rem] -translate-x-1/2 -translate-y-1/2 opacity-40" />
      <div className="container-wide relative flex h-18 items-center">
        <Link href="/" aria-label="TaxKatha home" className="rounded-sm">
          <BrandLockup tone="reverse" />
        </Link>
      </div>
      <div className="container-wide relative flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="type-eyebrow text-gold-500">Error 404</p>
        <h1 className="type-display-xl mt-6 text-paper">
          This page is <em className="text-gold-400">not on the record.</em>
        </h1>
        <GoldRule className="mt-8" />
        <p className="type-lede mt-8 max-w-xl text-muted-foreground">
          The link may be out of date, or the ruling may have been moved. Search the directory to find it.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/case-laws" className={buttonVariants({ size: "lg" })}>
            Search case laws
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
