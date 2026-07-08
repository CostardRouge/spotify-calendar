import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken, SCOPE_PLAYBACK_MODIFY } from "@/lib/session";
import { play } from "@/lib/spotify";
import { mapPlayerError, scopeGuard } from "@/lib/playerErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Start/resume playback: POST /api/player/play
 * Body: { contextUri?: string, uris?: string[], deviceId?: string }
 * With no contextUri/uris, resumes the current track.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guard = scopeGuard(auth.scope, [SCOPE_PLAYBACK_MODIFY]);
  if (guard) return guard;
  let payload: { contextUri?: string; uris?: string[]; deviceId?: string } = {};
  try {
    const text = await req.text();
    if (text) payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    await play(auth.accessToken, payload);
    const res = NextResponse.json({ ok: true });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
