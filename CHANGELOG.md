# Changelog

What each release of spotify-calendar brings to the person using it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); `.github/workflows/release.yml` turns each section into a
tag and a GitHub Release once it reaches `main` (COMMON-PROJECT-SPEC C13 in `second-brain`). Written in English, like
the code. Codenames are dances, in alphabetical order. Versions 0.1.0 to 0.4.0 were given after the fact to the
history's turning points.

## [Unreleased]

## [1.1.0] - 2026-10-22 — Habanera

### Added

- The showcase page (costardrouge.github.io/spotify-calendar) carries a legal notice — who publishes it, who hosts
  it, what it knows about a visitor (nothing) — and shows a proper card when its link is pasted somewhere.
- The showcase publishes an `llms.txt` at its root: a short summary of what spotify-calendar is and how it is
  self-hosted, with links to the showcase, its legal notice and the repository, for language models and the tools
  built on them.

### Fixed

- The icon added to an iPhone's home screen no longer comes back framed in black: it is opaque now. Browsers that
  prefer a raster favicon to the SVG get one (16 and 32 px).

### Security

- Every response carries security headers (HSTS, no sniffing, no framing, a referrer and a permissions policy) and a
  content security policy that, for now, only reports in the browser console what it would block.
- The server no longer prints every Spotify call, nor the scopes granted at each token refresh, to its console by
  default; `SYNC_DEBUG=1` turns that instrumentation on for an investigation.

## [1.0.0] - 2026-10-17 — Gavotte

The first numbered release: spotify-calendar as it runs on the Home Lab today.

### Added

- The options show which version is running (beside *Log out*, in the ⚙ menu on a phone).

### Fixed

- The genre filter and the Stats genre count fill again. Spotify stopped answering genres for many artists at once,
  so they are now looked up one artist at a time, kept as each answer lands, and an interrupted lookup picks up where
  it stopped. The first pass over a large library takes a while; later syncs only look up new artists.

## [0.4.0] - 2026-08-19 — Foxtrot
<!-- commit: c324d0eede445669e51792b49e5a1b96bc999187 -->

### Added

- Several Spotify accounts can share one deployment: each one sees and syncs only its own library, even on the same
  browser.
- Your library is kept on the server after a sync, so a new browser or device restores it instead of syncing again.

## [0.3.0] - 2026-07-28 — Disco
<!-- commit: 4df2e4baa1f08e97defd0e461cdae020e3869b16 -->

### Added

- *Refresh*: a quick sync that only fetches what you saved since the last one.
- An interrupted sync resumes by itself when you come back, and a library left stale refreshes itself.
- A ready-made Docker image for the Home Lab, published on every change.
- A public showcase with screenshots of the app, served from a demo library.

### Changed

- The app is named spotify-calendar everywhere: header, login screen, home-screen icon and showcase.

### Fixed

- The genre filter no longer comes up empty on a large library.

## [0.2.0] - 2026-07-09 — Cancan
<!-- commit: bf427cb896910d757264f16b61b25c868c8dae25 -->

### Added

- A phone layout, with the views in a bottom bar and the options behind a ⚙ menu.
- Play buttons on the albums and tracks of a day, and *Add to queue* beside them.
- A queue panel in the mini-player: what is playing, what comes next, a tap to jump to it.
- Installable on a phone's home screen, with its own icon and a proper link preview.

## [0.1.0] - 2026-07-08 — Bolero
<!-- commit: 589ba7cf761f7ae36abc41c40354c0572c507547 -->

### Added

- Sign in with Spotify and see your saved albums and liked tracks on a calendar, grouped by the day you saved them.
- Month, week, day, year, list and stats views, each with its own address.
- Filters by search, release year, artist and genre.
- A mini-player that drives Spotify on your devices: play, pause, next, previous, choose the device.
- A sync that loads your whole library, keeps it in the browser, and pauses when Spotify asks it to slow down.
