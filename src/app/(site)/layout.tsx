import { EngagementProvider } from "@/components/engagement/engagement-provider";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AttributionCapture } from "@/components/marketing/attribution-capture";
import { enabledProviders } from "@/server/auth/options";
import { getSiteSettings } from "@/server/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { announcement } = await getSiteSettings();
  const announcing = announcement.enabled && announcement.text.length > 0;
  return (
    <EngagementProvider providers={enabledProviders()}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-gold-500 px-4 py-2 font-semibold text-navy-900 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AnnouncementBar announcement={announcement} />
      <SiteHeader offset={announcing} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <AttributionCapture />
    </EngagementProvider>
  );
}
