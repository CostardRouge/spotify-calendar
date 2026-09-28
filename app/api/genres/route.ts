import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/lib/session";
import { fetchArtistGenres } from "@/lib/spotify";
import { getCache, setCache } from "@/lib/cache";
import { noteRateLimit } from "@/lib/rateLimit";
import { isDemo, demoGenres } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Stop starting new Spotify lookups after this long, leaving the rest of the
 * 120s budget for a slow last request (apiGet's bounded retries) and the reply.
 */
const WORK_BUDGET_MS = 75_000;

/**
 * Genres cost one Spotify request per artist and barely change, so they are
 * kept far longer than the global cache TTL (see getCache). The `v2` prefix
 * abandons the old `genre:` entries: when the bulk endpoint started failing,
 * the previous code cached an empty list for every artist it asked about.
 */
const GENRE_TTL_MS = 30 * 24 * 3600 * 1000;
const key = (id: string) => `genre-v2:${id}`;

/**
 * POST { artistIds: string[] }
 *   -> { genres: { [artistId]: string[] }, pending: string[] }
 *
 * Genres are cached per artist, so overlapping artists across albums/tracks and
 * repeat syncs are free. Uncached artists are looked up one request at a time
 * (see fetchArtistGenres) until WORK_BUDGET_MS runs out; the ids not reached are
 * returned in `pending` for the client to send again. On 429/403 the genres
 * already resolved still travel in the error body, so no lookup is wasted.
 */
export async function POST(req: NextRequest) {
  if (isDemo()) {
    try {
      const body = await req.json();
      const ids = Array.isArray(body?.artistIds) ? body.artistIds.filter(Boolean) : [];
      return NextResponse.json({ genres: demoGenres(ids), pending: [] });
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
  }

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
    const c = getCache<string[]>(key(id), GENRE_TTL_MS);
    if (c) genres[id] = c.data;
    else missing.push(id);
  }

  let fetched = 0;
  let nonEmpty = 0;
  const pending = () => missing.filter((id) => !(id in genres));
  try {
    await fetchArtistGenres(
      auth.accessToken,
      missing,
      Date.now() + WORK_BUDGET_MS,
      (id, g, definitive) => {
        genres[id] = g;
        fetched++;
        if (g.length) nonEmpty++;
        // A transient failure is reported (so the client moves on) but not
        // cached, so the next sync asks again.
        if (definitive) setCache(key(id), g);
      },
    );
  } catch (e) {
    const status = (e as any)?.status;
    if (status === 401) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (status === 429) {
      // Surface the throttle so the client backs off and resumes later, instead
      // of returning 200 with empty genres (which silently left the genre filter
      // blank). Record it so the /api/ratelimit pre-flight sees it too.
      const retryAfter = Number((e as any)?.retryAfter) || 60;
      noteRateLimit(retryAfter);
      return NextResponse.json(
        { error: "rate_limited", detail: (e as any)?.message, retryAfter, genres },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    if (status === 403) {
      // Spotify refuses the artist endpoint itself. Every other artist would get
      // the same answer, so stop here and tell the client to end the phase.
      console.log("[GENRES] GET /artists/{id} answered 403 — genre lookup unavailable");
      return NextResponse.json(
        {
          error: "genres_unavailable",
          detail: "Spotify refused the artist lookup (403); genres cannot be loaded.",
          genres,
        },
        { status: 502 },
      );
    }
    // Anything else: best-effort, return what was resolved; the rest is pending.
  }

  if (missing.length) {
    // Diagnostic: if this stays 0 across a full sync, Spotify is returning no
    // genres at all (data-side) rather than us rate-limiting or mis-keying.
    console.log(
      `[GENRES] looked up ${fetched}/${missing.length} uncached artists, ${nonEmpty} with >=1 genre`,
    );
  }

  return NextResponse.json({ genres, pending: pending() });
}
