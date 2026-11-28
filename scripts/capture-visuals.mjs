#!/usr/bin/env node
/**
 * Captures the REAL-APP images kept in docs/visuals/ (the owner's site,
 * CHANGELOG entries, GitHub Releases): every view, night and day, desktop
 * 1440×900 and phone 390×844, at deviceScaleFactor 2, plus one 1200×630
 * social card. Unlike scripts/showcase-screenshots.mjs (CI, site/, one theme),
 * this one is run by hand and its output is committed.
 *
 *   DEMO_MODE=1 npm run build && DEMO_MODE=1 npm start &
 *   node scripts/capture-visuals.mjs [outDir]          # default docs/visuals
 *
 * Env: BASE_URL (default http://127.0.0.1:3000), CHROMIUM_PATH. Playwright is
 * not a dependency: `npm i --no-save playwright` or link a pre-installed one.
 * Real covers only — the demo library's art CDN must be reachable; there is
 * deliberately no FAKE_COVERS here, since these images are published.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] ?? "docs/visuals";
mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(`[visuals] ${m}`);

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const THEMES = ["night", "day"];

/** Same rule as the showcase script: visible images loaded, then a beat for decodes. */
async function settleImages(page, timeout = 30_000) {
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("img")].every((i) => {
          const r = i.getBoundingClientRect();
          const inView = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
          return i.complete || i.style.display === "none" || !inView;
        }),
      { timeout },
    )
    .catch(() => log("some images never settled — capturing anyway"));
  await page.waitForTimeout(600);
}

/** A fresh browser context opens on the empty state until a sync has run once on the server. */
async function ensureLibrary(page) {
  await page.goto(`${BASE}/month`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: /start sync/i });
  await Promise.race([
    btn.waitFor({ timeout: 15_000 }),
    page.waitForSelector(".wall-cover img, .day-art img", { state: "attached", timeout: 15_000 }),
  ]).catch(() => {});
  if (await btn.count()) await btn.first().click();
  await page.waitForSelector(".wall-cover img, .day-art img", { state: "attached", timeout: 90_000 });
  // Wait for the sync to finish: the account summary stops changing.
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      if (window.__last === t) return (window.__ticks = (window.__ticks ?? 0) + 1) > 4;
      window.__last = t;
      window.__ticks = 0;
      return false;
    },
    { timeout: 90_000, polling: 500 },
  );
}

async function shoot(page, name) {
  await settleImages(page);
  await page.screenshot({ path: join(OUT, `${name}@2x.png`) });
  log(`captured ${name}@2x.png`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

for (const [device, opts] of Object.entries(DEVICES)) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 2, timezoneId: "Europe/Paris" });
    // The theme and the wall's one-time explanation are per-device prefs
    // (lib/prefs.ts); setting them before the first paint keeps both out of the frame.
    await ctx.addInitScript(
      ([t]) => {
        try {
          localStorage.setItem("slc_theme", t);
          localStorage.setItem("slc_wall_hint_seen", "1");
        } catch {}
      },
      [theme],
    );
    const page = await ctx.newPage();
    await ensureLibrary(page);
    const tag = `${theme}-${device}`;

    await page.goto(`${BASE}/month`, { waitUntil: "networkidle" });
    await page.waitForSelector(".wall-cover img", { state: "attached", timeout: 30_000 });
    await shoot(page, `app-month-wall-${tag}`);

    await page.getByRole("radio", { name: "Grid" }).click();
    await page.waitForSelector(".day.has .day-art img", { state: "attached", timeout: 30_000 });
    await shoot(page, `app-month-grid-${tag}`);
    await page.getByRole("radio", { name: "Wall" }).click();

    for (const view of ["week", "day", "list", "stats"]) {
      await page.goto(`${BASE}/${view}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      await shoot(page, `app-${view === "list" ? "journal" : view}-${tag}`);
    }

    await page.goto(`${BASE}/year`, { waitUntil: "networkidle" });
    await page.waitForSelector(".disc .dot", { state: "attached", timeout: 30_000 });
    await shoot(page, `app-year-${tag}`);

    // One social-card frame (1200×630, the og:image ratio) of the month at
    // night, in Grid: a cover per day reads at that size where the wall's
    // first rows are mostly date tiles.
    if (device === "desktop" && theme === "night") {
      await page.setViewportSize({ width: 1200, height: 630 });
      await page.goto(`${BASE}/month`, { waitUntil: "networkidle" });
      await page.getByRole("radio", { name: "Grid" }).click();
      await page.waitForSelector(".day.has .day-art img", { state: "attached", timeout: 30_000 });
      await shoot(page, "app-social-card-month-grid-night-1200x630");
      await page.getByRole("radio", { name: "Wall" }).click();
    }
    await ctx.close();
  }
}

await browser.close();
log(`done -> ${OUT}`);
