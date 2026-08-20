# Instructions for LLM agents (Claude Code, Codex, Cursor, etc.)

Agents read this file at the start of every session. These rules override the agent's default behaviour and apply for the whole session, not only the first turn.

## Context

- **spotify-calendar** — a Next.js 16.2 app (App Router, Turbopack, `output: "standalone"`) on React 19.2 and TypeScript 7, requiring Node.js 20.9+ (Docker images and CI run Node 24). It lays your saved Spotify albums and liked tracks on a calendar, grouped by the day you saved them; OAuth runs server-side and the tokens live in httpOnly cookies. It deploys as a Docker image published to GHCR by `.github/workflows/docker-build.yml` on every push to `main`, pulled by a self-hosted Home Lab stack (`docker-compose.prod.yml`); `.github/workflows/pages.yml` separately builds the demo-mode showcase and deploys it to GitHub Pages. Package manager: **npm** — the lockfile is `package-lock.json`.
- `npm run dev` (dev server), `npm run build`, `npm run lint` (ESLint flat config), `npm run typecheck` (TypeScript 7 native compiler). There is **no test suite** — verification is build + lint + typecheck, plus a look at the running app. `make up` / `make prod-deploy` drive the Docker stacks (`make help` lists every target).
- Several agent sessions may run **in parallel** on this repo. Git history must stay readable: **one commit = one task**.
- **Local sessions: never `git push`** — the developer tests locally and pushes himself. **Cloud / web sessions (ephemeral container): push the working branch and open a pull request**, it is the only way the code gets out. Never push to `main` either way.

## Rule 1 — Automatic commit at the end of every task (MANDATORY)

As soon as a task requested by the user is finished (feature, fix, refactor, content…), the agent MUST create a commit before handing back. No need to ask permission: it is the expected behaviour.

### Exact procedure

1. **Check the state**: `git status --porcelain` and `git diff --stat`.
2. **Select only the task's files**:
   - Stage file by file with `git add <path>` (never `git add -A`, `git add .` or `git commit -a`).
   - A modified file unrelated to the task (parallel session, tooling noise) stays **unstaged**. Do not touch it, stash it or reset it.
   - If one file holds changes from this task AND another, prefer `git add -p <file>` to stage only the relevant hunks. If inextricable, stage the whole file and say so in the commit body ("also contains …").
   - Never stage: `.env` and any secret file, `.idea/`, `.vscode/`, `.next/`, `.cache/`, `site/`, `out/`, `node_modules/`, `.DS_Store` — unless the task is explicitly about them. If one of these turns out to be *tracked*, say so: it must be untracked and gitignored, not carefully avoided at every commit.
   - Check with `git diff --cached --stat` before committing.
