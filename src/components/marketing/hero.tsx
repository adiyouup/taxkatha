"use client";

import Link from "next/link";
import * as m from "motion/react-m";
import { useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

import { Diamond, GoldRule, SealRings } from "@/components/brand/motif";
import { DirectorySearch } from "@/components/posts/directory-controls";
import { OutcomePill } from "@/components/posts/outcome-pill";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import type { OutcomeSide } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type HeroCard = {
  slug: string;
  title: string;
  court: string;
  decisionDate: string;
  outcomeSide: OutcomeSide;
  remanded: boolean;
};

export type HeroStats = { rulings: number; courts: number; assesseeShare: number; latestDecision: string | null };

/** Editable from Admin → Settings. `accent` is the gold italic phrase after the headline. */
export type HeroCopy = { eyebrow: string; headline: string; accent: string; lede: string };

const EASE = [0.16, 1, 0.3, 1] as const;

/** A ruling that hangs from the beam like a scale pan. */
function Pan({ card, side, counterRotate, y }: { card: HeroCard; side: "left" | "right"; counterRotate: MotionValue<number>; y: MotionValue<number> }) {
  return (
    <m.div
      className={cn("absolute top-0 w-56", side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2")}
      style={{ rotate: counterRotate, y, transformOrigin: "50% 0%" }}
    >
      {/* strings */}
      <svg viewBox="0 0 224 84" className="block h-21 w-full text-gold-500" fill="none" aria-hidden>
        <path d="M112 0 L10 84 M112 0 L214 84" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        <circle cx="112" cy="1.5" r="3" fill="currentColor" />
      </svg>
      <Link
        href={`/case-laws/${card.slug}`}
        className="block rounded-lg border border-gold-500/35 bg-navy-850/95 p-4 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] backdrop-blur-sm transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-gold-400"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[0.6875rem] font-semibold tracking-[0.08em] text-gold-400 uppercase">{card.court}</span>
        </span>
        <span className="mt-2 line-clamp-3 block font-display text-[0.9375rem] leading-snug font-semibold text-paper">{card.title}</span>
        <span className="mt-3 flex items-center justify-between gap-2">
          <OutcomePill side={card.outcomeSide} remanded={false} />
          <span className="text-[0.6875rem] text-muted-foreground">{formatDate(card.decisionDate)}</span>
        </span>
      </Link>
    </m.div>
  );
}

export function Hero({
  copy,
  stats,
  pair,
}: {
  copy: HeroCopy;
  stats: HeroStats;
  pair: { assessee: HeroCard | null; revenue: HeroCard | null };
}) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const still = Boolean(reduceMotion);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  // Layers move at different rates; with reduced motion everything stays put.
  const range = (from: number, to: number) => (still ? [0, 0] : [from, to]);
  const ringsY = useTransform(scrollYProgress, [0, 1], range(0, 140));
  const stageY = useTransform(scrollYProgress, [0, 1], range(0, 70));
  const textY = useTransform(scrollYProgress, [0, 1], range(0, 48));
  const textOpacity = useTransform(scrollYProgress, [0, 0.85], still ? [1, 1] : [1, 0.25]);
  const leftY = useTransform(scrollYProgress, [0, 1], range(0, -36));
  const rightY = useTransform(scrollYProgress, [0, 1], range(0, -84));

  // The scale starts tilted toward the heavier side and levels out as you scroll.
  const tilt = stats.assesseeShare >= 50 ? -5.5 : 5.5;
  const beamRotate = useTransform(scrollYProgress, [0, 0.42], still ? [0, 0] : [tilt, 0]);
  const counterRotate = useTransform(beamRotate, (value) => -value);

  // Gentle pointer tilt on devices with a mouse.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-4, 4]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [3, -3]), { stiffness: 120, damping: 18 });

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (still || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  const hasScale = pair.assessee !== null && pair.revenue !== null;

  return (
    <section
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
      className="theme-navy grain relative overflow-hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_34rem_at_82%_8%,rgb(212_175_55/0.13),transparent_62%)]" />
      <m.div aria-hidden style={{ y: ringsY }} className="pointer-events-none absolute top-1/2 right-[-14rem] hidden w-[58rem] -translate-y-1/2 lg:block">
        <SealRings className="w-full opacity-55" />
      </m.div>

      <div className="container-wide relative grid min-h-[min(100dvh,56rem)] items-center gap-12 pt-28 pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-32 lg:pb-20">
        {/* The headline is the LCP element: it renders immediately, without an entrance fade. */}
        <m.div style={{ y: textY, opacity: textOpacity }} className="relative max-w-2xl">
          {copy.eyebrow ? <p className="type-eyebrow text-gold-500">{copy.eyebrow}</p> : null}
          <h1 className={cn("type-display-xl text-paper", copy.eyebrow && "mt-6")}>
            {copy.headline}
            {copy.accent ? (
              <>
                {" "}
                <em className="text-gold-400">{copy.accent}</em>
              </>
            ) : null}
          </h1>
          <GoldRule align="start" className="mt-8" />
          <p className="type-lede mt-8 max-w-xl text-muted-foreground">{copy.lede}</p>

          <div className="mt-9 max-w-xl">
            <DirectorySearch params={{ page: 1 }} placeholder={`Search ${formatNumber(stats.rulings)} rulings by party, section or court`} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
              Get Started <ArrowRight strokeWidth={1.75} />
            </Link>
            <Link href="/case-laws" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Explore Case Laws
            </Link>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-white/12">
            <div className="pr-4">
              <dd className="type-numeral text-3xl leading-none text-paper">{formatNumber(stats.rulings)}</dd>
              <dt className="type-caption mt-2 text-muted-foreground">rulings summarised</dt>
            </div>
            <div className="px-4 sm:px-6">
              <dd className="type-numeral text-3xl leading-none text-paper">{formatNumber(stats.courts)}</dd>
              <dt className="type-caption mt-2 text-muted-foreground">courts and tribunals</dt>
            </div>
            {stats.latestDecision ? (
              <div className="pl-4 sm:pl-6">
                <dd className="type-numeral text-3xl leading-none text-paper">
                  {formatDate(stats.latestDecision).replace(/\s\d{4}$/, "")}
                </dd>
                <dt className="type-caption mt-2 text-muted-foreground">latest decision, {stats.latestDecision.slice(0, 4)}</dt>
              </div>
            ) : null}
          </dl>
        </m.div>

        {/* The balance: two real rulings weighed against each other. Desktop only. */}
        {hasScale ? (
          <m.div style={{ y: stageY }} className="relative hidden h-[36rem] lg:block" aria-label="Recent rulings">
            <m.div
              style={still ? undefined : { rotateX, rotateY, transformPerspective: 1100 }}
              initial={still ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
              className="absolute inset-0"
            >
              {/* column, finial and base */}
              <div aria-hidden className="absolute top-[9%] left-1/2 h-[74%] w-[2px] -translate-x-1/2 bg-linear-to-b from-gold-400 via-gold-500/60 to-gold-500/5" />
              <Diamond className="absolute top-[6.4%] left-1/2 size-3.5 -translate-x-1/2 text-gold-400" />
              <div aria-hidden className="absolute bottom-[16.5%] left-1/2 h-[2px] w-36 -translate-x-1/2 bg-linear-to-r from-transparent via-gold-500/70 to-transparent" />
              <div aria-hidden className="absolute bottom-[14.5%] left-1/2 h-px w-56 -translate-x-1/2 bg-linear-to-r from-transparent via-gold-500/35 to-transparent" />

              {/* beam with the two pans */}
              <m.div style={{ rotate: beamRotate }} className="absolute top-[14%] right-[17%] left-[17%] h-[2px] bg-gold-500">
                <Pan card={pair.assessee!} side="left" counterRotate={counterRotate} y={leftY} />
                <Pan card={pair.revenue!} side="right" counterRotate={counterRotate} y={rightY} />
              </m.div>

              <p className="type-caption absolute bottom-[4%] left-1/2 w-72 -translate-x-1/2 text-center text-muted-foreground">
                <span className="type-numeral text-lg text-gold-400">{stats.assesseeShare}%</span> of decided rulings went
                the assessee&apos;s way
              </p>
            </m.div>
          </m.div>
        ) : null}
      </div>
      <div className="relative h-px bg-linear-to-r from-transparent via-gold-500/50 to-transparent" />
    </section>
  );
}
