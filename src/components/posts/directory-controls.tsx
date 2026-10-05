"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { directoryHref, type DirectoryParams } from "@/lib/directory-params";
import { cn } from "@/lib/utils";

/** The large search field in the page header. "/" focuses it. */
export function DirectorySearch({
  params,
  basePath = "/case-laws",
  placeholder,
  className,
}: {
  params: DirectoryParams;
  basePath?: string;
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(params.q ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(q: string) {
    startTransition(() => router.push(directoryHref(params, { q: q.trim() || undefined, sort: undefined }, basePath)));
  }

  return (
    <form
      role="search"
      action={basePath}
      onSubmit={(event) => {
        event.preventDefault();
        go(value);
      }}
      className={cn("relative", className)}
    >
      <label htmlFor="directory-search" className="sr-only">
        Search case laws
      </label>
      <Search strokeWidth={1.5} className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gold-500" aria-hidden />
      <input
        ref={inputRef}
        id="directory-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-14 w-full rounded-lg border border-white/18 bg-white/8 pr-32 pl-12 text-base text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] outline-none transition-[border-color,background-color] placeholder:text-paper/50 hover:border-white/30 focus-visible:border-gold-500 focus-visible:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              if (params.q) go("");
              inputRef.current?.focus();
            }}
            className="flex size-9 items-center justify-center rounded-md text-paper/60 hover:text-paper"
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="mr-1 hidden rounded-xs border border-white/20 px-1.5 py-0.5 font-sans text-[0.6875rem] text-paper/50 sm:block">/</kbd>
        )}
        <Button type="submit" size="default" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Search
        </Button>
      </div>
    </form>
  );
}

/** A native select that writes one URL param. */
export function ParamSelect({
  name,
  value,
  options,
  params,
  basePath = "/case-laws",
  label,
  allLabel,
  className,
}: {
  name: "court" | "sort" | "topic" | "section";
  value: string | undefined;
  options: { value: string; label: string; group?: string }[];
  params: DirectoryParams;
  basePath?: string;
  label: string;
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const option of options) {
    const key = option.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }

  return (
    <label className={cn("block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        aria-label={label}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value || undefined;
          startTransition(() => router.push(directoryHref(params, { [name]: next }, basePath), { scroll: false }));
        }}
        className="select-chevron h-10 w-full cursor-pointer rounded-md border border-input bg-card pl-3 text-sm text-foreground transition-colors hover:border-navy-300 disabled:opacity-60"
      >
        {allLabel ? <option value="">{allLabel}</option> : null}
        {[...groups].map(([group, items]) =>
          group ? (
            <optgroup key={group} label={group}>
              {items.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            items.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </select>
    </label>
  );
}

/** Decision-date range. Applies as soon as a valid date is picked. */
export function DateRange({
  params,
  basePath = "/case-laws",
  min,
  max,
}: {
  params: DirectoryParams;
  basePath?: string;
  min?: string;
  max?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const set = (key: "from" | "to", value: string) => {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    startTransition(() => router.push(directoryHref(params, { [key]: value || undefined }, basePath), { scroll: false }));
  };
  const field =
    "h-10 w-full rounded-md border border-input bg-card px-2.5 text-sm text-foreground transition-colors hover:border-navy-300";

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="type-caption mb-1 block text-muted-foreground">From</span>
        <input type="date" defaultValue={params.from ?? ""} min={min} max={params.to ?? max} onChange={(e) => set("from", e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="type-caption mb-1 block text-muted-foreground">To</span>
        <input type="date" defaultValue={params.to ?? ""} min={params.from ?? min} max={max} onChange={(e) => set("to", e.target.value)} className={field} />
      </label>
    </div>
  );
}

/** On small screens the filter panel lives in a bottom sheet. */
export function FiltersSheet({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-gold-600 lg:hidden">
        <SlidersHorizontal strokeWidth={1.5} className="size-4" />
        Filters
        {activeCount > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-gold-500 text-[0.6875rem] font-bold text-navy-900">{activeCount}</span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <SheetTitle className="font-display text-lg font-semibold">Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow the list of rulings</SheetDescription>
        </div>
        {/* Navigating closes the sheet: every filter is a link or pushes a URL. */}
        <div className="overflow-y-auto px-5 py-5" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {children}
        </div>
        <div className="border-t p-4">
          <Button className="w-full" size="lg" onClick={() => setOpen(false)}>
            Show results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
