/**
 * Only same-site relative paths are allowed as post-login destinations —
 * never absolute or protocol-relative URLs (open-redirect protection).
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  if (value.startsWith("/sign-in") || value.startsWith("/api/")) return fallback;
  return value;
}
