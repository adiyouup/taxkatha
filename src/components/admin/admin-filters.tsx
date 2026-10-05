"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A GET form for list filters. Without JavaScript it submits normally; with
 * it, empty fields are dropped from the URL and selects apply as soon as they
 * change. Filters live in the URL, so every view can be bookmarked and shared.
 */
export function AdminFilters({ action, children, className }: { action: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    }
    const query = params.toString();
    startTransition(() => router.push(query ? `${action}?${query}` : action, { scroll: false }));
  }

  return (
    <form
      action={action}
      method="get"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        const target = event.target;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "date"))) {
          apply(event.currentTarget);
        }
      }}
      className={cn("flex flex-wrap items-center gap-2", pending && "[&_[data-filter-spinner]]:opacity-100", className)}
    >
      {children}
      <Loader2 data-filter-spinner aria-hidden className="size-4 animate-spin text-muted-foreground opacity-0 transition-opacity" />
    </form>
  );
}

/** Search box for an `AdminFilters` form (submits on Enter). */
export function FilterSearch({ name = "q", defaultValue, placeholder, label }: { name?: string; defaultValue?: string; placeholder: string; label: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-56">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
        className="h-10 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground hover:border-navy-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
      />
    </div>
  );
}

/** A select for an `AdminFilters` form; applies on change. */
export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={defaultValue ?? ""}
      className={cn(
        // A fixed width (the open list still shows full option names) keeps a row of filters on one line.
        "select-chevron h-10 w-full cursor-pointer truncate rounded-md border border-input bg-card pr-9 pl-3 text-sm text-foreground transition-colors hover:border-navy-300 sm:w-44",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
