/** Share links carry UTM tags and, for members, a referral id — so signups can be attributed. */

export type ShareChannel = "native" | "whatsapp" | "linkedin" | "x" | "telegram" | "email" | "copy_link" | "story_card" | "square_card";

export function shareUrl(origin: string, path: string, channel: ShareChannel, refUserId: string | null): string {
  const url = new URL(path, origin);
  url.searchParams.set("utm_source", channel === "copy_link" || channel === "native" ? "share" : channel.replace("_card", ""));
  url.searchParams.set("utm_medium", channel === "email" ? "email" : "social");
  url.searchParams.set("utm_campaign", "member_share");
  if (refUserId) url.searchParams.set("ref", refUserId);
  return url.toString();
}

export function intentUrl(channel: "whatsapp" | "linkedin" | "x" | "telegram" | "email", url: string, title: string): string {
  const text = `${title} — TaxKatha`;
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;
  }
}
