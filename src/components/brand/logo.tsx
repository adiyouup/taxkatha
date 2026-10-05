import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * TaxKatha brand marks. Paths are copied verbatim from the supplied
 * TaxKatha_logo.svg (the source of truth) — only the viewBox is cropped and,
 * for the `reverse` tone, the navy elements switch to off-white so the logo
 * reads on navy surfaces (gold is never changed).
 */

type Tone = "default" | "reverse";

const NAVY = {
  default: { from: "#1A2D42", to: "#0B1623", vane: "#1A2D42", cuts: "#FAFAFD", cutsOpacity: 0.72, word: "#0B1623" },
  reverse: { from: "#FAFAF7", to: "#E9ECF2", vane: "#E1E6EF", cuts: "#0A1F44", cutsOpacity: 0.55, word: "#FAFAF7" },
} as const;

function useGradientIds() {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return { gold: `tk-gold-${raw}`, navy: `tk-navy-${raw}` };
}

function Defs({ ids, tone }: { ids: { gold: string; navy: string }; tone: Tone }) {
  const n = NAVY[tone];
  return (
    <defs>
      <linearGradient id={ids.gold} x1="300" y1="280" x2="900" y2="900" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E1B843" />
        <stop offset="0.45" stopColor="#C59B27" />
        <stop offset="1" stopColor="#916B10" />
      </linearGradient>
      <linearGradient id={ids.navy} x1="300" y1="250" x2="900" y2="900" gradientUnits="userSpaceOnUse">
        <stop stopColor={n.from} />
        <stop offset="1" stopColor={n.to} />
      </linearGradient>
    </defs>
  );
}

function Seal({ ids, tone }: { ids: { gold: string; navy: string }; tone: Tone }) {
  const n = NAVY[tone];
  const gold = `url(#${ids.gold})`;
  const navy = `url(#${ids.navy})`;
  return (
    <g>
      <circle cx="600" cy="420" r="245" stroke={navy} strokeWidth="8" />
      <circle cx="600" cy="420" r="229" stroke={gold} strokeWidth="3" />
      <circle cx="600" cy="420" r="217" stroke="#C59B27" strokeWidth="1" opacity="0.28" />
      <g stroke={gold} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M405 382 Q600 355 795 382" strokeWidth="10" />
        <path d="M405 382 L435 448 M405 382 L475 448 M795 382 L725 448 M795 382 L765 448" strokeWidth="4" />
      </g>
      <g fill={gold} stroke={gold} strokeLinejoin="round">
        <path d="M420 448 Q455 475 490 448 Q477 478 455 482 Q433 478 420 448Z" strokeWidth="2" />
        <path d="M710 448 Q745 475 780 448 Q767 478 745 482 Q723 478 710 448Z" strokeWidth="2" />
        <circle cx="455" cy="448" r="6" />
        <circle cx="745" cy="448" r="6" />
      </g>
      <g fill={gold}>
        <path d="M586 375 H614 V645 H586 Z" />
        <path d="M565 645 H635 L650 667 H550 Z" />
        <path d="M600 327 L582 362 H618 Z" />
        <ellipse cx="600" cy="375" rx="20" ry="7" />
      </g>
      <g fill={navy}>
        <path d="M492 650 C520 588 553 514 592 438 C625 374 670 316 735 264 C714 326 689 390 661 451 C631 516 598 574 556 624 C535 649 514 665 497 666 C489 665 487 658 492 650Z" />
        <path
          d="M500 648 C533 586 565 517 598 451 C628 390 666 333 711 292 C672 349 640 414 613 481 C586 548 555 607 520 651 C511 662 502 660 500 648Z"
          fill={n.vane}
        />
        <path d="M492 650 L462 688 Q458 695 466 695 L515 660 Z" />
      </g>
      <g stroke={n.cuts} strokeWidth="5" strokeLinecap="round" opacity={n.cutsOpacity}>
        <path d="M592 455 L628 419" />
        <path d="M568 510 L611 468" />
        <path d="M544 563 L584 525" />
      </g>
      <circle cx="381" cy="420" r="5" fill={gold} />
      <circle cx="819" cy="420" r="5" fill={gold} />
    </g>
  );
}

type MarkProps = { tone?: Tone; className?: string; title?: string };

/** The seal alone (scale + quill). Square. */
export function BrandMark({ tone = "default", className, title }: MarkProps) {
  const ids = useGradientIds();
  return (
    <svg
      viewBox="330 163 540 540"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <Defs ids={ids} tone={tone} />
      <Seal ids={ids} tone={tone} />
    </svg>
  );
}

/** The full stacked logo: seal, wordmark, gold divider and tagline. */
export function BrandLogo({ tone = "default", className, title = "TaxKatha" }: MarkProps) {
  const ids = useGradientIds();
  const n = NAVY[tone];
  const gold = `url(#${ids.gold})`;
  return (
    <svg
      viewBox="250 150 700 790"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <Defs ids={ids} tone={tone} />
      <Seal ids={ids} tone={tone} />
      <text
        x="600"
        y="805"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="88"
        fontWeight="700"
        letterSpacing="17"
        fill={n.word}
      >
        TAXKATHA
      </text>
      <g stroke={gold} strokeLinecap="round">
        <path d="M275 852 H510" strokeWidth="3" />
        <path d="M690 852 H925" strokeWidth="3" />
      </g>
      <rect x="588" y="840" width="24" height="24" rx="2" transform="rotate(45 588 840)" fill={gold} />
      <text
        x="600"
        y="908"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="9"
        fill="#C59B27"
      >
        INSIGHTS • ANALYSIS • SUMMARY
      </text>
    </svg>
  );
}

/**
 * Horizontal lockup for the navbar: seal + wordmark set in the display serif
 * with the logo's wide tracking. The stacked logo is illegible at nav height.
 */
export function BrandLockup({
  tone = "default",
  className,
  showTagline = false,
}: {
  tone?: Tone;
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark tone={tone} className="size-9 sm:size-10" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.0625rem] font-semibold tracking-[0.2em] sm:text-lg",
            tone === "reverse" ? "text-paper" : "text-navy-900",
          )}
        >
          TAXKATHA
        </span>
        {showTagline ? (
          <span className="mt-1.5 text-[0.5625rem] font-semibold tracking-[0.28em] text-gold-500">
            INSIGHTS • ANALYSIS • SUMMARY
          </span>
        ) : null}
      </span>
    </span>
  );
}
