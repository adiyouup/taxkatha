/**
 * Grants a role to an existing member (they must have signed in once).
 *   npm run grant-role -- person@example.com admin
 *   npm run grant-role -- person@example.com moderator
 *   npm run grant-role -- person@example.com user
 */
import "./_env";

import { eq } from "drizzle-orm";

import { isRole } from "../src/server/auth/permissions";
import { db, pool } from "../src/server/db";
import { auditLog, session, user } from "../src/server/db/schema";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !isRole(role)) {
    console.error("usage: npm run grant-role -- <email> <user|moderator|admin>");
    process.exit(2);
  }

  const [row] = await db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1);
  if (!row) {
    console.error(`No member with email ${email}. Ask them to sign in once, then run this again.`);
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    await tx.update(user).set({ role }).where(eq(user.id, row.id));
    // Force a fresh session so the new role applies immediately.
    await tx.delete(session).where(eq(session.userId, row.id));
    await tx.insert(auditLog).values({
      action: "user.role.grant",
      entityType: "user",
      entityId: row.id,
      summary: `Role set to ${role} for ${row.email} (CLI)`,
      meta: { from: row.role, to: role },
    });
  });

  console.log(`${row.email} is now ${role}. They need to sign in again.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
