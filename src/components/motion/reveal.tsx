"use client";

import * as m from "motion/react-m";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Fade-up when the element scrolls into view (once). Server-rendered markup
 * carries `data-reveal`, and a <noscript> rule in the root layout forces
 * these visible when JavaScript is unavailable. Reduced-motion users get the
 * fade without the movement (MotionConfig reducedMotion="user").
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <m.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

/** A gold hairline that draws from the left when it enters the viewport. */
export function LineReveal({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <m.span
      aria-hidden
      data-reveal
      className={className}
      style={{ transformOrigin: "left center", display: "block" }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    />
  );
}
