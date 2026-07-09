import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import {
  resolveAccessToken,
  SCOPE_PLAYBACK_MODIFY,
  SCOPE_PLAYBACK_READ,
} from "@/lib/session";
import { queue, getAlbumTrackUris, getQueue } from "@/lib/spotify";
import { mapPlayerError, scopeGuard } from "@/lib/playerErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read the current playback queue: GET /api/player/queue
 * Returns { queue: { nowPlaying, upNext } }. Requires playback-read scope.
 */
export async function GET() {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guard = scopeGuard(auth.scope, [SCOPE_PLAYBACK_READ]);
  if (guard) return guard;
  try {
    const queueState = await getQueue(auth.accessToken);
    const res = NextResponse.json({ queue: queueState });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}

// Cap how many tracks a single request may enqueue, so an unusually long album
// (or an accidental huge uris list) can never blow past the route's time budget.
const MAX_QUEUE = 60;

/**
 * Add item(s) to the playback queue: POST /api/player/queue
 * Body: { uris?: string[], contextUri?: string (album), deviceId?: string }
 *
 * The Spotify queue endpoint takes a single track/episode uri per call, so an
 * album `contextUri` is expanded into its tracks and each is enqueued in order.
 * Queueing requires an already-active device; callers should therefore only hit
 * this when something is playing (otherwise start playback instead).
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guard = scopeGuard(auth.scope, [SCOPE_PLAYBACK_MODIFY]);
  if (guard) return guard;

  let payload: { uris?: string[]; contextUri?: string; deviceId?: string } = {};
  try {
    const text = await req.text();
    if (text) payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    let uris = payload.uris ?? [];
    // Expand an album context into its ordered track uris.
    const albumMatch = (payload.contextUri ?? "").match(/^spotify:album:(.+)$/);
    if (albumMatch) {
      uris = await getAlbumTrackUris(auth.accessToken, albumMatch[1]);
    }
    if (!uris.length) {
      return NextResponse.json(
        { error: "bad_request", detail: "Nothing to queue." },
        { status: 400 },
      );
    }

    const toQueue = uris.slice(0, MAX_QUEUE);
    for (let i = 0; i < toQueue.length; i++) {
      await queue(auth.accessToken, toQueue[i], payload.deviceId);
      // Gentle pacing between calls keeps a multi-track album under Spotify's
      // rolling rate window.
      if (i < toQueue.length - 1) await sleep(80);
    }

    const res = NextResponse.json({ ok: true, queued: toQueue.length });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
