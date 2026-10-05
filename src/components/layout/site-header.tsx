"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, Menu, Search } from "lucide-react";

import { HeaderAuth, MobileAuth } from "@/components/auth/header-auth";
import { BrandLockup } from "@/components/brand/logo";
import { GoldRule } from "@/components/brand/motif";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { mainNav, siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  const base = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(`${base}/`) || pathname === base;
}

function DesktopLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-8">
      {mainNav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "gold-underline pb-1 text-[0.9375rem] font-medium text-paper/80 transition-colors hover:text-paper",
                active && "bg-size-[100%_1px] text-paper",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** `usePathname` suspends on routes whose params aren't known at build time. */
function ActiveDesktopLinks() {
  return <DesktopLinks pathname={usePathname()} />;
}

/** `offset`: an announcement bar is shown above the header, so it starts below the bar. */
export function SiteHeader({ offset = false }: { offset?: boolean }) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "theme-navy group/header fixed inset-x-0 z-40 bg-transparent transition-[top,background-color,box-shadow,backdrop-filter] duration-300",
        offset && !scrolled ? "top-11 sm:top-9" : "top-0",
        "data-[scrolled=true]:bg-navy-900/88 data-[scrolled=true]:shadow-[0_1px_0_rgb(212_175_55/0.28)] data-[scrolled=true]:backdrop-blur-md",
      )}
    >
      <div className="container-wide flex h-18 items-center justify-between gap-6 transition-[height] duration-300 group-data-[scrolled=true]/header:h-15">
        <Link href="/" aria-label={`${siteConfig.name} home`} className="rounded-sm">
          <BrandLockup tone="reverse" />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <Suspense fallback={<DesktopLinks pathname={null} />}>
            <ActiveDesktopLinks />
          </Suspense>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/case-laws"
            aria-label="Search case laws"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-paper/85 hover:text-paper")}
          >
            <Search strokeWidth={1.5} className="size-5" />
          </Link>

          <div className="hidden items-center gap-3 sm:flex">
            <HeaderAuth />
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-paper lg:hidden")}
            >
              <Menu strokeWidth={1.5} className="size-6" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="theme-navy grain w-full gap-0 border-l-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
            >
              <div className="flex h-18 items-center px-4 sm:px-6">
                <BrandLockup tone="reverse" />
              </div>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
              <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 pt-6 sm:px-6">
                <ul className="flex flex-col">
                  {mainNav.map((item) => (
                    <li key={item.href} className="border-b border-white/10">
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="group flex items-center justify-between py-5"
                      >
                        <span>
                          <span className="type-display-md block text-paper">{item.label}</span>
                          {item.description ? (
                            <span className="type-small mt-1 block text-muted-foreground">{item.description}</span>
                          ) : null}
                        </span>
                        <ArrowRight
                          strokeWidth={1.5}
                          className="size-5 text-gold-500 transition-transform group-hover:translate-x-1"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="space-y-5 px-4 pt-6 pb-8 sm:px-6">
                <MobileAuth onNavigate={() => setMenuOpen(false)} />
                <GoldRule />
                <p className="type-eyebrow text-center text-[0.625rem] text-gold-500">{siteConfig.tagline}</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
