import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies, writeUserIdCookie } from "@/lib/auth";
import { resolveUserId } from "@/lib/session";
import { readLibrary, writeLibrary } from "@/lib/libraryStore";
import { isDemo } from "@/lib/demo";
import type { Album } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Hard cap on an uploaded snapshot (~50MB of JSON covers very large libraries).
const MAX_BODY_BYTES = 50 * 1024 * 1024;

/**
 * Per-user server copy of the synced library, keyed by the authenticated
 * Spotify account. GET returns this user's snapshot (never anyone else's);
 * PUT replaces this user's snapshot only.
 */
export async function GET() {
  if (isDemo()) return NextResponse.json({ snapshot: null });

  const resolved = await resolveUserId();
  if (!resolved) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ snapshot: readLibrary(resolved.userId) });
  if (resolved.refreshed) writeTokenCookies(res, resolved.refreshed);
  if (resolved.cookieMissing) writeUserIdCookie(res, resolved.userId);
  return res;
}

export async function PUT(req: NextRequest) {
  if (isDemo()) return NextResponse.json({ ok: true });

  const resolved = await resolveUserId();
  if (!resolved) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let items: Album[];
  let likedSongs: number;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    const body = JSON.parse(raw);
    if (!Array.isArray(body?.items)) throw new Error("items must be an array");
    items = body.items;
    likedSongs = Number(body.likedSongs) || 0;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ok = writeLibrary(resolved.userId, items, likedSongs);
  const res = NextResponse.json({ ok });
  if (resolved.refreshed) writeTokenCookies(res, resolved.refreshed);
  if (resolved.cookieMissing) writeUserIdCookie(res, resolved.userId);
  return res;
}
