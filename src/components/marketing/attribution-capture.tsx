"use client";

import { useEffect } from "react";

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"] as const;
const COOKIE = "tk_attrib";

/**
 * First-touch attribution: remembers how a visitor arrived (UTM tags, or the
 * member whose shared link they followed) for 30 days. It is stored against
 * the account only if they sign up.
 */
export function AttributionCapture() {
  useEffect(() => {
    if (document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`))) return;
    const params = new URLSearchParams(window.location.search);
    const data: Record<string, string> = {};
    for (const key of KEYS) {
      const value = params.get(key);
      if (value) data[key] = value.slice(0, 120);
    }
    if (Object.keys(data).length === 0) return;
    data.landing = window.location.pathname.slice(0, 256);
    if (document.referrer) data.referrer = document.referrer.slice(0, 256);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(data))}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
  }, []);
  return null;
}
