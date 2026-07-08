import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/spotify";
import { writeTokenCookies } from "@/lib/auth";
import { COOKIE, appBaseUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Spotify redirects here with ?code & ?state after the user approves. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const savedState = cookies().get(COOKIE.state)?.value;

  // Use the configured public base URL, not the (possibly internal) request host.
  const origin = appBaseUrl;

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/login?error=state_mismatch`);
  }

  try {
    const tokens = await exchangeCode(code);
    const res = NextResponse.redirect(origin + "/");
    writeTokenCookies(res, tokens);
    res.cookies.set(COOKIE.state, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }
}
