#!/usr/bin/env node
/**
 * Draws public/og-image.png, the 1200 × 630 link-preview card of the app and
 * of the showcase: the year as a record (lib/disc.ts, fed with the demo
 * library's 2026 — invented save dates, never anyone's account) beside the
 * wordmark and the catchline, in the night palette and the app's own fonts.
 *
 * Usage:  node scripts/gen-og-image.mjs
 *
 * Rendered by the Playwright the showcase workflow already installs (here,
 * `npm i --no-save playwright` if it is missing; an HTML page
 * screenshotted, because the fonts are what make the card), then flattened by
 * sharp — an optional dependency of Next, see scripts/gen-icons.mjs — so the
 * PNG carries no alpha: tests/pwa.test.ts holds the size and the opacity.
 * Commit the PNG; nothing regenerates it at build time.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { discLayout } from "../lib/disc.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const font = (name) => readFileSync(join(ROOT, "app", "fonts", name)).toString("base64");
const library = JSON.parse(readFileSync(join(ROOT, "lib", "demo-library.json"), "utf8"));

const counts = {};
for (const item of [...library.albums, ...library.tracks]) counts[item.dateKey] = (counts[item.dateKey] ?? 0) + 1;
const SIZE = 520;
const disc = discLayout(counts, 2026, SIZE);
const c = SIZE / 2;
const peak = disc.rings.reduce(
  (best, ring) => {
    const n = disc.dots.filter((d) => d.month === ring.month).reduce((s, d) => s + d.count, 0);
    return n > best.n ? { month: ring.month, n } : best;
  },
  { month: -1, n: 0 },
).month;

const svg = `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${c}" cy="${c}" r="${c}" fill="#1c1612"/>
  ${disc.rings
    .map((r) => `<circle cx="${c}" cy="${c}" r="${r.r}" fill="none" stroke="${r.month === peak ? "#ff6a3d" : "#2e2620"}" stroke-width="${r.month === peak ? 2 : 1.2}"/>`)
    .join("")}
  ${disc.dots.map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="#ff6a3d"/>`).join("")}
  <circle cx="${c}" cy="${c}" r="${disc.label}" fill="#ff6a3d"/>
  <circle cx="${c}" cy="${c}" r="6" fill="#15110e"/>
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Unbounded; src: url(data:font/woff2;base64,${font("unbounded-latin-wght.woff2")}) format("woff2"); font-weight: 200 900; }
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${font("inter-latin-wght.woff2")}) format("woff2"); font-weight: 100 900; }
html, body { margin: 0; width: 1200px; height: 630px; background: #15110e; color: #f4ece2; overflow: hidden; }
body { display: flex; align-items: center; gap: 64px; padding: 0 72px 0 56px; box-sizing: border-box; font-family: Inter; }
.words { display: flex; flex-direction: column; gap: 18px; }
h1 { margin: 0; font: 800 120px/0.95 Unbounded; letter-spacing: -0.05em; }
p { margin: 0; font: 600 34px/1.2 Inter; letter-spacing: -0.01em; }
small { font: 500 22px/1.4 Inter; color: #b9ab99; max-width: 470px; }
</style></head><body>${svg}<div class="words"><h1>sillon</h1><p>Your records,<br>day by day.</p><small>Your saved albums and liked songs, laid out by the day you saved them.</small></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const shot = await page.screenshot({ type: "png" });
await browser.close();
await sharp(shot).flatten({ background: "#15110e" }).removeAlpha().png().toFile(join(ROOT, "public", "og-image.png"));
console.log("✓ public/og-image.png (1200×630, opaque)");
