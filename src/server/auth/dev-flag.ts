/** True only in local development with DEV_LOGIN=true. Never true in production builds. */
export function devLoginEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";
}
