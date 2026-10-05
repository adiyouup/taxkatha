"use server";

import "server-only";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";

import { PROFESSION_VALUES } from "@/lib/professions";
import { auth } from "@/server/auth/auth";
import { getFreshViewer } from "@/server/auth/dal";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { reconcileCounters } from "@/server/maintenance";

export type ProfileState = { error: string | null; saved: boolean };

const profileSchema = z.object({
  profession: z.enum(PROFESSION_VALUES, { error: "Choose the option that fits you best." }),
  headline: z
    .string()
    .trim()
    .max(80, "Keep this under 80 characters.")
    .transform((v) => (v.length ? v : null)),
  marketingOptIn: z.boolean(),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const viewer = await getFreshViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent("/settings")}`);

  const parsed = profileSchema.safeParse({
    profession: formData.get("profession"),
    headline: String(formData.get("headline") ?? ""),
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form.", saved: false };

  await db
    .update(user)
    .set({ ...parsed.data, onboardedAt: sql`coalesce(${user.onboardedAt}, now())` })
    .where(eq(user.id, viewer.id));
  // Refresh the signed cookie cache so the header and discussions show the change.
  await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  return { error: null, saved: true };
}

/**
 * Permanently deletes the member's account and personal data (DPDP right to
 * erasure). Their comments are erased but leave a "deleted" slot so other
 * members' replies keep their context; likes, saves and notifications go.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const viewer = await getFreshViewer();
  if (!viewer) redirect("/sign-in");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") redirect("/settings?delete=unconfirmed");

  const requestHeaders = await headers();
  // A database trigger erases the member's comments before the row is removed;
  // sessions, linked accounts, likes, saves, reports and notifications cascade.
  await db.delete(user).where(eq(user.id, viewer.id));
  await reconcileCounters();

  // Clears the auth cookies; the session rows are already gone.
  await auth.api.signOut({ headers: requestHeaders }).catch(() => undefined);
  redirect("/?account=deleted");
}
