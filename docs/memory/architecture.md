# Architecture

Read before touching routing, the `app/` ↔ `lib/` ↔ `components/` split, auth, or session handling.

## The view lives in the URL path, not a query param (2026-08-20)

`app/page.tsx` redirects `/` to `/month`; `app/[view]/page.tsx` accepts exactly `month | week | day | year | list | stats` and 404s on anything else. It calls `generateStaticParams()` so each view gets a pre-rendered static shell and the app opens straight into the right view with no flash of another one. Decided in `afeca9a` ("cleaner URLs and server-side static rendering"). **How to apply**: adding a view means adding it to *both* `VIEWS` in `app/[view]/page.tsx` and `ViewMode` in `lib/dates.ts` — they are two hand-kept lists of the same set.

Everything else that is user-visible state (anchor date, filters, panel collapsed) is serialised into the *query string* by `lib/urlState.ts`, which omits any value sitting at its default. Keep that property: it is what makes shared links short and the back button meaningful.

## Server holds the secrets, client holds the library (2026-08-20)

The Spotify client secret and the OAuth tokens never leave the server: tokens are httpOnly cookies (`lib/auth.ts`), and every Spotify call goes through a route under `app/api/`. The *library itself*, by contrast, is fetched page by page by the browser and cached client-side (see `data-and-sync.md`). So `app/api/*` routes are thin: resolve a token, call `lib/spotify.ts`, map errors. Business logic that does not need a secret belongs in `lib/` as a pure function (`lib/library.ts` filters, `lib/dates.ts`, `lib/urlState.ts`) so it stays testable and usable from both sides.

Every API route sets `export const dynamic = "force-dynamic"` and a `maxDuration` budget (30s for album/track pages, 120s for genres, 15s for player control). Those budgets are load-bearing: the genre chunk size was tuned against the 120s one.

## Two React context providers wrap the whole app (2026-08-20)

`app/layout.tsx` mounts `SyncProvider` (library data + sync job state) and `PlaybackProvider` (player state) around everything. Components read them by hook rather than by prop-drilling. `SyncProvider` hydrates **asynchronously** on purpose — it reads IndexedDB, and doing that synchronously blocked the initial render (`afeca9a`). **How to apply**: never assume the library is present on first paint; components must render an empty/loading state without crashing.

## Scope drift is a first-class failure mode (2026-08-20)

Playback scopes were added after the first users had already authorised the app, so their refresh tokens were minted without them. The refresh response echoes the scopes the *refresh token* carries, which is why `resolveAccessToken()` returns `scope` and `lib/playerErrors.ts` exposes `scopeGuard()`: a player route whose required scope is known-missing short-circuits with `reauth_required` instead of calling Spotify, getting a 401 and triggering an endless refresh loop. An **empty** granted-scope string means "unknown" (session predates scope tracking) and deliberately never blocks. **How to apply**: any new endpoint needing a new scope must add it to `config.scopes` *and* guard with `scopeGuard()`, or existing sessions will 401-loop.

## Errors are mapped once, centrally (2026-08-20)

`lib/playerErrors.ts:mapPlayerError()` is the single place that turns a thrown Spotify error into a response (401 re-auth, 403 Premium required, 404 no active device, 429 back-off). A 403 on a *read* endpoint means "not a Premium account", not "forbidden" — before that was handled, `/api/player` returned a raw 502 to the browser every 5 seconds forever for non-Premium users. **How to apply**: throw typed errors with a `.status` from `lib/spotify.ts`; do not build ad-hoc error responses in a route.
