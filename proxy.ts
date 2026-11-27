import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateOpen, gatePublic, originFrom } from "./lib/sesameGate";

/**
 * Sésame in front of the whole app, when SESAME_ISSUER, SESAME_CLIENT_ID and
 * SESAME_CLIENT_SECRET are set (lib/sesame.ts); without them — and in demo
 * mode — every request passes, as before. The Spotify sign-in stays behind
 * it, unchanged: Sésame says who may use this instance at all, Spotify whose
 * library it shows.
 *
 * Left open: the round trip to Sésame (/api/auth/sesame/*), the Docker
 * healthcheck (/api/health) and, through the matcher, the files a phone or a
 * link preview fetches with no cookie: Next's static files, the icon set, the
 * manifest, the preview card, the service worker and its offline page, and
 * robots.txt (tests/pwa.test.ts checks the matcher both ways).
 */
export async function proxy(req: NextRequest) {
  const secret = process.env.SESAME_CLIENT_SECRET;
  const configured = Boolean(process.env.SESAME_ISSUER && process.env.SESAME_CLIENT_ID && secret);
  if (!configured || process.env.DEMO_MODE === "1") return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (gatePublic(pathname)) return NextResponse.next();
  if (await gateOpen(req.cookies.get(GATE_COOKIE)?.value, secret as string)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "sign in through Sésame" }, { status: 401 });
  const here = originFrom(req.headers, req.nextUrl.origin);
  const login = new URL("/api/auth/sesame/login", here);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|og-image.png|sw.js|offline.html|robots.txt).*)"],
};
