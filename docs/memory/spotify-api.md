# Spotify Web API

Read before touching anything that calls Spotify: pagination, genres, rate limits, scopes, playback.

## No genres: Spotify withholds them, and the feature is gone (2026-11-27)

**Measured** on the Home Lab instance (a Claude session on the Optiplex, the app's own client credentials, 18 calls in all): `GET /v1/artists/{id}` and artist objects in `GET /v1/search` come back **without a `genres` key** (nor `popularity`, `followers`); `GET /v1/albums/{id}` has `genres: []`; simplified albums have none; the search filter `genre:"french hip hop"` returns 0 results and `genre:rap` 18 obscure artists — not a usable index; `GET /artists?ids=` and `GET /browse/categories` answer 403. The docs only mark `genres` "Deprecated" and say Extended Quota apps are unaffected; in practice a Development Mode app gets nothing, direct or derived. Before this was known, the lookup cached an empty list per artist (5,682 files) and the genre phase never let a sync finish, so the server library copy went stale from 2026-09-28.

**Decision** (the owner, 2026-11-27): no third-party genre source — "I won't take two providers for one small piece of information"; the genre filter was not used; what matters is seeing the likes. The feature is **removed**: no filter, no sync phase, no `/api/genres`, no `genres` on `Album`, no genre stats. `lib/cache.ts` is reduced to `purgeLegacyCache`, run at each server start by `instrumentation.ts`, which deletes the top-level `*.json` of `CACHE_DIR` (only genre entries ever lived there; `library/` is untouched). For the record, a lab on the Optiplex measured Wikidata (P1902 Spotify id → P136 genre, batch SPARQL, no key) at 42.8 % of 4,371 artists / 63 % of items in 2.4 min, and Deezer at 95.5 % of a 200-artist sample with 30 % ambiguous name matches (`~/sillon-genres-lab/REPORT.md` on the Optiplex). **How to apply**: do not reintroduce genres from Spotify; if the owner ever wants them back, Wikidata is the cheapest exact-match source measured.

## Never retry into a long ban; pre-flight the cooldown instead (2026-08-20)

`apiGet` treats 429 in two ways: if `Retry-After` is ≤ 10s and fewer than 5 waits have happened, it sleeps and retries; anything longer becomes a typed error carrying `retryAfter`, and the sync pauses and tells the user when to come back. The reason is that **any request made during an active ban counts against the app and can prolong the cooldown** — retrying into one makes it worse.

`lib/rateLimit.ts` therefore records the cooldown in the server process and `GET /api/ratelimit` lets the client ask "may I sync yet?" **without** making a Spotify call. `SyncProvider` pre-flights it before firing. The record is in-memory only (a restart clears it) because the client persists the cooldown too, and the two together cover the common cases.

**How to apply**: do not add a Spotify call to any polling path, and do not remove the pacing sleep (250ms between library pages) — it exists to stay under the rolling window on large libraries, not as arbitrary caution.

The cooldown is **deployment-wide on purpose**: a 429 applies to the whole app (one Spotify client id), not to one user. Everything else is keyed per user (see `data-and-sync.md`).

## Bounded retries everywhere (2026-08-20)

`MAX_RETRIES = 4` (5xx / network, exponential back-off), `MAX_RATE_WAITS = 5`, `MAX_RATE_WAIT_MS = 10_000`. Every retry path is capped so a call always settles in finite time — the routes run under a `maxDuration` budget and an unbounded retry would blow it. **How to apply**: any new retry loop needs a cap.

## 401 vs 403 (2026-08-20)

401 = token/scope problem (see the scope-drift note in `architecture.md`). 403 on a Spotify endpoint = the account is not Premium; the playback control endpoints require Premium, and so does `GET /me/player`. Both are translated to typed errors in `apiGet`/`apiSend` and mapped in `lib/playerErrors.ts` — do not let a 403 fall through to the generic branch, it becomes a 502 in the browser.

## Login forces the consent screen (2026-08-20)

`/api/auth/login` forces Spotify's consent screen rather than silently reusing an existing grant, so that newly added scopes are actually granted (`afeca9a`). Do not "optimise" that away: a silent re-auth returns a token missing the new scope and reintroduces scope drift.
