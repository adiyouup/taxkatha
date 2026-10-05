"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

const format = (value: number) => new Intl.NumberFormat("en-IN").format(value);

/**
 * Counts up to `value` the first time it is seen. The server renders the
 * final number, so search engines and no-JS visitors always get the real
 * figure.
 */
export function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!inView || !node || reduceMotion) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = `${format(Math.round(latest))}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, reduceMotion, suffix, value]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
      {suffix}
    </span>
  );
}
