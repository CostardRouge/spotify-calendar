# spotify-calendar

**[Showcase / screenshots →](https://costardrouge.github.io/spotify-calendar/)**

A Next.js app that lays your **saved Spotify albums** on a monthly calendar,
grouped by the day you added each one. Each day cell shows the album covers
stacked, with a count badge; a collapsible side panel filters by **search,
release year, artist, and genre**.

Authentication runs **server-side** (Authorization Code flow) — your Spotify
tokens live in httpOnly cookies and never reach the browser.

---

## 1. Create a Spotify app

1. Go to <https://developer.spotify.com/dashboard> → **Create app**.
2. Add these **Redirect URIs** (whichever you'll use):
   - Local: `http://127.0.0.1:3000/api/auth/callback`
   - Home Lab: `http://<optiplex-host-or-ip>:3000/api/auth/callback`
3. Tick **Web API**, save, then copy the **Client ID** and **Client Secret**.

## 2. Configure environment

```bash
make init          # copies .env.example -> .env and builds the dev image
```

Then edit `.env` and fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and
(if needed) `SPOTIFY_REDIRECT_URI`.

## 3. Run

### Local development (hot reload)

```bash
make up            # start in background   ->  http://127.0.0.1:3000
make start         # start in foreground (logs attached)
make logs          # follow logs
make down          # stop
```

### Home Lab (Dell OptiPlex) — optimized standalone image

```bash
make prod-build    # build the multi-stage standalone image
make prod-up        # start in background with healthcheck + auto-restart
make prod-logs     # follow logs
make prod-deploy   # rebuild + restart in one step
make prod-down     # stop
```

Set `APP_PORT` in `.env` to publish on a different host port. Remember to add
the matching Redirect URI in the Spotify dashboard for the host/IP you use.

---

## Make targets

Run `make help` for the full list. The main ones:

| Command | What it does |
| --- | --- |
| `make init` | Create `.env` from template, build dev image |
| `make build` / `make up` / `make start` | Build / run (background) / run (foreground) — dev |
| `make down` / `make logs` / `make shell` | Stop / logs / shell — dev |
| `make prod-build` / `make prod-up` / `make prod-deploy` | Build / run / rebuild+run — Home Lab |
| `make prod-down` / `make prod-logs` | Stop / logs — Home Lab |
| `make clean` | Tear everything down and remove the built image |

---

## Architecture

```
app/
  api/
    auth/login       -> redirect to Spotify authorize
    auth/callback    -> exchange code, set httpOnly cookies
    auth/logout      -> clear cookies
    albums           -> server fetch of saved albums (+ genre enrichment, token refresh)
    health           -> healthcheck endpoint
  login/page.tsx     -> connect screen
  page.tsx           -> calendar app (client)
components/          -> Calendar, FilterPanel, DayModal
lib/                -> config, auth cookies, Spotify client, pure filter helpers, types
```

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 7,
  `output: "standalone"`. Requires Node.js 20.9+ (images and CI run Node 24).
- **TypeScript:** `npm run typecheck` runs the TypeScript 7 native compiler.
  TypeScript 7 no longer ships the old JavaScript compiler API, so
  `node_modules/typescript` is the `@typescript/typescript6` compatibility
  package — that is what `typescript-eslint` and editors load. Both live in
  `devDependencies`; drop the `typescript6` shim once the tooling supports the
  TypeScript 7 API (typescript-eslint tracks this in issue #10940).
- **Lint:** `npm run lint` calls ESLint directly via `eslint.config.mjs` —
  `next lint` was removed in Next 16.
- **Docker:** `Dockerfile.dev` (hot reload) and `Dockerfile` (multi-stage,
  non-root, healthcheck) with matching Compose files.
- **Data:** the whole saved-albums library is fetched server-side and enriched
  with genres (Spotify tags genres on artists, so a few albums may be untagged).

## Multi-user isolation

The deployment can be shared: every piece of stored data is keyed by the
Spotify account that produced it, so one user's sync can never display or
overwrite another user's library.

- **Identity:** at login the callback fetches the Spotify profile and pins the
  session to its user id (`sp_uid`, httpOnly). Older sessions are resolved and
  cookied lazily by `/api/me`.
- **Browser storage:** the IndexedDB snapshot and the sync-job record are both
  keyed per user id, so several accounts sharing one browser each keep their
  own copy. Pre-existing single-user data is claimed by the first account that
  logs in after the upgrade.
- **Server store:** a completed sync is mirrored to `/api/library` — one JSON
  file per account under `LIBRARY_DIR` (defaults to `<CACHE_DIR>/library`,
  persisted by the Home Lab volume). On a fresh browser or another device the
  app restores your library from there instead of forcing a full re-sync.
- **Shared, but harmless:** the artist→genre cache (global Spotify data, not
  user data) and the rate-limit cooldown (the 429 applies to the whole app)
  remain deployment-wide by design.

## Demo mode & showcase page

`DEMO_MODE=1` boots the app with a fixture library (real releases, synthetic
save-dates) and no Spotify credentials — handy for trying the UI or hacking on
it without creating a Spotify app:

```bash
DEMO_MODE=1 npm run dev     # or: add DEMO_MODE=1 to .env with Docker
```

The **GitHub Pages showcase** (`.github/workflows/pages.yml`) uses this mode:
on every push to `main` it builds the app, boots it in demo mode, captures
real screenshots with Playwright (`scripts/showcase-screenshots.mjs`), and
deploys the landing page in `showcase/` to GitHub Pages. One-time setup:
**Settings → Pages → Source: "GitHub Actions"**. Regenerate the fixture
library with `node scripts/build-demo-library.mjs`.

## Notes

- Login lasts ~1 hour and refreshes automatically via the stored refresh token.
- `.env` is git-ignored — never commit real secrets.
