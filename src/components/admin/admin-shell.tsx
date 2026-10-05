"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  PenLine,
  Scale,
  Settings2,
  Star,
  Tags,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { UserAvatar } from "@/components/auth/user-avatar";
import { BrandLockup } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AdminViewer = { name: string; email: string; image: string | null; role: "moderator" | "admin" };

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; adminOnly?: boolean; badge?: "reports" };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  {
    title: "Content",
    items: [
      { href: "/admin/case-laws", label: "Case laws", icon: Scale, adminOnly: true },
      { href: "/admin/insights", label: "Insights", icon: PenLine, adminOnly: true },
      { href: "/admin/featured", label: "Featured", icon: Star, adminOnly: true },
      { href: "/admin/taxonomy", label: "Topics and courts", icon: Tags, adminOnly: true },
      { href: "/admin/import", label: "Import", icon: FileSpreadsheet, adminOnly: true },
    ],
  },
  {
    title: "Community",
    items: [
      { href: "/admin/community", label: "Moderation", icon: MessagesSquare, badge: "reports" },
      { href: "/admin/users", label: "Members", icon: Users, adminOnly: true },
    ],
  },
  { title: "Growth", items: [{ href: "/admin/marketing", label: "Marketing", icon: TrendingUp, adminOnly: true }] },
  {
    title: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings2, adminOnly: true },
      { href: "/admin/audit", label: "Audit log", icon: History, adminOnly: true },
    ],
  },
];

function NavLinks({ role, openReports, onNavigate }: { role: AdminViewer["role"]; openReports: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
      {NAV.map((group) => {
        const items = group.items.filter((item) => !item.adminOnly || role === "admin");
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="type-eyebrow px-3 text-[0.625rem] text-gold-500/90">{group.title}</p>
            <ul className="mt-2.5 space-y-0.5">
              {items.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] font-medium text-paper/75 transition-colors hover:bg-white/6 hover:text-paper",
                        active && "bg-white/8 text-paper before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-gold-500",
                      )}
                    >
                      <Icon strokeWidth={1.5} className={cn("size-4.5", active ? "text-gold-400" : "text-paper/60")} />
                      {label}
                      {badge === "reports" && openReports > 0 ? (
                        <span className="ml-auto rounded-full bg-gold-500 px-2 py-0.5 text-[0.6875rem] font-bold text-navy-900 tabular-nums">
                          {openReports}
                          <span className="sr-only"> open reports</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBody({ viewer, openReports, onNavigate }: { viewer: AdminViewer; openReports: number; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Link href="/admin" onClick={onNavigate} className="rounded-sm">
          <BrandLockup tone="reverse" />
        </Link>
      </div>
      <NavLinks role={viewer.role} openReports={openReports} onNavigate={onNavigate} />
      <div className="shrink-0 space-y-3 border-t border-white/10 p-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-paper/70 transition-colors hover:text-paper"
        >
          <ExternalLink strokeWidth={1.5} className="size-4" /> View site
        </Link>
        <div className="flex items-center gap-3 px-2">
          <UserAvatar name={viewer.name} image={viewer.image} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-paper">{viewer.name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{viewer.role}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminShell({ viewer, openReports, children }: { viewer: AdminViewer; openReports: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-paper-2 lg:pl-64">
      <aside className="theme-navy fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex">
        <SidebarBody viewer={viewer} openReports={openReports} />
      </aside>

      <div className="theme-navy sticky top-0 z-30 flex h-14 items-center justify-between px-4 lg:hidden">
        <BrandLockup tone="reverse" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger aria-label="Open admin menu" className="flex size-10 items-center justify-center rounded-md text-paper">
            <Menu strokeWidth={1.5} className="size-6" />
          </SheetTrigger>
          <SheetContent side="left" className="theme-navy w-72 gap-0 border-r-0 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Admin menu</SheetTitle>
            <SheetDescription className="sr-only">Admin navigation</SheetDescription>
            <SidebarBody viewer={viewer} openReports={openReports} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
