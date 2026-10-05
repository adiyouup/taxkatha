"use server";

import "server-only";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";

import { PROFESSION_VALUES } from "@/lib/professions";
import { safeNextPath } from "@/lib/safe-redirect";
import { auth } from "@/server/auth/auth";
import { getFreshViewer } from "@/server/auth/dal";
import { db } from "@/server/db";
import { user, userAcquisition } from "@/server/db/schema";

export type OnboardingState = { error: string | null };

const schema = z.object({
  profession: z.enum(PROFESSION_VALUES, { error: "Choose the option that fits you best." }),
  headline: z
    .string()
    .trim()
    .max(80, "Keep this under 80 characters.")
    .transform((v) => (v.length ? v : null)),
  marketingOptIn: z.boolean(),
});

const attributionSchema = z
  .object({
    utm_source: z.string().max(120).optional(),
    utm_medium: z.string().max(120).optional(),
    utm_campaign: z.string().max(160).optional(),
    utm_content: z.string().max(160).optional(),
    utm_term: z.string().max(160).optional(),
    ref: z.string().max(64).optional(),
    landing: z.string().max(512).optional(),
    referrer: z.string().max(512).optional(),
  })
  .partial();

async function recordAttribution(userId: string) {
  const jar = await cookies();
  const raw = jar.get("tk_attrib")?.value;
  if (!raw) return;
  jar.delete("tk_attrib");

  let parsed: z.infer<typeof attributionSchema>;
  try {
    parsed = attributionSchema.parse(JSON.parse(raw));
  } catch {
    return;
  }

  // The referrer must be a real member other than this one.
  let refUserId: string | null = null;
  if (parsed.ref && parsed.ref !== userId) {
    const [ref] = await db.select({ id: user.id }).from(user).where(eq(user.id, parsed.ref)).limit(1);
    refUserId = ref?.id ?? null;
  }

  await db
    .insert(userAcquisition)
    .values({
      userId,
      utmSource: parsed.utm_source ?? null,
      utmMedium: parsed.utm_medium ?? null,
      utmCampaign: parsed.utm_campaign ?? null,
      utmContent: parsed.utm_content ?? null,
      utmTerm: parsed.utm_term ?? null,
      refUserId,
      landingPath: parsed.landing ?? null,
      referrer: parsed.referrer ?? null,
    })
    .onConflictDoNothing();
}

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const next = safeNextPath(formData.get("next"), "/");
  const viewer = await getFreshViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent("/welcome")}`);

  const parsed = schema.safeParse({
    profession: formData.get("profession"),
    headline: String(formData.get("headline") ?? ""),
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  await db
    .update(user)
    .set({ ...parsed.data, onboardedAt: new Date() })
    .where(eq(user.id, viewer.id));
  await recordAttribution(viewer.id);

  // Refresh the signed cookie cache so the header reflects the new profile.
  await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });

  redirect(next);
}
