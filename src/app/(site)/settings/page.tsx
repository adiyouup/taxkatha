import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";

import { ConnectedAccounts, DeleteAccount, ProfileForm } from "@/components/auth/settings-forms";
import { UserAvatar } from "@/components/auth/user-avatar";
import { PageHeader, Section } from "@/components/layout/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateLong } from "@/lib/format";
import { requireViewer } from "@/server/auth/dal";
import { enabledProviders } from "@/server/auth/options";
import { db } from "@/server/db";
import { account, user } from "@/server/db/schema";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-soft">
      <div className="border-b px-6 py-5">
        <h2 className="type-display-sm">{title}</h2>
        {description ? <p className="type-caption mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

async function SettingsContent() {
  const viewer = await requireViewer("/settings");
  const [[profile], accounts] = await Promise.all([
    db.select({ marketingOptIn: user.marketingOptIn, createdAt: user.createdAt }).from(user).where(eq(user.id, viewer.id)).limit(1),
    db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, viewer.id)),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar name={viewer.name} image={viewer.image} size="lg" className="size-14" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold text-foreground">{viewer.name}</p>
          <p className="type-small truncate text-muted-foreground">
            {viewer.email}
            {profile ? ` · member since ${formatDateLong(profile.createdAt)}` : ""}
          </p>
        </div>
      </div>

      <Card title="Profile" description="Your name and photo come from the account you sign in with.">
        <ProfileForm profession={viewer.profession} headline={viewer.headline} marketingOptIn={profile?.marketingOptIn ?? false} />
      </Card>

      <Card title="Sign-in methods" description="Connect another provider to sign in with either.">
        <ConnectedAccounts available={enabledProviders()} linked={accounts.map((a) => a.providerId)} />
      </Card>

      <Card title="Delete account" description="Remove your account and personal data from TaxKatha.">
        <DeleteAccount />
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Your account" title="Settings" />
      <Section className="py-10 md:py-14">
        <div className="container-wide max-w-2xl">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
            <SettingsContent />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
