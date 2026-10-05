import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/site";
import { getSiteSettings } from "@/server/settings";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

/** Defaults for every page; the home title and description are editable in Admin → Settings. */
export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteSettings();
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: seo.title, template: `%s · ${siteConfig.name}` },
    description: seo.description,
    applicationName: siteConfig.name,
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      url: siteConfig.url,
      title: seo.title,
      description: seo.description,
    },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0A1F44",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${manrope.variable} ${playfair.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {/* Scroll-reveal content starts hidden; without JavaScript it must simply be visible. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
