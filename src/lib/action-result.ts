/** Uniform result for Server Actions — errors are returned, never thrown to the client. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "unauthenticated" | "forbidden" | "rate_limited" | "invalid" | "not_found" };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (
  error: string,
  code?: Extract<ActionResult, { ok: false }>["code"],
): ActionResult<never> => ({ ok: false, error, code });
