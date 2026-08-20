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

## PWA (2026-08-20)

`public/manifest.webmanifest` ships `standalone` display, `any` + `maskable` icons at 192/512, `start_url: "/?source=pwa"`, and `background_color` / `theme_color` taken from the light palette (`#efe9dd` / `#b0532f`). The home-screen short name is `spotify-cal`. **How to apply**: changing the light palette's `--bg` or `--accent` means changing the manifest to match, or the splash screen no longer matches the app.
