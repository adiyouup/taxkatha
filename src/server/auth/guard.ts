import "server-only";

import { fail, type ActionResult } from "@/lib/action-result";
import { AuthError, authorize, type Viewer } from "@/server/auth/dal";
import type { Role } from "@/server/auth/permissions";

export type Guarded = { ok: true; viewer: Viewer } | { ok: false; result: ActionResult<never> };

/**
 * Role check for admin Server Actions: returns the viewer, or the error to
 * send back. Reads the session from the database, so a demotion or ban
 * applies to the very next action.
 */
export async function guard(minimum: Role): Promise<Guarded> {
  try {
    return { ok: true, viewer: await authorize(minimum) };
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    return {
      ok: false,
      result: fail(
        error.code === "unauthenticated" ? "Your session has expired. Please sign in again." : "You do not have permission to do that.",
        error.code,
      ),
    };
  }
}
