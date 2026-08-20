# Project memory — decisions, reasons, traps

Long-term memory of this repo, read at the start of **every** agent session (imported by `CLAUDE.md`). It holds what the code and `git log` cannot tell you: the choices made and their reasons, what was tried and rejected, the traps that cost time, how the maintainer likes to work.

This file is the **always-loaded index**. The detail lives in `docs/memory/<topic>.md`, one file per area, loaded **on demand**: read the topic file(s) matching the area you are about to touch **before** acting (table at the bottom). Do not `@import` them into `CLAUDE.md` — the split exists to keep the per-session prompt small.

## How to maintain (mandatory — CLAUDE.md rule 2)

- **When**: at the end of every task, before its commit, in the same commit. Writing is the **default**; only skip if there is truly nothing a future agent could use, and say so explicitly in the final message.
- **What**: a design/product decision, a non-obvious technical choice, an explicit rejection ("the maintainer did not want X because Y"), a trap (browser, tooling, framework, hosting) and its remedy, a working preference. Not implementation detail readable in the diff, not what `git log` already says, not history ("this was fixed on…") — once a fix is committed, keep only the rule it taught.
- **Where**: the matching `docs/memory/<topic>.md`; a new file only when no topic fits (kebab-case name, add it to the table below with a "read when"). Cross-cutting rules, working style, decisions-at-a-glance and open items stay in this index.
- **How**: search first and **update** the existing entry rather than adding a near-duplicate; delete what became false. One entry = one short paragraph: *decision → why → how to apply*, dated `YYYY-MM-DD` on first write and on each revision. Say the same thing **once** — cross-reference other files by name instead of repeating.
- **Language**: **English**, dense, factual. No session narration.
- Budget: keep this index under ~200 lines and each topic file under ~150; if one outgrows that, split it.

## Working with Steeve Pommier

<!-- Fill in as you learn: how he validates work, how he phrases requests,
     what he wants when an audit finds problems, what annoys him. -->

- Observed from history, not stated by him (2026-08-20): the early work landed directly on `main` (15 of 20 first-parent commits), but everything since 2026-07 has come through a `claude/*` branch and a pull request (#2–#8). Assume the PR path for agent work.
- He writes and expects **detailed commit bodies**: the failure observed, the fix, the trade-off, what was verified, what stays open (see `acfb785`, `5312224`, `7df4f23`). A one-line commit is below the bar here.
- Comments in this codebase carry the *why*, often naming the bug that motivated the code (`lib/spotify.ts` 403 handling, `lib/clientCache.ts` IndexedDB rationale). Match that when adding code: explain the reason, not the mechanics.
- Verification is reported explicitly in commit bodies ("Verified `npm ci` succeeds under both npm 11.18 and npm 10.9"). Say what you actually ran, and say when a check was impossible.

## Direction in five lines

- A personal-scale tool first: browse *your own* saved Spotify albums and liked tracks by the day you saved them. Not a social or discovery product.
- Self-hosted by design — a Docker image on a Home Lab box, not a SaaS. No account system of its own: Spotify is the identity.
- Privacy posture: OAuth runs server-side, tokens live in httpOnly cookies and never reach the browser.
- Multi-user is about *safe sharing of one deployment*, not collaboration: every stored artefact is keyed by Spotify user id so accounts cannot see or overwrite each other.
- The UI aims at a warm, print-like dark aesthetic ("newsprint at night", `app/globals.css`), never blue-black.

## Decisions at a glance (details in the topic files)

- Genres are fetched in batches of 50 artist ids, never one request per artist — the per-artist version tripped Spotify's rolling rate window and left the genre filter empty. → `docs/memory/spotify-api.md`
- A long 429 is never retried into: it is surfaced as a typed error, recorded as a server-side cooldown, and the client pre-flights it before every sync request. → `docs/memory/spotify-api.md`
- The client library snapshot lives in IndexedDB, not localStorage (5 MB cap + synchronous writes made large libraries skip the cache entirely). → `docs/memory/data-and-sync.md`
- Everything user-scoped is keyed by Spotify user id: the IndexedDB snapshot, the localStorage sync job, and the server-side library files. The artist→genre cache and the rate-limit cooldown stay deployment-wide on purpose (app data, not user data). → `docs/memory/data-and-sync.md`
- Sync resumes from what is already held (offset derived from the current item count), so an interrupted run neither gaps nor duplicates. → `docs/memory/data-and-sync.md`
- TypeScript 7 is installed side by side with a `@typescript/typescript6` compatibility package aliased as `typescript`, because typescript-eslint and editors still need the old JS compiler API. → `docs/memory/tooling.md`
- React Compiler-backed `react-hooks` rules are set to `warn`, deliberately, so lint passes while the findings stay visible. → `docs/memory/tooling.md`
- The image is built once by CI and pulled by the Home Lab stack; `main` and `latest` are the moving tags, `sha-<short>` is the rollback pin. → `docs/memory/deployment.md`
- `DEMO_MODE=1` is a first-class mode, not a test hack: it powers the GitHub Pages showcase screenshots and lets anyone run the app with no Spotify app. → `docs/memory/demo-and-showcase.md`

## Open items (dated; remove when done)

- 2026-08-20 — `lib/spotify.ts` still carries six `[SYNC-DEBUG]` `console.log` calls marked "temporary instrumentation" (token refresh timings and every `apiGet` result, including the granted scope string). They log to the server console on every request in production. Decide: keep behind an env flag, or remove. Only the maintainer knows whether the scope-drift investigation they were added for is finished.
- 2026-08-20 — `react-hooks/purity`, `react-hooks/set-state-in-effect` and `react-hooks/refs` are demoted to warnings in `eslint.config.mjs` with a comment calling each one "a genuine cleanup". Nobody has done that cleanup; the warnings are still there. Reworking those effects is its own change and needs the maintainer's go-ahead.
- 2026-08-20 — the `typescript6` compatibility shim is meant to be dropped "once the tooling supports the TypeScript 7 API" (typescript-eslint issue #10940, per the README). Nothing tracks that upstream issue; someone has to check it periodically.
- 2026-08-20 — there is no automated test suite and no CI check that runs `npm run lint` or `npm run typecheck`. The two workflows build (Docker, Pages) but neither gates on lint or types, so a type error only surfaces at `next build`. Whether that is acceptable is the maintainer's call.

## Topic files — read before touching the area

| File | Read when you touch… |
| --- | --- |
| `docs/memory/architecture.md` | Routing, the app/api ↔ lib/ ↔ components/ split, where state lives, auth and session handling |
| `docs/memory/spotify-api.md` | Anything calling the Spotify Web API: pagination, genres, rate limits, scopes, playback, error mapping |
| `docs/memory/data-and-sync.md` | The sync loop, the IndexedDB snapshot, the sync job record, the server-side caches and per-user library store |
| `docs/memory/tooling.md` | `package.json`, the lockfile, TypeScript, ESLint, Node versions, the build |
| `docs/memory/deployment.md` | Dockerfiles, compose files, the Makefile, GitHub Actions, the Home Lab stack, environment variables |
| `docs/memory/demo-and-showcase.md` | `DEMO_MODE`, the fixture library, `showcase/`, the Pages workflow, screenshot capture |
| `docs/memory/frontend.md` | Components, `app/globals.css`, the views, the filter panel, the mini-player, URL state |
