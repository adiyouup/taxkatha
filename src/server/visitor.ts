import "server-only";

import { createHash } from "node:crypto";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|linkedin|embedly|pingdom|lighthouse|headless|monitor|curl|wget|python-requests|axios|node-fetch/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent);
}

/**
 * A daily-rotating, salted hash of IP + user agent. It lets us count a
 * visitor once per day without storing an IP address or a persistent id.
 */
export function visitorHash(headers: Headers, day: string): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  const userAgent = headers.get("user-agent") ?? "";
  const salt = process.env.BETTER_AUTH_SECRET ?? "taxkatha";
  return createHash("sha256").update(`${salt}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
