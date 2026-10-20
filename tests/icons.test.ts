import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The icon set (COMMON-PROJECT-SPEC, C11) is committed PNGs drawn by
// scripts/gen-icons.mjs: a forgotten regeneration, a wrong size or a touch
// icon that kept its alpha (iOS composites it onto black) fails here, not on
// a phone. The PNG header is read directly: width and height at bytes 16–23,
// the colour type at byte 25 (2 = RGB, 6 = RGBA).
const ICONS = join(process.cwd(), "public", "icons");
const PUBLIC = join(process.cwd(), "public");

function png(name: string) {
  const bytes = readFileSync(join(ICONS, name));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${name} is a PNG`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

describe("the icon set", () => {
  it("ships the three SVG sources", () => {
    for (const name of ["icon.svg", "icon-apple.svg", "icon-maskable.svg"]) {
      assert.ok(existsSync(join(ICONS, name)), name);
    }
  });

  it("ships every PNG at the size its name claims", () => {
    const sizes: Record<string, number> = {
      "favicon-16.png": 16,
      "favicon-32.png": 32,
      "icon-192.png": 192,
      "icon-512.png": 512,
      "icon-maskable-192.png": 192,
      "icon-maskable-512.png": 512,
      "apple-touch-icon.png": 180,
    };
    for (const [name, size] of Object.entries(sizes)) {
      const { width, height } = png(name);
      assert.deepEqual([width, height], [size, size], name);
    }
  });

  it("keeps the touch icon opaque, because iOS paints a transparent pixel black", () => {
    assert.equal(png("apple-touch-icon.png").colorType, 2);
  });

  it("names the manifest's icons relatively, and they exist", () => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4);
    const purposes = new Set<string>();
    for (const icon of manifest.icons) {
      assert.doesNotMatch(icon.src, /^\//, `${icon.src} is relative`);
      assert.ok(existsSync(join(PUBLIC, icon.src)), icon.src);
      const { width } = png(icon.src.replace(/^icons\//, ""));
      assert.equal(icon.sizes, `${width}x${width}`, icon.src);
      purposes.add(icon.purpose);
    }
    assert.deepEqual([...purposes].sort(), ["any", "maskable"]);
    assert.doesNotMatch(manifest.start_url, /^\//, "start_url is relative");
  });
});
