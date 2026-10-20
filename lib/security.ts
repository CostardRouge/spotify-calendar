// The headers every response carries (COMMON-PROJECT-SPEC C16 in second-brain,
// a `page` rule). ONE list, read by next.config.ts, which applies it to every
// path — pages, API routes and the files of public/ alike — so the standalone
// server the Home Lab image runs sends it with no proxy in front;
// tests/security.test.ts holds the list to what the app really loads.
//
// The Content-Security-Policy is REPORT-ONLY: it blocks nothing and only lists
// in the browser console what an enforced policy would have blocked. It is
// enforced once a tour of the Home Lab instance (every view, a sync, the
// mini-player) comes back with a clean console (docs/memory/architecture.md,
// "Security headers"). What the policy allows is what the pages load:
//   - scripts: this origin, plus the inline scripts Next's hydration and
//     app/layout.tsx's panel bootstrap carry ('unsafe-inline' — a nonce
//     through a proxy.ts is the way to drop it, the day enforcement is
//     weighed); in development React also needs 'unsafe-eval' to rebuild
//     server stacks in the browser (Next's own guide), never in production;
//   - styles: this origin and the inline style attributes React writes;
//   - images: this origin, data: (globals.css's grain) and Spotify's album-art
//     hosts, the same list next.config.ts hands to next/image — covers are
//     plain <img> tags straight from those hosts;
//   - fonts: this origin (the stacks are system fonts, nothing is fetched);
//   - connections: this origin — the browser only ever talks to /api/*,
//     Spotify is called by the server; no form posts anywhere;
//   - nothing framed, no plugins, no <base> rewriting.
// No report-uri: the console is the report for a self-hosted, one-household app.

/** Where Spotify serves album art from; <img> tags load them directly. */
export const SPOTIFY_IMAGE_HOSTS = [
  "https://i.scdn.co",
  "https://mosaic.scdn.co",
  "https://image-cdn-ak.spotifycdn.com",
  "https://image-cdn-fa.spotifycdn.com",
] as const;

const CSP_DIRECTIVES = (development: boolean) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: ${SPOTIFY_IMAGE_HOSTS.join(" ")}`,
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
];

export const contentSecurityPolicy = (development = false): string =>
  CSP_DIRECTIVES(development).join("; ");

export type Header = { key: string; value: string };

/** The headers of every response, for the `nodeEnv` the server runs in. */
export function securityHeaders(nodeEnv: string | undefined = process.env.NODE_ENV): Header[] {
  return [
    // A browser only honours HSTS over https, so the header costs nothing on
    // a plain-http LAN address and protects the instance behind a TLS proxy.
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Nothing here is meant to be framed; `frame-ancestors` says it again for
    // the browsers that read the policy, this one for the ones that do not.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(nodeEnv === "development") },
  ];
}
