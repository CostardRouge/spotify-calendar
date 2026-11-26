/**
 * The public origin a request was made to, rebuilt from its headers — for the
 * absolute URLs link previews need (og:image and og:url must be absolute, and
 * Next's metadataBase is how relative ones become so).
 *
 * Why from the request: the Docker image is built once by CI and pulled by
 * whoever runs it, so nothing set at build time knows the address it will be
 * reached at — the previous fallback baked http://127.0.0.1:3000 into every
 * preview — and one instance is often reached as a LAN address, a domain
 * behind a proxy and localhost all at once. Behind a proxy the original scheme
 * and host arrive in X-Forwarded-Proto / X-Forwarded-Host (Next's own server
 * fills them in when nothing upstream did); a chain may list several,
 * comma-separated, and the first is the client-facing one.
 *
 * Trusting a client-supplied header is harmless here: it only shapes the
 * metadata of the response sent back to that same client. The host is still
 * held to hostname characters, so a forged value cannot smuggle markup or
 * another scheme into the page; anything else yields null, and the caller
 * falls back to relative URLs. Pure (no Next import), so tests/origin.test.ts
 * runs it directly.
 */
export function requestOrigin(get: (name: string) => string | null): URL | null {
  const first = (v: string | null) => v?.split(",")[0]?.trim().toLowerCase() || null;
  const host = first(get("x-forwarded-host")) ?? first(get("host"));
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:.]+\](:\d{1,5})?$/.test(host)) return null;
  const proto = first(get("x-forwarded-proto"));
  const scheme = proto === "https" || proto === "http" ? proto : "http";
  try {
    return new URL(`${scheme}://${host}`);
  } catch {
    return null;
  }
}
