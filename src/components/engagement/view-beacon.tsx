"use client";

import { useEffect } from "react";

/** Counts one view per browser session. Pages are cached, so the render cannot count them. */
export function ViewBeacon({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `tk_view_${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode: fall through and send; the server dedupes per day anyway.
    }
    const body = JSON.stringify({ postId });
    if (!navigator.sendBeacon?.("/api/track/view", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track/view", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  }, [postId]);
  return null;
}
