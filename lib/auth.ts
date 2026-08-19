import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { COOKIE } from "./config";
import type { SpotifyTokens } from "./types";

const isProd = process.env.NODE_ENV === "production";

/** Read the current session tokens from httpOnly cookies. */
export async function readSession() {
  // `cookies()` is async as of Next 15 — the request store is resolved lazily.
  const c = await cookies();
  return {
    access: c.get(COOKIE.access)?.value ?? null,
    refresh: c.get(COOKIE.refresh)?.value ?? null,
    expires: Number(c.get(COOKIE.expires)?.value ?? "0"),
    // Scopes granted at authorization time. Empty for sessions minted before we
    // began tracking this — treated as "unknown" (never blocks) by callers.
    scope: c.get(COOKIE.scope)?.value ?? "",
    // Spotify user id of the session owner. Empty for sessions minted before
    // per-user isolation — resolved lazily (and cookied) by /api/me.
    userId: c.get(COOKIE.userId)?.value ?? "",
  };
}

/** Persist the Spotify user id of the session owner onto a response. */
export function writeUserIdCookie(res: NextResponse, userId: string) {
  res.cookies.set(COOKIE.userId, userId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // matches the refresh token's lifetime
  });
}

/** Persist tokens onto a response as httpOnly cookies. */
export function writeTokenCookies(res: NextResponse, tokens: SpotifyTokens) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days for refresh token
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookies.set(COOKIE.access, tokens.access_token, {
    ...common,
    maxAge: tokens.expires_in,
  });
  if (tokens.refresh_token) {
    res.cookies.set(COOKIE.refresh, tokens.refresh_token, {
      ...common,
      maxAge,
    });
  }
  res.cookies.set(
    COOKIE.expires,
    String(Date.now() + (tokens.expires_in - 60) * 1000),
    { ...common, maxAge },
  );
  // Track the granted scopes so we can detect "scope drift" — a refresh token
  // minted before new scopes were added yields access tokens that still lack
  // them, which surfaces as a 401 on the newly-scoped endpoints. Refresh
  // responses echo the scope, so this stays current across refreshes.
  if (tokens.scope !== undefined) {
    res.cookies.set(COOKIE.scope, tokens.scope, { ...common, maxAge });
  }
}

/** Remove all auth cookies from a response. */
export function clearAuthCookies(res: NextResponse) {
  [COOKIE.access, COOKIE.refresh, COOKIE.expires, COOKIE.scope, COOKIE.state, COOKIE.userId].forEach((name) =>
    res.cookies.set(name, "", { path: "/", maxAge: 0 }),
  );
}
