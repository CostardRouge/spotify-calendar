#!/usr/bin/env node
/**
 * Captures the showcase screenshots against a running instance of the app in
 * demo mode (DEMO_MODE=1). Used by .github/workflows/pages.yml, and runnable
 * locally:
 *
 *   DEMO_MODE=1 npm run build && DEMO_MODE=1 npm start &
 *   node scripts/showcase-screenshots.mjs [outDir]
 *
 * Env: BASE_URL (default http://127.0.0.1:3000)
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] ?? "site/screenshots";
mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[screenshots] ${m}`);

/** Wait until every visible <img> on the page has finished loading. */
async function settleImages(page, timeout = 30_000) {
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("img")].every(
          (i) => i.complete || i.style.display === "none",
        ),
      { timeout },
    )
    .catch(() => log("some images never settled — capturing anyway"));
  await page.waitForTimeout(400); // let lazy decodes paint
}

async function shoot(page, name) {
  await settleImages(page);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  log(`captured ${name}.png`);
}

/**
 * FAKE_COVERS=1 replaces the album-art CDN with generated placeholders —
 * for offline/sandboxed dev runs only (CI leaves it unset and loads real art).
 */
async function maybeFakeCovers(page) {
  if (process.env.FAKE_COVERS !== "1") return;
  await page.route("https://*.mzstatic.com/**", (route) => {
    const url = route.request().url();
    let h = 0;
    for (const c of url) h = (h * 31 + c.charCodeAt(0)) % 360;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
      `<rect width='400' height='400' fill='hsl(${h},42%,36%)'/>` +
      `<circle cx='200' cy='200' r='78' fill='hsl(${h},42%,26%)'/>` +
      `<circle cx='200' cy='200' r='26' fill='hsl(${h},30%,55%)'/></svg>`;
    route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
}

/** Real screenshots need real art: hard-fail if no cover actually loaded. */
async function assertCoversLoaded(page) {
  const loaded = await page.evaluate(
    () =>
      [...document.querySelectorAll(".covers img")].filter(
        (i) => i.complete && i.naturalWidth > 0,
      ).length,
  );
  if (loaded === 0) {
    throw new Error(
      "No album covers loaded — the art CDN is unreachable from this environment. " +
        "Refusing to publish cover-less screenshots. (Set FAKE_COVERS=1 for offline dev runs.)",
    );
  }
  log(`${loaded} covers loaded`);
}

// CHROMIUM_PATH lets environments with a pre-installed browser skip
// `playwright install` (CI installs its own matching build).
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

// -- Desktop context -------------------------------------------------------
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  timezoneId: "Europe/Paris",
});
await maybeFakeCovers(page);

// 1. Login screen (before anything else — no library state needed).
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await shoot(page, "login");

// 2. Kick off the demo sync from the empty state, wait until the grid fills.
await page.goto(`${BASE}/month`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /start sync/i }).click();
await page.waitForSelector(".day.has .covers img", { state: "attached", timeout: 60_000 });
// Sync writes items incrementally; wait for the item counter to stabilise.
await page.waitForFunction(
  () => {
    const stat = document.querySelector(".stat");
    if (!stat) return false;
    const n = stat.textContent ?? "";
    if (window.__lastStat === n) return (window.__stableTicks = (window.__stableTicks ?? 0) + 1) > 3;
    window.__lastStat = n;
    window.__stableTicks = 0;
    return false;
  },
  { timeout: 60_000, polling: 500 },
);
await settleImages(page);
await assertCoversLoaded(page);
await shoot(page, "month");

// 3. Day modal — open the busiest day of the visible month.
const busiest = await page.evaluateHandle(() => {
  const days = [...document.querySelectorAll(".day.has")];
  return days.reduce((a, b) =>
    +(a.querySelector(".count")?.textContent ?? 0) >=
    +(b.querySelector(".count")?.textContent ?? 0)
      ? a
      : b,
  );
});
await busiest.asElement().click();
await page.waitForSelector(".modal, [class*=modal]", { timeout: 10_000 });
await shoot(page, "day-modal");
await page.keyboard.press("Escape");

// 4. Year view.
await page.goto(`${BASE}/year`, { waitUntil: "networkidle" });
await page.waitForSelector("img", { state: "attached", timeout: 30_000 });
await shoot(page, "year");

// 5. List view.
await page.goto(`${BASE}/list`, { waitUntil: "networkidle" });
await page.waitForSelector("img", { state: "attached", timeout: 30_000 });
await shoot(page, "list");

// 6. Stats view.
await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shoot(page, "stats");

// 7. Filters in action — tick a genre and search from the panel.
await page.goto(`${BASE}/month`, { waitUntil: "networkidle" });
await page.waitForSelector(".day.has .covers img", { state: "attached", timeout: 30_000 });
const genreBox = page
  .locator(".filter-group", { hasText: "Genre" })
  .locator(".checkrow", { hasText: "hip hop" })
  .locator("input")
  .first();
if (await genreBox.count()) await genreBox.check({ force: true });
await page.waitForTimeout(600);
await shoot(page, "filters");

await page.close();

// -- Mobile context --------------------------------------------------------
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  timezoneId: "Europe/Paris",
});
await maybeFakeCovers(mobile);
// panel=0 collapses the filter panel, which overlays the grid at phone widths.
await mobile.goto(`${BASE}/month?panel=0`, { waitUntil: "networkidle" });
// Fresh context — sync again (fast: fixtures, no network pacing beyond 250ms/page).
// The filter panel can overlay the empty state at phone widths — dispatch the
// click on the DOM node directly instead of through the pointer.
await mobile.evaluate(() => {
  const btn = [...document.querySelectorAll(".empty-state button")].find((b) =>
    /start sync/i.test(b.textContent ?? ""),
  );
  btn?.click();
});
await mobile.waitForSelector(".day.has .covers img", { state: "attached", timeout: 60_000 });
await mobile.waitForTimeout(1500);
await settleImages(mobile);
await mobile.screenshot({ path: join(OUT, "mobile-month.png") });
log("captured mobile-month.png");
await mobile.close();

await browser.close();
log(`done -> ${OUT}`);
