# Deployment — Docker, Compose, Actions, environment

Read before touching the Dockerfiles, the compose files, the Makefile, the GitHub workflows, or environment variables.

## Built once by CI, pulled by the Home Lab (2026-08-20)

`.github/workflows/docker-build.yml` builds and pushes `ghcr.io/costardrouge/spotify-calendar` on every push to `main`. `docker-compose.prod.yml` **pulls** that image rather than building locally — the target is a Dell OptiPlex home server, and building there is slow. Tagging is deliberate: `main` and `latest` are the moving tags Watchtower re-pulls, `sha-<short>` is immutable and is what you pin to for a rollback. `metadata-action` lowercases the image name (`CostardRouge` → `costardrouge`).

An optional `DEPLOY_WEBHOOK_URL` / `DEPLOY_WEBHOOK_TOKEN` secret pair triggers a Watchtower HTTP-API redeploy after the push; leaving them unset skips only that step, the publish still happens. **How to apply**: never make the redeploy step required.

## `output: "standalone"` drives the whole image layout (2026-08-20)

`next.config.ts` sets `output: "standalone"` so `Dockerfile` can copy `.next/standalone`, `.next/static` and `public/` into a bare Node Alpine runner (the exact tag the Dockerfile pins, see below) and start it with `node server.js` — no `node_modules` in the final image. The runner also creates an unprivileged `nextjs:nodejs` user and a writable `/app/.cache`. **How to apply**: removing `output: "standalone"` breaks the production Dockerfile; anything the server reads at runtime must be under `public/`, bundled, or in the mounted `/app/.cache`.

`Dockerfile.dev` is the hot-reload variant used by `docker-compose.yml`, which bind-mounts the source and sets `WATCHPACK_POLLING=true` (file watching is unreliable inside Docker without it) while keeping the container's own `node_modules` and `.next` as anonymous volumes.

## The base image is an exact tag, and CI boots the image before a merge (2026-10-19)

Both Dockerfiles pin `node:24.22.0-alpine` (C14; the reasoning in `tooling.md`, "Node"), and `.github/dependabot.yml`'s `docker` block proposes each new 24.x monthly (its major held to `.nvmrc`, C20). `ci.yml`'s `docker` job builds the production image and polls `/api/health` on every pull request, so a Dockerfile that no longer builds or an image that no longer boots is found before the merge — `docker-build.yml` still publishes only from `main`, and the redeploy step stays optional. **How to apply**: a change to the Dockerfile is verified by that job rather than by hand; keep `Dockerfile.dev` on the same tag, and never put a credential in the image — `/api/health` is the one route the job calls precisely because it needs none.

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

## Versions and releases ride beside the deploy, not in front of it (2026-10-17)

`.github/workflows/release.yml` + `.github/release.mjs` (identical across the portfolio, C13) check `CHANGELOG.md` against `package.json` on every pull request and, on `main`, tag each section `vX.Y.Z` and create its GitHub Release. The Docker publish and the Pages showcase still run on **every** push to `main`; a release changes nothing about them. **Trap, for the day deploys follow releases**: a tag or Release created with the workflow's `GITHUB_TOKEN` triggers no other workflow, so `docker-build.yml` cannot listen for `on: release` — it has to become a job of `release.yml`'s `publish`, or be called from it. The image is still tagged `main` / `latest` / `sha-<short>` only; a `:x.y.z` tag per release is the natural next step then.

The running version is shown in the topbar's options (`lib/version.ts`, a named import of `package.json`'s `version`). **How to apply**: import `lib/version.ts` from server code only and pass the string down as a prop, as `app/[view]/page.tsx` does for `CalendarApp`. Turbopack does not tree-shake a JSON module: imported into a `"use client"` component, the first attempt put the whole `package.json` (every dependency and its version) into a browser chunk — after touching it, `grep -rl eslint-config-next .next/static` must find nothing.
