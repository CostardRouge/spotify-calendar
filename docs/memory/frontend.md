# Frontend — views, styling, state, player

Read before touching `components/`, `app/globals.css`, the views, the filter panel, the mini-player or URL state.

## The visual identity is "contact sheet": warm, editorial, print-like (2026-08-20)

`app/globals.css` opens by naming it: bone paper, espresso ink, one desaturated terracotta accent, and **album art carries all the colour — everything else stays quiet**. The dark theme is "newsprint at night", explicitly warm and *never* blue-black. Everything is driven by CSS custom properties on `:root`, redefined under `prefers-color-scheme: dark`; type uses a serif stack (Iowan Old Style / Palatino / Georgia) with mono and sans companions.

**How to apply**: never hard-code a colour in a component — add or reuse a token. A new token needs a value in *both* palettes. Introducing a second saturated accent, or a cool grey, works against the whole design; if a change seems to need one, ask first.

## State lives in the URL, restored once on mount (2026-08-20)

`CalendarApp` reads the query string once on mount (filters, anchor date, collapsed panel), sets `urlReady`, and only then starts mirroring state back out. The view itself comes from the path (see `architecture.md`). An explicit `?d=` date beats the automatic jump-to-latest.

The collapsed-panel state is additionally **pre-hydrated by a script in `<head>`** that sets `data-panel-collapsed` on `<html>`, to kill the flash of an expanded panel on load; once React commits the restored state, the attribute is removed and `app-ready` is added a frame later so restoring a collapsed panel never animates. **How to apply**: that three-step handoff (head script → `urlReady` → `requestAnimationFrame`) is fragile and deliberate — do not simplify it without checking for the flash, in a cold load, in both themes.

## Filters are pure functions over the whole library (2026-08-20)

`lib/library.ts` holds `albumPasses` / `filterAlbums` / `groupByDay` / `artistIndex` as pure functions; the components only ever call them. Filtering happens client-side over the full loaded library, which is why the whole library is synced up front rather than queried per view. The `kinds` filter can never be emptied — unchecking the last one falls back to showing both, because an empty calendar with no explanation reads as a bug.

## Large libraries need the rendering guards (2026-08-20)

`ListView` renders progressively behind an `IntersectionObserver`; grid and card elements use `content-visibility: auto` with `contain-intrinsic-size`; every cover uses `loading="lazy"` and `decoding="async"` (`afeca9a`). With thousands of albums these are what keep scrolling usable. **How to apply**: a new view showing many covers needs the same treatment; removing `contain-intrinsic-size` alongside `content-visibility` reintroduces scrollbar jumping.

## The mini-player is a Spotify Connect remote, not a player (2026-08-20)

Playback is controlled through the user's *active Spotify device*; the app never plays audio itself, which is why the control endpoints need Premium and surface 403 as "premium_required" (see `spotify-api.md`). The queue panel and the device picker are mutually exclusive popovers — opening one closes the other, deliberately, so they never stack.

## PWA and the icon set (2026-08-20, rev. 2026-10-19)

`public/manifest.webmanifest` ships `standalone` display (the state lives on the server and in a per-user IndexedDB snapshot the app rebuilds from a sync, so a standalone launch loses nothing), `any` + `maskable` icons at 192/512, `start_url: "./?source=pwa"`, and `background_color` / `theme_color` taken from the light palette (`#efe9dd` / `#b0532f`). The home-screen short name is `spotify-cal`. **How to apply**: changing the light palette's `--bg` or `--accent` means changing the manifest to match, or the splash screen no longer matches the app.

**The icon set is the portfolio's (C11, 2026-10-19)**: `public/icons/` holds three SVG sources — `icon.svg` the rounded tile (the tab, the manifest's `any` pair), `icon-apple.svg` and `icon-maskable.svg` full bleed, the latter with the drawing at 70 % so it stays inside the launcher's 80 % safe zone — and the PNGs `scripts/gen-icons.mjs` rasterises from them with `sharp` (an optional dependency of Next already in `node_modules`, never a dependency of this project; `npm i --no-save sharp` if it ever goes). `app/layout.tsx` declares them through `metadata.icons` (the SVG, `favicon-16/32`, the touch icon, `favicon.ico` kept at the root because browsers ask for it blindly) and `metadata.manifest`; the manifest's paths are **relative**, so the same file would resolve under a base path. **Why**: iOS builds a home-screen icon from `apple-touch-icon` alone, a PNG, square and opaque — the previous one carried an alpha channel, which Apple's mask composites onto black — and the raster favicons were missing for the browsers that still prefer one to the SVG. **How to apply**: edit a source, run the generator, commit the PNGs with it; `tests/icons.test.ts` holds the sizes, the touch icon's missing alpha and the manifest's relative paths, so a forgotten regeneration fails the gate. The showcase on GitHub Pages reuses the same files (`pages.yml` copies `public/icons`, `demo-and-showcase.md`).

## Phone layout and the installed app (2026-11-26)

**Decision** (the owner's report from the sibling spotify-poller PWA on an iPhone: tab bar cut by the corners and home indicator, content off the right edge; same work done here, measured first). At ≤768px the filter panel is a **drawer** over the calendar (`drawer-open`, a scrim, closed on every load and on a view tab) — inline, its 300px left the calendar ~60px on a 390px phone. The drawer is its own state in `CalendarApp`, never `collapsed`, so opening it on a phone never writes `panel=0` into a link a desktop opens; the ☰ button picks one or the other with `matchMedia`. `.app` is `100dvh` (100vh put the tab bar under iOS Safari's toolbar) and pads the top and sides with `env(safe-area-inset-*)`; the tab bar is **in the flow**, not fixed, and pads its own bottom with `max(6px, inset)`; the mini-player is fixed above it. None of the insets worked before: `viewport.viewportFit: "cover"` (`app/layout.tsx`) is what makes them non-zero. Fields are 16px under `(pointer: coarse)` (iOS zooms into smaller ones). `appleWebApp.statusBarStyle` stays `"default"` — `black-translucent` puts white text over the light paper. No tables exist, so spotify-poller's records reflow had nothing to apply to. **How to apply**: measure with Playwright at the iPhone 13 profile on a built, demo-mode app (`DEMO_MODE=1 next start`, click "Start sync" first or every view is the empty state): `documentElement.scrollWidth` must equal the viewport, and list any element whose right edge passes it. Chromium reports every safe-area inset as 0, so the iPhone result is only known once the owner re-adds the app to a home screen (MEMORY.md, open items).

**The service worker caches only `offline.html`** (`public/sw.js`, registered by `components/ServiceWorker.tsx` in production only; GET navigations, network first, navigation preload, `VERSION` bumped when the page changes). Caching the view shells would let the calendar open offline from the IndexedDB snapshot — a real gain, rejected for now because every deploy renames `_next/static` chunks and a stale shell against a new server is invisible from a phone. Revisit only with a versioned shell + chunk cache cleared on activate. Manifest shortcuts: Month, Week, Year, Stats (four is Android's limit), relative URLs; `tests/pwa.test.ts` holds them to `app/[view]/page.tsx`'s `VIEWS`.
