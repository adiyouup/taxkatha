import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "T";
}

/** Member avatar. Falls back to gold-on-navy initials (Microsoft sign-ins have no photo). */
export function UserAvatar({
  name,
  image,
  size = "default",
  className,
}: {
  name: string;
  image?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {image && !image.startsWith("data:") ? (
        <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback
        className={cn("bg-navy-900 font-semibold tracking-wide text-gold-400", size === "lg" ? "text-sm" : "text-xs")}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
