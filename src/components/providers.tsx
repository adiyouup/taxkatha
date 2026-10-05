"use client";

import { LazyMotion, MotionConfig, domAnimation, useReducedMotion } from "motion/react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Elements that must keep native scrolling (dialogs, menus, scroll areas). */
const NATIVE_SCROLL = '[role="dialog"],[role="menu"],[role="listbox"],[data-slot="scroll-area"],[data-lenis-prevent]';

function SmoothScroll() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        smoothWheel: true,
        anchors: true,
        autoRaf: true,
        prevent: (node) => node.closest(NATIVE_SCROLL) !== null,
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <LazyMotion features={domAnimation} strict>
        <TooltipProvider delay={200}>
          <SmoothScroll />
          {children}
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
