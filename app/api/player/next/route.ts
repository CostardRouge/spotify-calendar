import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken, SCOPE_PLAYBACK_MODIFY } from "@/lib/session";
import { next } from "@/lib/spotify";
import { mapPlayerError, scopeGuard } from "@/lib/playerErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Skip to next track: POST /api/player/next  Body: { deviceId?: string } */
export async function POST(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guard = scopeGuard(auth.scope, [SCOPE_PLAYBACK_MODIFY]);
  if (guard) return guard;
  let deviceId: string | undefined;
  try {
    const text = await req.text();
    if (text) deviceId = JSON.parse(text)?.deviceId;
  } catch {
    /* no body is fine */
  }
  try {
    await next(auth.accessToken, deviceId);
    const res = NextResponse.json({ ok: true });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
