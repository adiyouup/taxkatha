"use client";

import { useRef } from "react";
import * as m from "motion/react-m";
import { useScroll } from "motion/react";

/**
 * A thin gold bar at the top of the window that fills as the wrapped content
 * is read. It tracks the content, not the page, so the footer does not count.
 */
export function ReadingProgress({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <>
      <m.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gold-500" style={{ scaleX: scrollYProgress }} />
      <div ref={ref} className={className}>
        {children}
      </div>
    </>
  );
}
