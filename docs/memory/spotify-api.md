# Spotify Web API

Read before touching anything that calls Spotify: pagination, genres, rate limits, scopes, playback.

## Genres are withheld from this app: Spotify answers artists without a `genres` field (2026-11-27)

**Measured** on the Home Lab instance (a Claude session on the Optiplex, the app's own client credentials, one call): `GET /v1/artists/{id}` → 200 with `external_urls, href, id, images, name, type, uri` only — **no `genres`, `popularity`, `followers` keys at all**. The docs still list `genres` as "Deprecated" and not removed, and say Extended Quota apps are unaffected: in practice a Development Mode app gets no genres. Every genre ever cached here was empty (4,371 `genre:` + 1,311 `genre-v2:` files, back to 2026-09-28); 0 of 7,478 library items had a genre; and the genre phase never finished a sync, so the server library copy had not been rewritten since 2026-09-28. **Decision**: an absent field ≠ an empty array. `fetchArtistGenres` throws `genresWithheld` on the first such answer; the route caches `genres-withheld` deployment-wide for 7 days (one re-probe a week, so genres return by themselves if Spotify restores them), purges the empty `genre-v2:` entries and, once per process, the legacy `genre:` files (`purgeCache`, `lib/cache.ts`), and answers `genres_unavailable` — the client ends the phase and the sync completes. The filter panel explains the empty list. **How to apply**: genres now need a source outside Spotify (Last.fm tags, MusicBrainz via the Spotify-URL relation, Deezer album genres) — a new external dependency, the owner's call (MEMORY.md, open items). Do not "fix" this by lowering the pace or bumping the cache prefix: the data is not there.

## Genres: one paced request per artist, because the bulk endpoint is gone (2026-09-28)

Spotify tags genres on **artists** only. A saved track, a saved album and the simplified artist objects inside them carry none (`album.genres` is documented as always empty), so genres cannot be derived from the downloaded library — the maintainer asked for exactly that on 2026-09-28, and it is not possible without an artist lookup.

`GET /artists?ids=` ("Get Several Artists") **was removed** for Development Mode apps in the February 2026 Web API change (existing apps migrated 2026-03-09); the same change stripped `popularity`/`followers`. The note that stood here from 2026-08-20 ("`GET /artists?ids=` works", `89bf80d` calling the removal "inaccurate") was wrong: `f57200e` had the diagnosis right. Its per-artist version failed for two other reasons: results were returned only at the end, so the first 429 discarded a whole chunk of fetched artists, and it fired ~12 requests/s. `GET /artists/{id}` still returns `genres`.

**How to apply**: `fetchArtistGenres` reports each artist through a callback that caches it immediately, paces at `ARTIST_PACE_MS` (400 ms, a guess — Spotify does not publish the Dev Mode limit), and stops at a deadline so `/api/genres` fits its 120 s budget, returning unreached ids in `pending`. Genre cache entries live 30 days (`getCache(key, maxAgeMs)`), not the 1 h global TTL — otherwise every hourly refresh re-queries every genre-less artist. The key prefix is `genre-v2:` because the dead bulk call left an empty list cached for every artist under `genre:`. First pass on the maintainer's ~4,300 artists is ~30 min plus any 429 pause. If a genre source outside Spotify is ever needed (Last.fm tags, MusicBrainz), it would be a new external dependency — not tried yet.

## A rate-limit, auth or 403 error during the genre phase must propagate (2026-09-28)

`fetchArtistGenres` reports transient failures as non-definitive (not cached, retried next sync) and 404/400 as definitive empty, but **rethrows** 429, 401 and 403. Swallowing a 429/401 returns empty genres, the sync marks itself "done", and the filter stays silently empty. A 403 means the endpoint is refused for everyone: the route answers `genres_unavailable` and the client ends the phase instead of firing thousands of doomed calls. Error bodies still carry the genres resolved before the failure. **How to apply**: when adding a best-effort lookup, make the same distinction.

## Never retry into a long ban; pre-flight the cooldown instead (2026-08-20)

`apiGet` treats 429 in two ways: if `Retry-After` is ≤ 10s and fewer than 5 waits have happened, it sleeps and retries; anything longer becomes a typed error carrying `retryAfter`, and the sync pauses and tells the user when to come back. The reason is that **any request made during an active ban counts against the app and can prolong the cooldown** — retrying into one makes it worse.

`lib/rateLimit.ts` therefore records the cooldown in the server process and `GET /api/ratelimit` lets the client ask "may I sync yet?" **without** making a Spotify call. `SyncProvider` pre-flights it before firing. The record is in-memory only (a restart clears it) because the client persists the cooldown too, and the two together cover the common cases.

**How to apply**: do not add a Spotify call to any polling path, and do not remove the pacing sleeps (250ms between library pages, 400ms between artist lookups) — they exist to stay under the rolling window on large libraries, not as arbitrary caution.

The cooldown is **deployment-wide on purpose**: a 429 applies to the whole app (one Spotify client id), not to one user. Same for the artist→genre cache — that is global Spotify data. Everything else is keyed per user (see `data-and-sync.md`).

## Bounded retries everywhere (2026-08-20)

`MAX_RETRIES = 4` (5xx / network, exponential back-off), `MAX_RATE_WAITS = 5`, `MAX_RATE_WAIT_MS = 10_000`. Every retry path is capped so a call always settles in finite time — the routes run under a `maxDuration` budget and an unbounded retry would blow it. **How to apply**: any new retry loop needs a cap.

## 401 vs 403 (2026-08-20)

401 = token/scope problem (see the scope-drift note in `architecture.md`). 403 on a Spotify endpoint = the account is not Premium; the playback control endpoints require Premium, and so does `GET /me/player`. Both are translated to typed errors in `apiGet`/`apiSend` and mapped in `lib/playerErrors.ts` — do not let a 403 fall through to the generic branch, it becomes a 502 in the browser.

## Login forces the consent screen (2026-08-20)

`/api/auth/login` forces Spotify's consent screen rather than silently reusing an existing grant, so that newly added scopes are actually granted (`afeca9a`). Do not "optimise" that away: a silent re-auth returns a token missing the new scope and reintroduces scope drift.
