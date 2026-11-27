import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The installed-app and link-preview surface: what fails silently in a desktop
// browser and only shows on a phone or in a chat — a shortcut to a view that
// does not exist, a preview card of the wrong size, a static file the Sésame
// gate turns into a login redirect, a worker that starts caching pages. Read
// from the files themselves, no server needed.
const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");
const read = (...path: string[]) => readFileSync(join(ROOT, ...path), "utf8");

describe("the installed app", () => {
  const manifest = JSON.parse(read("public", "manifest.webmanifest")) as {
    shortcuts: { name: string; url: string; icons: { src: string }[] }[];
  };
  // app/[view]/page.tsx's own list: a shortcut to anything else 404s.
  const views = /const VIEWS: ViewMode\[\] = \[([^\]]+)\]/.exec(read("app", "[view]", "page.tsx"))?.[1] ?? "";

  it("points every shortcut at a view and an icon that exists, relative to the manifest", () => {
    assert.ok(manifest.shortcuts.length > 0 && manifest.shortcuts.length <= 4, "Android shows four at most");
    for (const s of manifest.shortcuts) {
      assert.ok(!s.url.startsWith("/"), `${s.name}: relative, like start_url`);
      const view = s.url.split("?")[0];
      assert.ok(views.includes(`"${view}"`), `${s.name}: /${view} is one of the views`);
      for (const icon of s.icons) assert.ok(existsSync(join(PUBLIC, icon.src)), `${icon.src} exists`);
    }
  });

  it("lets the page reach the screen's edges, so the safe-area insets are real", () => {
    assert.match(read("app", "layout.tsx"), /viewportFit: "cover"/);
    assert.match(read("app", "globals.css"), /env\(safe-area-inset-bottom\)/);
  });

  it("ships a 1200×630 opaque link-preview card", () => {
    const png = readFileSync(join(PUBLIC, "og-image.png"));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
    assert.ok(![4, 6].includes(png[25]), "no alpha: a dark chat theme would show it on black");
  });

  it("keeps the files fetched without a session outside the Sésame gate, and nothing else", () => {
    const pattern = /matcher:\s*\["([^"]+)"\]/.exec(read("proxy.ts"))?.[1];
    assert.ok(pattern, "proxy.ts declares one matcher");
    const gated = (path: string) => new RegExp(`^${pattern}$`).test(path);
    for (const path of [
      "/sw.js",
      "/offline.html",
      "/robots.txt",
      "/og-image.png",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/icons/icon-192.png",
    ]) {
      assert.equal(gated(path), false, `${path} is served without a session`);
      assert.ok(existsSync(join(PUBLIC, path)), `${path} is a static file in public/`);
    }
    for (const path of ["/", "/month", "/stats", "/sync", "/login", "/api/library", "/api/player"]) {
      assert.equal(gated(path), true, `${path} stays behind the gate`);
    }
  });

  it("has a worker that caches the offline page and nothing else", () => {
    const sw = read("public", "sw.js");
    assert.match(sw, /offline\.html/);
    assert.doesNotMatch(sw, /\.put\(|addAll\(/, "a cached shell outlives the deploy that renamed its scripts");
    assert.match(sw, /request\.mode !== "navigate"/, "only page loads are intercepted");
    assert.match(read("components", "ServiceWorker.tsx"), /NODE_ENV !== "production"/, "never in next dev");
  });

  it("asks crawlers to stay out of a private instance", () => {
    assert.match(read("public", "robots.txt"), /^User-agent: \*\nDisallow: \/$/m);
    assert.match(read("app", "layout.tsx"), /robots: \{ index: false, follow: false/);
  });
});
