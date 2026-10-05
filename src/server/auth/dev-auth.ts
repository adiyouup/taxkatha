import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";

import { authOptions } from "./options";

/*
 * A second auth instance with Better Auth's test helpers. It shares the
 * database and secret with the real instance, so sessions it mints are valid
 * everywhere. Imported ONLY by the development login route and e2e setup —
 * never by production code paths.
 */
export const devAuth = betterAuth({
  ...authOptions,
  plugins: [testUtils(), ...authOptions.plugins],
});
