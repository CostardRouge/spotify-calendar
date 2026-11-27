# Sillon — visuals

Images of Sillon for the owner's site, `CHANGELOG.md` entries and GitHub Releases.
Every file is a PNG at deviceScaleFactor 2 (`@2x`): the pixel size below is twice
the CSS frame it shows. All were made on 2026-11-27, at version 1.1.0.

Two kinds, never to be confused when published:

- **REAL APP** (`app-*`): screenshots of the running app in demo mode
  (`DEMO_MODE=1`, the fixture library in `lib/demo-library.json`: real releases
  and their real cover art, invented save dates, a "Demo" account). What a user
  gets today.
- **MOCKUP** (`mockup-*`): artboards of the design canvas the look came from
  (claude.ai artifact `4Cf9s6rnn43rYpmVbdGiDi`, "Atelier design"), rendered on
  their own, without the canvas's notes, titles or stickies. A design, not the
  shipped app: details differ (the mockups show the owner's first name, a
  "Synced 4 minutes ago" line, a hover card the app opens on hover only, and copy
  that was later changed). Label them as design work when you use them.

## Real app (demo mode)

Desktop frames are 1440 × 900, phone frames 390 × 844 (Chromium, mobile
emulation). "night" and "day" are the app's two palettes, forced through the
theme preference. The month and day are July 2026, the demo library's latest.

| File | Shows | Size (px) |
| --- | --- | --- |
| `app-month-wall-night-desktop@2x.png` | Month, Wall layout (the default): a numbered tile per day, then its covers | 2880 × 1800 |
| `app-month-wall-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-month-wall-night-phone@2x.png` | Month, Wall, on a phone | 780 × 1688 |
| `app-month-wall-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-month-grid-night-desktop@2x.png` | Month, Grid layout: the calendar, a cover per day, `×N` counts | 2880 × 1800 |
| `app-month-grid-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-month-grid-night-phone@2x.png` | Month, Grid, on a phone | 780 × 1688 |
| `app-month-grid-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-week-night-desktop@2x.png` | Week: a big lead cover per day, the rest listed under it | 2880 × 1800 |
| `app-week-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-week-night-phone@2x.png` | Week, on a phone | 780 × 1688 |
| `app-week-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-day-night-desktop@2x.png` | Day (22 July): the record behind the cover, "A year ago", the day's saves | 2880 × 1800 |
| `app-day-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-day-night-phone@2x.png` | Day, on a phone | 780 × 1688 |
| `app-day-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-journal-night-desktop@2x.png` | Journal (the `/list` view): saves by day, newest first | 2880 × 1800 |
| `app-journal-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-journal-night-phone@2x.png` | Journal, on a phone | 780 × 1688 |
| `app-journal-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-stats-night-desktop@2x.png` | Stats bento: top artist, counts, busiest day, first save, oldest record, per year, per decade | 2880 × 1800 |
| `app-stats-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-stats-night-phone@2x.png` | Stats, on a phone | 780 × 1688 |
| `app-stats-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-year-night-desktop@2x.png` | Year as a record: a groove per month, July drawn in covers, the month list beside | 2880 × 1800 |
| `app-year-day-desktop@2x.png` | Same, day palette | 2880 × 1800 |
| `app-year-night-phone@2x.png` | Year, on a phone | 780 × 1688 |
| `app-year-day-phone@2x.png` | Same, day palette | 780 × 1688 |
| `app-social-card-month-grid-night-1200x630@2x.png` | Social-card frame (1200 × 630, the og:image ratio) of the month in Grid at night | 2400 × 1260 |

Known flaw: about 10 of the demo library's 113 cover URLs now answer 404 on
Apple's art CDN, so a few tiles show an empty square (most visibly the third
cover of 1 July and the second of 6 July on the wall). Regenerating the fixtures
(`node scripts/build-demo-library.mjs`) and re-running the capture fixes it.

## Mockups (design canvas)

From the canvas's "Itération 3 — synthèse" page (the reference the app was built
from) unless noted. All in the chosen **Sillon** direction; the rejected
directions (B · Diggin', C · Almanach) are not included.

| File | Shows | Canvas board | Size (px) |
| --- | --- | --- | --- |
| `mockup-month-wall-desktop-night@2x.png` | Month as a wall, with its one-time explanation | Iteration 3, `I3-F1-Mur` | 2880 × 1800 |
| `mockup-month-grid-desktop-night@2x.png` | Month as a grid, a day's hover card open | Iteration 3, `I3-F2-Grille` | 2880 × 1800 |
| `mockup-week-desktop-night@2x.png` | Week in big covers | Iteration 3, `I3-F3-Semaine` | 2880 × 1800 |
| `mockup-stats-desktop-night@2x.png` | Stats bento | Iteration 3, `I3-F4-Stats` | 2880 × 1800 |
| `mockup-account-menu-desktop-night@2x.png` | Account menu open from the side rail (sync, theme, GitHub, what's new, log out) | Iteration 3, `I3-F5-Compte` | 2880 × 1800 |
| `mockup-year-desktop-night@2x.png` | Year as a record, July in covers | Iteration 3, `I3-F6-Annee` | 2880 × 1800 |
| `mockup-month-wall-phone-night@2x.png` | Month as a wall, phone | Iteration 3, `I3-F7-Tel-Mur` | 780 × 1688 |
| `mockup-month-grid-phone-night@2x.png` | Month grid and the chosen day, phone | Iteration 3, `I3-F8-Tel-Grille` | 780 × 1688 |
| `mockup-stats-phone-night@2x.png` | Stats, phone | Iteration 3, `I3-F9-Tel-Stats` | 780 × 1688 |
| `mockup-account-sheet-phone-day@2x.png` | Account sheet from the bottom, day palette | Iteration 2, `I2-M3-Tel-Feuille-Jour` | 780 × 1688 |
| `mockup-year-record-concept-phone-night@2x.png` | The first "year as a record" concept (French copy, placeholder covers) | Iteration 1, direction A · Sillon, `A1-Sillon-Annee` | 780 × 1688 |

## Regenerating

- **Real app**: `npm ci`, `DEMO_MODE=1 npm run build`, `DEMO_MODE=1 npm start`,
  then `node scripts/capture-visuals.mjs docs/visuals` (Playwright is not a
  dependency: `npm i --no-save playwright`, or link a pre-installed one into
  `node_modules`). The art CDN must be reachable: this script has no fake covers,
  on purpose.
- **Mockups**: read the canvas's `project/*.dc.html` files and the cover assets
  they name (`/_blob/<id>`) with the Artifact tool, serve them with the type's
  `artifact-type/dc-runtime.js` answering for `support.js`, and screenshot each
  board's root element at its `canvas.json` frame size. Notes and titles live in
  `canvas.json`, never inside a board, so a board rendered alone carries none.
  The Google Fonts links are answered with the app's own self-hosted Unbounded
  and Inter (`app/fonts/`), and link underlines are turned off (the app has none).
  Read-only: nothing is ever published back to the canvas.
- **Size**: PNGs are palette-quantised with `sharp` (quality 90, dithering;
  `sharp` comes with Next), about a quarter of the raw size, so the folder stays
  near 11 MB.
