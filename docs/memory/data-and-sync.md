# Data & sync

Read before touching the sync loop, the client snapshot, the sync-job record, the server caches or the per-user library store.

## Everything user-scoped is keyed by Spotify user id (2026-08-20)

The app was single-user in practice until `acfb785`: the IndexedDB snapshot and the sync-job record used fixed keys, so a second account logging in on the same browser saw the first account's library and a sync merged both into one snapshot. Now the session is pinned to the Spotify user id at login (`sp_uid`, httpOnly; `/api/me` resolves and cookies it lazily for older sessions), and three things are keyed by it: the IndexedDB snapshot (`lib/clientCache.ts`), the localStorage sync job (`lib/sync.ts`), and the server-side library files (`lib/libraryStore.ts`).

Two things stay **deployment-wide by design** because they hold app-level, not user-level, data: the artist→genre cache and the rate-limit cooldown (see `spotify-api.md`).

Pre-isolation records are *claimed* by the first account that logs in after the upgrade (its owner, on a personal browser); an anonymous visitor may read them but never claim them. **How to apply**: any new persisted artefact must be keyed per user id from the start, and must decide explicitly what an anonymous visitor (`ANON_USER_ID = "anon"`) sees.

## IndexedDB, not localStorage, for the library snapshot (2026-08-20)

localStorage caps around 5 MB and is synchronous, so large libraries skipped the client cache entirely and every reload or redeploy meant a full re-sync. IndexedDB has no practical cap and survives both. Migrated in `afeca9a`. The sync *job* record (small, frequently patched) stays in localStorage — that split is intentional. **How to apply**: bump `SCHEMA_VERSION` in `lib/clientCache.ts` whenever the persisted `Album`/`Snapshot` shape changes, so old snapshots are invalidated into a clean re-sync instead of feeding a mismatched shape into the UI. `LIBRARY_SCHEMA_VERSION` in `lib/libraryStore.ts` plays the same role server-side.

There is deliberately **no time-based expiry** on the client snapshot: it is the user's durable copy, replaced only by their own next sync.

## The sync loop resumes rather than restarts (2026-08-20)

The page offset is derived from what is already held (`itemsRef.current.filter(kind).length`), not from a stored cursor, so an interrupted-and-resumed run neither gaps nor duplicates — `appendUnique` covers the overlap. A snapshot is persisted every 5 pages (`SNAPSHOT_EVERY_PAGES`) so a crash costs at most a few pages. Genres are applied in their own function so partial progress survives a rate-limit pause (`589ba7c`).

`cf5621` added three automatic behaviours in `SyncProvider`, tuned by constants at the top of the file: resume an interrupted run on hydration, resume a job paused for more than 30 min (`AUTO_RESUME_PAUSED_AFTER_MS`), and refresh a completed library older than 1 h (`AUTO_REFRESH_AFTER_MS`). "Refresh" is a distinct `RunMode` that fetches only items saved since the last sync and stops as soon as it hits an item it already has. **How to apply**: if you change page size, chunk size or pacing, check them against the route `maxDuration` budgets — `GENRE_CHUNK = 200` was set to fit the 120s genre route.

Fire-and-forget IndexedDB writes are intentional: the async persist must not block the sync loop.

## The server-side library store is a convenience mirror, not the source of truth (2026-08-20)

A completed sync is mirrored to `PUT /api/library`, one JSON file per account under `LIBRARY_DIR` (default `<CACHE_DIR>/library`, which the Home Lab compose puts on the persisted volume). A fresh browser or a second device restores from `GET /api/library` instead of forcing a full re-sync. It has **no TTL**, unlike `lib/cache.ts`.

Two safety properties worth keeping: the file name sanitises the user id *and* appends a SHA-256 prefix, so a sanitised id can never collide with another user's, and writes are write-then-rename so a crash mid-write cannot truncate the good copy.

## Caches degrade instead of failing (2026-08-20)

`lib/cache.ts` is in-memory with a disk backing; if the disk is not writable it silently falls back to memory-only. `openDB()` in `clientCache.ts` clears its cached promise on failure so a transient IndexedDB error is not remembered forever. **How to apply**: caches here are best-effort by policy — a cache failure must never surface as a user-facing error.
