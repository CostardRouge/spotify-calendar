import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { config, assertConfigured, COOKIE } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Kick off the Spotify Authorization Code flow. */
export async function GET() {
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
