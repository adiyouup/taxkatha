import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

/*
 * Roles:
 *   user       — reads, likes, saves, shares, comments
 *   moderator  — also moderates comments and handles reports
 *   admin      — everything: content, imports, featured, users, settings
 * Only admins publish content; members discuss.
 */
export const ROLES = ["user", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

const statement = {
  ...defaultStatements,
  content: ["create", "update", "delete", "publish", "import", "boost"],
  comment: ["moderate"],
  settings: ["update"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  user: ac.newRole({ ...userAc.statements }),
  moderator: ac.newRole({ ...userAc.statements, comment: ["moderate"] }),
  admin: ac.newRole({
    ...adminAc.statements,
    content: ["create", "update", "delete", "publish", "import", "boost"],
    comment: ["moderate"],
    settings: ["update"],
  }),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Better Auth stores roles as a comma-separated string; the highest one wins. */
export function highestRole(value: string | null | undefined): Role {
  const list = (value ?? "user").split(",").map((r) => r.trim());
  if (list.includes("admin")) return "admin";
  if (list.includes("moderator")) return "moderator";
  return "user";
}
