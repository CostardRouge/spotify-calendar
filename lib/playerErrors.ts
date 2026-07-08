import { NextResponse } from "next/server";
import { noteRateLimit } from "./rateLimit";

/**
 * Map an error thrown by the Spotify player helpers to a friendly JSON
 * response. Shared by all /api/player/* control routes so behaviour is
 * consistent (401 re-auth, 403 Premium, 404 no device, 429 back-off).
 */
export function mapPlayerError(e: unknown): NextResponse {
  const status = (e as any)?.status;

  if (status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (status === 403) {
    return NextResponse.json(
      {
        error: "premium_required",
        detail: "Playback control requires Spotify Premium.",
      },
      { status: 403 },
    );
  }
  if (status === 404) {
    return NextResponse.json(
      {
        error: "no_active_device",
        detail: "No active Spotify device. Open Spotify or pick a device.",
      },
      { status: 404 },
    );
  }
  if (status === 429) {
    const retryAfter = Number((e as any).retryAfter) || 60;
    noteRateLimit(retryAfter);
    return NextResponse.json(
      { error: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return NextResponse.json(
    { error: "player_failed", detail: (e as Error).message },
    { status: 502 },
  );
}
