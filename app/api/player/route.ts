import { NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken, SCOPE_PLAYBACK_READ } from "@/lib/session";
import { getPlaybackState } from "@/lib/spotify";
import { mapPlayerError, scopeGuard } from "@/lib/playerErrors";
import { clearRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Current playback state for the mini-player: GET /api/player */
export async function GET() {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guard = scopeGuard(auth.scope, [SCOPE_PLAYBACK_READ]);
  if (guard) return guard;
  try {
    const state = await getPlaybackState(auth.accessToken);
    clearRateLimit();
    const res = NextResponse.json({ state });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
