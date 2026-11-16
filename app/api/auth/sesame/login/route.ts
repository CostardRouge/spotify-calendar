import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import { sesameClient, sesameSettings } from "@/lib/sesame";
import { CALLBACK_PATH, FLOW_COOKIE, FLOW_PATH, FLOW_SECONDS, originFrom, safeNext, sealFlow } from "@/lib/sesameGate";

export const dynamic = "force-dynamic";

/** GET /api/auth/sesame/login?next=/path → Sésame, with PKCE and a state. Open (proxy.ts). */
export async function GET(req: NextRequest) {
  const here = originFrom(req.headers, req.nextUrl.origin);
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const settings = sesameSettings();
  if (!settings) return NextResponse.redirect(new URL(next, here), 303);
  try {
    const client = await sesameClient(settings);
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const target = oidc.buildAuthorizationUrl(client, {
      redirect_uri: `${here}${CALLBACK_PATH}`,
      scope: "openid profile email",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
    });
    const res = NextResponse.redirect(target, 303);
    res.cookies.set(FLOW_COOKIE, await sealFlow({ state, verifier, next }, settings.clientSecret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: FLOW_PATH,
      maxAge: FLOW_SECONDS,
    });
    return res;
  } catch {
    return new NextResponse("Sésame cannot be reached right now. Try again in a moment.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
