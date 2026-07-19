import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/lib/session";
import { fetchArtistGenresBatch } from "@/lib/spotify";
import { getCache, setCache } from "@/lib/cache";

export const dynamic = "force-dynamic";
// Keep the route's own budget UNDER a typical 100s CDN edge timeout (e.g.
// Cloudflare Free/Pro cut at a hard 100s and return their own 502). With the
// small client-side GENRE_CHUNK a normal chunk finishes in ~10s; capping at 60s
// means that in the worst case the route returns its own error the client can
// handle/resume, instead of the proxy killing it with an opaque 502.
export const maxDuration = 60;

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
      if ((e as any)?.status === 429) {
        // Surface the throttle so the client backs off and can resume later,
        // instead of us returning 200 with empty genres (which silently leaves
        // the genre filter blank for a large library).
        const retryAfter = Number((e as any)?.retryAfter) || 60;
        return NextResponse.json(
          { error: "rate_limited", detail: (e as any)?.message, retryAfter },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
      }
      // Best-effort: return whatever we resolved from cache.
    }
  }

  return NextResponse.json({ genres });
}
