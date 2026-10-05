/*
 * Reading admin list filters from the URL. Every value is checked against
 * what the page allows, so a hand-edited URL can only ever select a valid view.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** The first value of a parameter, trimmed; undefined when absent or empty. */
export function param(params: RawSearchParams, key: string, max = 200): string | undefined {
  const raw = params[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, max);
  return value ? value : undefined;
}

/** A parameter restricted to a fixed set of values. */
export function oneOf<T extends string>(params: RawSearchParams, key: string, allowed: readonly T[]): T | undefined {
  const value = param(params, key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** A 1-based page number. */
export function pageParam(params: RawSearchParams): number {
  const page = Number(param(params, "page"));
  return Number.isInteger(page) && page > 1 && page < 10_000 ? page : 1;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidParam(params: RawSearchParams, key: string): string | undefined {
  const value = param(params, key);
  return value && UUID.test(value) ? value.toLowerCase() : undefined;
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Builds `path?query` from the current filters plus changes; empty values are dropped. */
export function hrefWith(path: string, current: Record<string, string | number | undefined>, changes: Record<string, string | number | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
