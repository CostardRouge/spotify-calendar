import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import { sesameClient, sesameSettings } from "@/lib/sesame";
import { FLOW_COOKIE, FLOW_PATH, GATE_COOKIE, GATE_SECONDS, openFlow, originFrom, sealGate } from "@/lib/sesameGate";

export const dynamic = "force-dynamic";

const text = (body: string, status: number) =>
  new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * GET /api/auth/sesame/callback — Sésame's answer. Open (proxy.ts). The code
 * is exchanged with the verifier this browser's flow cookie kept, the state
 * and the ID token checked by openid-client; then the gate cookie that lets
 * this browser past proxy.ts. Who may reach this point with a code is
 * Sésame's decision (membership of the app `spotify-calendar` there).
 */
export async function GET(req: NextRequest) {
  const here = originFrom(req.headers, req.nextUrl.origin);
  const settings = sesameSettings();
  if (!settings) return NextResponse.redirect(new URL("/", here), 303);
  const flow = await openFlow(req.cookies.get(FLOW_COOKIE)?.value, settings.clientSecret);
  const clearFlow = (res: NextResponse) => {
    res.cookies.set(FLOW_COOKIE, "", { path: FLOW_PATH, maxAge: 0 });
    return res;
  };
  if (!flow) {
    // Too old, or started in another browser: start again, once, from home.
    return clearFlow(NextResponse.redirect(new URL("/api/auth/sesame/login?next=/", here), 303));
  }
  if (req.nextUrl.searchParams.has("error")) {
    return clearFlow(text("Sésame did not let you in: ask for access to Spotify Calendar in Sésame.", 403));
  }
  let sub: string | undefined;
  try {
    const current = new URL(`${here}${req.nextUrl.pathname}${req.nextUrl.search}`);
    const tokens = await oidc.authorizationCodeGrant(await sesameClient(settings), current, {
      pkceCodeVerifier: flow.verifier,
      expectedState: flow.state,
    });
    sub = tokens.claims()?.sub;
  } catch {
    sub = undefined;
  }
  if (!sub) return clearFlow(text("Sésame's answer could not be checked. Go back and try again.", 400));
  const res = clearFlow(NextResponse.redirect(new URL(flow.next, here), 303));
  res.cookies.set(GATE_COOKIE, await sealGate(sub, settings.clientSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_SECONDS,
  });
  return res;
}