3. **Commit with a readable message** (format below). Always use a HEREDOC to keep title + body:

   ```bash
   git commit -m "$(cat <<'EOF'
   Imperative title, ≤ 72 characters, no trailing period

   Why this change, what it does concretely, non-obvious decisions.
   One line per idea. Mention the files/areas touched if useful.

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

4. **Do not push** (local sessions). End the reply with a recap: short hash + commit title + the list of files that were modified but deliberately **left uncommitted**, if any, so the user knows where every change comes from.
5. If a git hook changes or refuses something: read the output, fix, recommit. Never `--no-verify`.

### Commit message format

- **Title**: English imperative, clear sentence, ≤ 72 chars, no `feat:`-style prefix, no trailing period. Real examples from this repo: `Isolate all stored data per Spotify account (multi-user support)`, `Fix empty genre filter: batch artist genre lookups`.
- **Blank line**, then a **body**, mandatory whenever the title is not enough: the *why*, the *how* in 2–6 lines, the trade-offs, what remains to do. The body is what lets someone find, weeks later, which feature produced this diff. The bodies in this repo's history are the reference standard — read a few (`git log -3`) before writing yours.
- A commit **never** mixes two tasks. If a session handles several distinct tasks, make several successive commits.
- No empty commit, no "WIP" commit, no commit for an unfinished task. If the task is interrupted, leave the work uncommitted and say so.

### When is a task "finished"?

- The requested code is written **and** verified: `npm run build`, `npm run lint` and `npm run typecheck` green — plus, for anything that renders, a look at the running app (`npm run dev`, or `DEMO_MODE=1 npm run dev` when you have no Spotify credentials).
- A plain question, an exploration or an explanation produces **no** commit (nothing to commit).

## Rule 2 — Project memory in `MEMORY.md` + `docs/memory/` (MANDATORY)

The repo carries its own long-term memory, read locally and in the cloud alike:

- **`MEMORY.md`** at the root — the **index**, imported below and therefore loaded every session: how to maintain the memory, how the maintainer works, direction and decisions at a glance, open items, and a table of topic files.
- **`docs/memory/<topic>.md`** — one file per area, loaded **on demand**. Not imported here on purpose: the split keeps the per-session prompt small.

Obligations:

- **Read `MEMORY.md`, then the topic file(s) for the area you are about to touch, before acting** — to understand previous choices and not re-propose what was rejected. The table at the bottom of `MEMORY.md` maps areas to files.
- **Every task writes to memory by default.** At the end of each task (feature, fix, refactor, content, and any exploration that learned something), ask: "what should a future agent know that is neither in the code nor in `git log`?" — decisions and their reasons, rejected options, traps and remedies, working preferences. Write it in the matching topic file (update the existing entry first; delete what became false; add a short dated *decision → why → how to apply* entry otherwise), and update the index if a cross-cutting decision, an open item or a new topic file is involved. **If, exceptionally, there is nothing worth keeping, say so explicitly in the final message** ("no memory update: …") — silence is not an option.
- The memory update is part of the task: it is staged **in the same commit** (rule 1).
- Memory is written in **English**, dense and factual; no session narration, no duplication of what the code, `git log` or this file already say; each fact stated once, cross-referenced by file name elsewhere.
- The project command `/memorize` (`.claude/commands/memorize.md`) does this consolidation on demand over a whole conversation.

@MEMORY.md

## Verification — trust the disk, not the context

- A tool answering "success" is not proof. Before saying a change is done, prove it through the repo: `git status --porcelain`, `git diff`, `grep` for the expected value, `git show HEAD:<file>` compared to the file on disk.
- What you hold in context (an earlier `Read`, an old `ls`, a summarised conversation) can be **stale**: it has produced sessions where `Edit` reported success while nothing changed on disk, and where an agent described a tree that had not existed for weeks. Signature: `git status` clean right after an announced change. Re-read from disk before concluding.
- Never state an absence ("this feature is missing", "that file does not exist") without a `git`/`grep` check made in the current turn.

## Other rules

- Never rewrite history (`rebase -i`, `commit --amend`, `reset --hard`, `push --force`, `filter-repo`) without an explicit request.
- Do not modify `.git/config`, the hooks or branch settings.
- **The `typescript` / `typescript7` devDependency pair is deliberate, not a mistake.** `node_modules/typescript` is the `@typescript/typescript6` compatibility package (typescript-eslint and editors still need the old JS compiler API, which TS 7 dropped); `typescript7` is the real TypeScript 7. That is why `npm run typecheck` invokes `./node_modules/typescript7/bin/tsc` by path. Do not "clean up" either alias — see `docs/memory/tooling.md`.
- **`next lint` no longer exists** (removed in Next 16). Lint is `npm run lint`, i.e. ESLint invoked directly against `eslint.config.mjs`.
- **Never hand-edit `package-lock.json`, and regenerate it with npm 11+** (`npm install --package-lock-only`). CI runs `npm ci` on Node 24 / npm 11, which validates the *full* optional-dependency set; a lockfile written by npm 10 omits the non-linux binaries and fails the build. See `docs/memory/tooling.md`.
- **`site/` is generated** by the Pages workflow (screenshots + landing page) and is gitignored — edit `showcase/index.html` and `scripts/showcase-screenshots.mjs` instead, never `site/`.
- **Working without Spotify credentials**: `DEMO_MODE=1` serves the fixture library in `lib/demo-library.json` with no auth, across every route. Use it to run and screenshot the app. Regenerate the fixtures with `node scripts/build-demo-library.mjs`.
- **Spotify is rate-limited and unforgiving**: every request made during an active 429 ban can prolong it. Do not add a Spotify call to a polling path, and do not remove the pacing `sleep`s or the cooldown pre-flight. See `docs/memory/spotify-api.md`.

## Related files

- `AGENTS.md`: points to this file for tools that do not read `CLAUDE.md`.
- `MEMORY.md` + `docs/memory/`: project long-term memory (rule 2).
