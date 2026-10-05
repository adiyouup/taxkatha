import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Static shell + streamed dynamic holes; `use cache` for public reads.
  cacheComponents: true,
  // Unlisted [slug] pages get the App Shell instantly, then upgrade and cache.
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Excel imports. Vercel caps request bodies at 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
    // The dev cache makes restarts fast but pauses the server while it compacts,
    // which times out end-to-end tests. Test runs switch it off (see playwright.config.ts).
    turbopackFileSystemCacheForDev: process.env.NEXT_DEV_DISK_CACHE !== "off",
  },
  images: {
    qualities: [75, 90],
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
