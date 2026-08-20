# Deployment — Docker, Compose, Actions, environment

Read before touching the Dockerfiles, the compose files, the Makefile, the GitHub workflows, or environment variables.

## Built once by CI, pulled by the Home Lab (2026-08-20)

`.github/workflows/docker-build.yml` builds and pushes `ghcr.io/costardrouge/spotify-calendar` on every push to `main`. `docker-compose.prod.yml` **pulls** that image rather than building locally — the target is a Dell OptiPlex home server, and building there is slow. Tagging is deliberate: `main` and `latest` are the moving tags Watchtower re-pulls, `sha-<short>` is immutable and is what you pin to for a rollback. `metadata-action` lowercases the image name (`CostardRouge` → `costardrouge`).

An optional `DEPLOY_WEBHOOK_URL` / `DEPLOY_WEBHOOK_TOKEN` secret pair triggers a Watchtower HTTP-API redeploy after the push; leaving them unset skips only that step, the publish still happens. **How to apply**: never make the redeploy step required.

## `output: "standalone"` drives the whole image layout (2026-08-20)

`next.config.mjs` sets `output: "standalone"` so `Dockerfile` can copy `.next/standalone`, `.next/static` and `public/` into a bare `node:24-alpine` runner and start it with `node server.js` — no `node_modules` in the final image. The runner also creates an unprivileged `nextjs:nodejs` user and a writable `/app/.cache`. **How to apply**: removing `output: "standalone"` breaks the production Dockerfile; anything the server reads at runtime must be under `public/`, bundled, or in the mounted `/app/.cache`.

`Dockerfile.dev` is the hot-reload variant used by `docker-compose.yml`, which bind-mounts the source and sets `WATCHPACK_POLLING=true` (file watching is unreliable inside Docker without it) while keeping the container's own `node_modules` and `.next` as anonymous volumes.

## Persistence is one named volume (2026-08-20)

`spotify-calendar-data` mounts at `/app/.cache` in the prod stack, with `CACHE_DIR=/app/.cache`. That single volume carries both the artist→genre cache and the per-user library store (`LIBRARY_DIR` defaults to `<CACHE_DIR>/library`). **How to apply**: a new server-side persisted artefact should live under `CACHE_DIR` too, or it silently vanishes on the next container replacement — and `make clean` / `make reset` remove volumes, so they wipe user libraries.

## The redirect URI is the source of truth for the public origin (2026-08-20)

`appBaseUrl` in `lib/config.ts` is derived from `SPOTIFY_REDIRECT_URI` (minus the callback path), not from `request.url`, because behind Docker `request.url` exposes the container-internal host and browser redirects would target something the user cannot reach. `APP_BASE_URL` overrides it. Separately, `NEXT_PUBLIC_SITE_URL` only feeds absolute Open Graph / Twitter image URLs.

**How to apply**: `SPOTIFY_REDIRECT_URI` must match a Redirect URI registered in the Spotify dashboard *exactly*, including host and port — changing the published port (`APP_PORT`) means registering the new URI there too.

## Environment variables (2026-08-20)

Documented in `.env.example`, which `make init` copies to `.env`. Required: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (`assertConfigured()` throws naming whichever is missing). Optional: `SPOTIFY_REDIRECT_URI`, `APP_PORT`, `APP_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `CACHE_TTL_SECONDS`, `CACHE_DIR`, `LIBRARY_DIR`, `DEMO_MODE`.

Real values live only in the untracked `.env` on the maintainer's machine and on the Home Lab host; nothing else reads them. No secret has ever been committed to this repo — `.env.example` (placeholder values) is the only env file in its history. **How to apply**: adding a variable means adding it to `.env.example` with a comment, and the compose files read `.env` via `env_file`, so nothing else is needed for either stack.

## The Makefile is the interface, not raw docker commands (2026-08-20)

`make help` is the default goal and lists every target from its `##` comments. Dev: `init`, `build`, `up`, `start`, `down`, `restart`, `reset`, `logs`, `shell`. Home Lab: `prod-pull`, `prod-up`, `prod-start`, `prod-down`, `prod-logs`, `prod-deploy`. **How to apply**: a new operational command belongs in the Makefile with a `##` description, so it shows up in help.
