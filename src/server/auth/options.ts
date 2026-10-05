import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";
import { eq } from "drizzle-orm";

import { db } from "../db";
import * as schema from "../db/schema";
import { ac, roles } from "./permissions";

/*
 * Shared Better Auth options. `auth.ts` builds the real instance from these;
 * `dev-auth.ts` adds test helpers for local development and e2e tests.
 *
 * This file is loaded by the `auth` CLI, so it must not import "server-only"
 * and uses relative imports.
 */

const env = process.env;

export const PROVIDERS = ["google", "linkedin", "microsoft"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

function configured(id: ProviderId) {
  const prefix = id.toUpperCase();
  return Boolean(env[`${prefix}_CLIENT_ID`] && env[`${prefix}_CLIENT_SECRET`]);
}

/** Providers with credentials in the environment — the sign-in page shows only these. */
export function enabledProviders(): ProviderId[] {
  return PROVIDERS.filter(configured);
}

function adminEmails() {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
if (configured("google")) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID!,
    clientSecret: env.GOOGLE_CLIENT_SECRET!,
    prompt: "select_account",
  };
}
if (configured("linkedin")) {
  socialProviders.linkedin = {
    clientId: env.LINKEDIN_CLIENT_ID!,
    clientSecret: env.LINKEDIN_CLIENT_SECRET!,
  };
}
if (configured("microsoft")) {
  socialProviders.microsoft = {
    clientId: env.MICROSOFT_CLIENT_ID!,
    clientSecret: env.MICROSOFT_CLIENT_SECRET!,
    tenantId: "common",
    // Otherwise the Graph photo is stored as a base64 data URL in user.image
    // and bloats the session cookie past browser limits.
    disableProfilePhoto: true,
  };
}

export const authOptions = {
  appName: "TaxKatha",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      // Only Google's verified email may auto-link accounts. Microsoft's
      // multi-tenant ("common") email claim is controlled by the tenant admin
      // and must never be trusted for identity or roles.
      trustedProviders: ["google"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // GET /get-session never writes; the client hook refreshes via POST.
    deferSessionRefresh: true,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      profession: { type: "string", required: false, input: false },
      headline: { type: "string", required: false, input: false },
      onboardedAt: { type: "date", required: false, input: false },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false, input: false },
    },
    deleteUser: { enabled: true },
  },
  databaseHooks: {
    account: {
      create: {
        // Admin bootstrap: a verified GOOGLE sign-in whose email is listed in
        // ADMIN_EMAILS. Anyone else is promoted with `npm run grant-role`.
        async after(account) {
          if (account.providerId !== "google") return;
          const [row] = await db.select().from(schema.user).where(eq(schema.user.id, account.userId)).limit(1);
          if (!row || !row.emailVerified) return;
          if (!adminEmails().includes(row.email.toLowerCase())) return;
          if (row.role === "admin") return;
          await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, row.id));
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: { "/get-session": false },
  },
  advanced: {
    cookiePrefix: "taxkatha",
  },
  plugins: [
    admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),
    // Lets Vercel preview deployments sign in through the production callback.
    oAuthProxy(),
    // Must stay last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
} satisfies BetterAuthOptions;
