/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal self-contained server in .next/standalone for lean Docker images.
  output: "standalone",
  reactStrictMode: true,
  // The dev container is reachable as both localhost and 127.0.0.1; Next.js
  // treats them as distinct origins and blocks HMR/RSC requests from any
  // origin not listed here, which breaks client-side hydration entirely.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  images: {
    // Spotify album art hosts.
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "image-cdn-ak.spotifycdn.com" },
      { protocol: "https", hostname: "image-cdn-fa.spotifycdn.com" },
    ],
  },
};

export default nextConfig;
