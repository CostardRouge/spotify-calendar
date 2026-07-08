import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/lib/session";
import { fetchArtistGenresBatch } from "@/lib/spotify";
import { getCache, setCache } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST { artistIds: string[] } -> { genres: { [artistId]: string[] } }
 * Genres are looked up per artist and cached individually, so repeat calls
 * (and overlapping artists across albums/tracks) are nearly free.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let ids: string[] = [];
  try {
    const body = await req.json();
    ids = Array.isArray(body?.artistIds) ? body.artistIds.filter(Boolean) : [];
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  ids = [...new Set(ids)];

  const genres: Record<string, string[]> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const c = getCache<string[]>(`genre:${id}`);
    if (c) genres[id] = c.data;
    else missing.push(id);
  }

  if (missing.length) {
    try {
      const fetched = await fetchArtistGenresBatch(auth.accessToken, missing);
      for (const id of missing) {
        const g = fetched[id] ?? [];
        genres[id] = g;
        setCache(`genre:${id}`, g);
      }
    } catch (e) {
      if ((e as any)?.status === 401) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      // Best-effort: return whatever we resolved from cache.
    }
  }

  return NextResponse.json({ genres });
}
