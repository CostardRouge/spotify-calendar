# Spotify Web API

Read before touching anything that calls Spotify: pagination, genres, rate limits, scopes, playback.

## Batch artist genres, 50 ids per request — and do not undo this again (2026-08-20)

Spotify tags genres on **artists**, not on albums or tracks, so the genre filter depends entirely on resolving artist ids. This has been decided twice, in opposite directions:

- `f57200e` (2026-07-18) rewrote `fetchArtistGenresBatch()` to one request per artist, on the stated belief that "Spotify removed the GET /artists?ids= bulk endpoint in February 2026", and dropped `GENRE_CHUNK` from 400 to 200 to fit the 120s route budget.
- `89bf80d` reverted that: with ~4,300 unique artists in the maintainer's library, one-request-per-artist fires thousands of sequential calls, trips the rolling rate window almost immediately, and the resulting 429 aborts the whole genre phase **before any genre is applied** — so the filter and the Stats "Genres" count came up completely empty. The bulk endpoint was restored (50 ids per request, a few dozen calls for the same library) and the removal claim was called inaccurate in the commit body.

**How to apply**: `GET /artists?ids=` works. Do not "adapt" to a removal report without reproducing it against the live API first, and never resolve genres one artist at a time. The 120ms pause between chunks in `fetchArtistGenresBatch` is deliberate pacing — keep it.

## A rate-limit or auth error during the genre phase must propagate (2026-08-20)

`fetchArtistGenresBatch` swallows transient errors (those artists stay ungenred) but **rethrows** 429 and 401. Swallowing them returns an empty genre map, the sync marks itself "done", and the user is left with a silently empty filter and no reason to retry — the exact bug above. **How to apply**: keep the `if (status === 429 || status === 401) throw` branch; when adding a new best-effort lookup, make the same distinction.

## Never retry into a long ban; pre-flight the cooldown instead (2026-08-20)

`apiGet` treats 429 in two ways: if `Retry-After` is ≤ 10s and fewer than 5 waits have happened, it sleeps and retries; anything longer becomes a typed error carrying `retryAfter`, and the sync pauses and tells the user when to come back. The reason is that **any request made during an active ban counts against the app and can prolong the cooldown** — retrying into one makes it worse.

`lib/rateLimit.ts` therefore records the cooldown in the server process and `GET /api/ratelimit` lets the client ask "may I sync yet?" **without** making a Spotify call. `SyncProvider` pre-flights it before firing. The record is in-memory only (a restart clears it) because the client persists the cooldown too, and the two together cover the common cases.

**How to apply**: do not add a Spotify call to any polling path, and do not remove the pacing sleeps (250ms between library pages, 120ms between genre chunks) — they exist to stay under the rolling window on large libraries, not as arbitrary caution.

The cooldown is **deployment-wide on purpose**: a 429 applies to the whole app (one Spotify client id), not to one user. Same for the artist→genre cache — that is global Spotify data. Everything else is keyed per user (see `data-and-sync.md`).

## Bounded retries everywhere (2026-08-20)

`MAX_RETRIES = 4` (5xx / network, exponential back-off), `MAX_RATE_WAITS = 5`, `MAX_RATE_WAIT_MS = 10_000`. Every retry path is capped so a call always settles in finite time — the routes run under a `maxDuration` budget and an unbounded retry would blow it. **How to apply**: any new retry loop needs a cap.

## 401 vs 403 (2026-08-20)

401 = token/scope problem (see the scope-drift note in `architecture.md`). 403 on a Spotify endpoint = the account is not Premium; the playback control endpoints require Premium, and so does `GET /me/player`. Both are translated to typed errors in `apiGet`/`apiSend` and mapped in `lib/playerErrors.ts` — do not let a 403 fall through to the generic branch, it becomes a 502 in the browser.

## Login forces the consent screen (2026-08-20)

`/api/auth/login` forces Spotify's consent screen rather than silently reusing an existing grant, so that newly added scopes are actually granted (`afeca9a`). Do not "optimise" that away: a silent re-auth returns a token missing the new scope and reintroduces scope drift.
