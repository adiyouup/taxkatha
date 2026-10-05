"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PostPick } from "@/server/queries/admin-posts";

const STATUS_NOTE = { draft: "Draft", scheduled: "Scheduled", archived: "Archived", published: null } as const;

/**
 * Search-as-you-type picker over posts, by title or pasted link. Used wherever
 * an editor has to point at a ruling or an insight.
 */
export function PostPicker({
  type,
  onPick,
  label,
  placeholder = "Search by case name, or paste a link",
  disabledIds,
  className,
}: {
  type?: "case_law" | "insight";
  onPick: (post: PostPick) => void;
  label: string;
  placeholder?: string;
  /** Posts that cannot be picked again (already featured, already embedded). */
  disabledIds?: ReadonlySet<string>;
  className?: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostPick[] | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    if (value.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const abort = new AbortController();
      request.current = abort;
      try {
        const params = new URLSearchParams({ q: value });
        if (type) params.set("type", type);
        const response = await fetch(`/api/admin/posts/search?${params}`, { signal: abort.signal });
        const data = (await response.json()) as { results?: PostPick[] };
        setResults(data.results ?? []);
        setLoading(false);
      } catch {
        if (abort.signal.aborted) return;
        setResults([]);
        setLoading(false);
      }
    }, 220);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <Input id={inputId} value={query} onChange={(event) => search(event.target.value)} placeholder={placeholder} autoComplete="off" className="pr-10 pl-10" />
        {loading ? <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>

      <div aria-live="polite" className="min-h-24">
        {results === null ? (
          <p className="type-caption px-1 text-muted-foreground">Type at least two letters of the title, or paste a link.</p>
        ) : results.length === 0 ? (
          <p className="type-small px-1 text-muted-foreground">Nothing matches “{query.trim()}”.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
            {results.map((post) => {
              const taken = disabledIds?.has(post.id) ?? false;
              const note = STATUS_NOTE[post.status];
              return (
                <li key={post.id}>
                  <button
                    type="button"
                    disabled={taken}
                    onClick={() => onPick(post)}
                    className="w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    <span className="block text-sm leading-snug font-semibold text-foreground">{post.title}</span>
                    <span className="type-caption mt-0.5 block text-muted-foreground">
                      {[post.type === "insight" ? "Insight" : post.court, post.decisionDate ? formatDate(post.decisionDate) : null, note, taken ? "Already added" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
