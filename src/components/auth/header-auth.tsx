"use client";

import Link from "next/link";
import { Bell, Bookmark, LayoutDashboard, LogOut, Settings } from "lucide-react";

import { UserAvatar } from "@/components/auth/user-avatar";
import { useEngagement } from "@/components/engagement/engagement-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { professionShort } from "@/lib/professions";
import { cn } from "@/lib/utils";

const itemClass = "gap-3 px-3 py-2.5 text-[0.9375rem]";

function signOut() {
  void authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        // A hard reload on purpose: the client router cache may still hold
        // signed-in (gated) pages, and those must not survive sign-out.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      },
    },
  });
}

function isStaff(role: string | null | undefined) {
  return (role ?? "").split(",").some((r) => r === "admin" || r === "moderator");
}

/** Desktop header: avatar menu when signed in, otherwise Sign in + Get Started. */
export function HeaderAuth() {
  const { data, isPending } = authClient.useSession();
  const { unread } = useEngagement();

  if (isPending) {
    return <span aria-hidden className="h-9 w-40 animate-pulse rounded-md bg-white/8" />;
  }

  if (!data) {
    return (
      <>
        <Link
          href="/sign-in"
          className="gold-underline px-1 pb-1 text-[0.9375rem] font-medium text-paper/85 transition-colors hover:text-paper"
        >
          Sign in
        </Link>
        <Link href="/sign-in" className={buttonVariants({ size: "sm" })}>
          Get Started
        </Link>
      </>
    );
  }

  const { user } = data;
  const badge = professionShort(user.profession);

  return (
    <>
      <Link
        href="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-10 items-center justify-center rounded-md text-paper/85 transition-colors hover:bg-white/8 hover:text-paper"
      >
        <Bell strokeWidth={1.5} className="size-5" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[0.625rem] leading-none font-bold text-navy-900">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full outline-offset-4 ring-1 ring-gold-500/50 transition-shadow hover:ring-gold-400 aria-expanded:ring-2 aria-expanded:ring-gold-400"
      >
        <UserAvatar name={user.name} image={user.image} size="lg" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-lg p-1.5 shadow-lift">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2.5">
            <span className="block truncate text-[0.9375rem] font-semibold text-foreground">{user.name}</span>
            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
              {badge ? `${badge} · ` : ""}
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClass} render={<Link href="/saved" />}>
          <Bookmark strokeWidth={1.5} /> Saved
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClass} render={<Link href="/notifications" />}>
          <Bell strokeWidth={1.5} /> Notifications
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClass} render={<Link href="/settings" />}>
          <Settings strokeWidth={1.5} /> Settings
        </DropdownMenuItem>
        {isStaff(user.role) ? (
          <DropdownMenuItem className={itemClass} render={<Link href="/admin" />}>
            <LayoutDashboard strokeWidth={1.5} /> Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClass} onClick={signOut}>
          <LogOut strokeWidth={1.5} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}

/** Mobile menu footer: account links when signed in, otherwise the two CTAs. */
export function MobileAuth({ onNavigate }: { onNavigate: () => void }) {
  const { data, isPending } = authClient.useSession();

  if (isPending) return <span aria-hidden className="block h-12 animate-pulse rounded-md bg-white/8" />;

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Link href="/sign-in" onClick={onNavigate} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Sign in
        </Link>
        <Link href="/sign-in" onClick={onNavigate} className={buttonVariants({ size: "lg" })}>
          Get Started
        </Link>
      </div>
    );
  }

  const { user } = data;
  const links = [
    { href: "/saved", label: "Saved" },
    { href: "/notifications", label: "Notifications" },
    { href: "/settings", label: "Settings" },
    ...(isStaff(user.role) ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UserAvatar name={user.name} image={user.image} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-paper">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: "outline" }), "justify-start")}
          >
            {l.label}
          </Link>
        ))}
        <button type="button" onClick={signOut} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}>
          Sign out
        </button>
      </div>
    </div>
  );
}
