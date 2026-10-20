import type { NextConfig } from "next";
import { SPOTIFY_IMAGE_HOSTS, securityHeaders } from "./lib/security.ts";

const nextConfig: NextConfig = {
  // Produces a minimal self-contained server in .next/standalone for lean Docker images.
  output: "standalone",
  reactStrictMode: true,
  images: {
    // Spotify album art hosts — the one list lib/security.ts also allows in img-src.
    remotePatterns: SPOTIFY_IMAGE_HOSTS.map((origin) => {
      const { protocol, hostname } = new URL(origin);
      return { protocol: protocol.replace(":", "") as "https", hostname };
    }),
  },
  // Every response carries the security headers of lib/security.ts (one list,
  // tested there); the content security policy is report-only until a tour of
  // the Home Lab instance shows a clean console (docs/memory/architecture.md).
  headers: async () => [{ source: "/:path*", headers: securityHeaders() }],
};

export default nextConfig;
