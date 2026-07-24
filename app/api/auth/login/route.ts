import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { config, assertConfigured, appBaseUrl, COOKIE } from "@/lib/config";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

/** Kick off the Spotify Authorization Code flow. */
export async function GET() {
  // Demo mode has no auth — "Connect" drops straight into the app.
  if (isDemo()) return NextResponse.redirect(new URL("/month", appBaseUrl));

  try {
    assertConfigured();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: config.scopes,
    redirect_uri: config.redirectUri,
    state,
    // Force the consent screen so a returning user whose prior grant predates a
    // newly-added scope re-approves it. Without this, Spotify may silently
    // reuse the old (narrower) grant, and refreshed tokens keep 401-ing on the
    // newly-scoped endpoints ("scope drift").
    show_dialog: "true",
  });

  const res = NextResponse.redirect(
    "https://accounts.spotify.com/authorize?" + params.toString(),
  );
  res.cookies.set(COOKIE.state, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
