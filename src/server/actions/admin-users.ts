"use server";

import "server-only";

import { and, eq, ne, or, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/server/audit";
import { guard } from "@/server/auth/guard";
import { highestRole } from "@/server/auth/permissions";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { session, user } from "@/server/db/schema";
import { reconcileCounters } from "@/server/maintenance";

/*
 * Member administration. Administrators only. An admin cannot act on their
 * own account here, staff must be demoted before they can be banned or
 * deleted, and the last administrator can never be demoted.
 */

const idSchema = z.string().min(1).max(64);

async function loadTarget(userId: string) {
  const [target] = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned }).from(user).where(eq(user.id, userId)).limit(1);
  return target ? { ...target, role: highestRole(target.role) } : null;
}

const roleSchema = z.object({ userId: idSchema, role: z.enum(["user", "moderator", "admin"]) });

export async function setUserRole(input: { userId: string; role: string }): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a role.", "invalid");
  const { userId, role } = parsed.data;
  if (userId === auth.viewer.id) return fail("You cannot change your own role. Ask another administrator.", "forbidden");

  const target = await loadTarget(userId);
  if (!target) return fail("This member no longer exists.", "not_found");
  if (target.role === role) return ok(undefined);
  if (target.banned && role !== "user") return fail("Lift the ban before giving this member a staff role.", "invalid");

  const outcome = await db.transaction(async (tx) => {
    // Serialise role changes so two admins cannot demote each other at once.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('taxkatha:roles'))`);
    if (target.role === "admin") {
      const [others] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(user)
        .where(and(ne(user.id, userId), sql`${user.role} like '%admin%'`, or(sql`${user.banned} is null`, eq(user.banned, false))));
      if (!others || others.n === 0) return false;
    }
    await tx.update(user).set({ role }).where(eq(user.id, userId));
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "user.role",
      entityType: "user",
      entityId: userId,
      summary: `Changed ${target.name}’s role from ${target.role} to ${role}`,
    });
    return true;
  });

  if (!outcome) return fail("TaxKatha needs at least one administrator. Promote someone else first.", "invalid");
  refresh();
  return ok(undefined);
}

const banSchema = z.object({
  userId: idSchema,
  reason: z.string().trim().min(3, "Give a short reason; it is recorded in the audit log.").max(300),
  days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).nullable(),
});

/** Blocks sign-in and signs the member out everywhere. Their comments stay unless moderated. */
export async function banUser(input: { userId: string; reason: string; days: number | null }): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.", "invalid");
  const { userId, reason, days } = parsed.data;
  if (userId === auth.viewer.id) return fail("You cannot ban yourself.", "forbidden");

  const target = await loadTarget(userId);
  if (!target) return fail("This member no longer exists.", "not_found");
  if (target.role !== "user") return fail("Remove this member’s staff role before banning them.", "invalid");

  const banExpires = days ? new Date(Date.now() + days * 86_400_000) : null;
  await db.transaction(async (tx) => {
    await tx.update(user).set({ banned: true, banReason: reason, banExpires }).where(eq(user.id, userId));
    await tx.delete(session).where(eq(session.userId, userId));
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "user.ban",
      entityType: "user",
      entityId: userId,
      summary: `Banned ${target.name} ${days ? `for ${days} day${days === 1 ? "" : "s"}` : "permanently"}: ${reason}`,
    });
  });
  refresh();
  return ok(undefined);
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  if (!idSchema.safeParse(userId).success) return fail("Unknown member.", "invalid");

  const [target] = await db.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, userId)).returning({ name: user.name });
  if (!target) return fail("This member no longer exists.", "not_found");
  await writeAudit(db, { actorId: auth.viewer.id, action: "user.unban", entityType: "user", entityId: userId, summary: `Lifted the ban on ${target.name}` });
  refresh();
  return ok(undefined);
}

export async function signOutEverywhere(userId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  if (!idSchema.safeParse(userId).success) return fail("Unknown member.", "invalid");
  if (userId === auth.viewer.id) return fail("Use Sign out in your own account menu instead.", "forbidden");

  const target = await loadTarget(userId);
  if (!target) return fail("This member no longer exists.", "not_found");
  const removed = await db.delete(session).where(eq(session.userId, userId)).returning({ id: session.id });
  await writeAudit(db, {
    actorId: auth.viewer.id,
    action: "user.sign_out",
    entityType: "user",
    entityId: userId,
    summary: `Signed ${target.name} out of ${removed.length} session${removed.length === 1 ? "" : "s"}`,
  });
  refresh();
  return ok({ count: removed.length });
}

/**
 * Permanently deletes a member (for example on an erasure request). Their
 * comments are erased but leave a placeholder; likes, saves and sessions go.
 */
export async function deleteMember(input: { userId: string; confirmEmail: string }): Promise<ActionResult> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  const parsed = z.object({ userId: idSchema, confirmEmail: z.string().trim().max(320) }).safeParse(input);
  if (!parsed.success) return fail("Unknown member.", "invalid");
  const { userId, confirmEmail } = parsed.data;
  if (userId === auth.viewer.id) return fail("Delete your own account from your settings page.", "forbidden");

  const target = await loadTarget(userId);
  if (!target) return fail("This member no longer exists.", "not_found");
  if (target.role !== "user") return fail("Remove this member’s staff role before deleting the account.", "invalid");
  if (confirmEmail.toLowerCase() !== target.email.toLowerCase()) return fail("Type the member’s email address exactly to confirm.", "invalid");

  await db.transaction(async (tx) => {
    // A database trigger erases their comments before the row goes.
    await tx.delete(user).where(eq(user.id, userId));
    // The audit entry deliberately records no name or email: the account was erased.
    await writeAudit(tx, { actorId: auth.viewer.id, action: "user.delete", entityType: "user", entityId: userId, summary: "Deleted a member account and its personal data" });
  });
  await reconcileCounters();
  updateTag(TAGS.posts);
  updateTag(TAGS.trending);
  return ok(undefined);
}
