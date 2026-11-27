#!/usr/bin/env node
/**
 * Rasterises the home-screen and favicon PNGs from the three SVG sources in
 * public/icons/, and the result is committed (COMMON-PROJECT-SPEC, C11).
 *
 * Why PNGs at all: an SVG favicon is enough for a desktop tab and for nothing
 * else. iOS builds a home-screen icon from <link rel="apple-touch-icon">
 * alone — a PNG, square, opaque — and ignores rel="icon" whatever its type;
 * with no such link it screenshots the page instead. Android's launcher wants
 * the manifest's 192/512 PNGs, plus a maskable pair so its own shape mask
 * never clips the drawing. The showcase on GitHub Pages cannot rasterise on
 * request, and one committed set serves the app and the showcase alike.
 *
 * Usage:  node scripts/gen-icons.mjs
 *
 * sharp is an optional dependency of Next.js and is already in node_modules;
 * should that ever change, `npm i --no-save sharp` installs it for one run —
 * deliberately never a dependency of this project, so CI pays no native
 * install for a script run by hand. Re-run after editing a source, and commit
 * the PNGs in the same commit: the SVG is not what ships to a phone.
 * tests/icons.test.ts holds the sizes and the touch icon's missing alpha.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** The tile's own ink: what a transparent pixel is painted onto where alpha is dropped. */
const TILE = "#15110e";

/**
 * `flatten` + `removeAlpha` drop the alpha channel, for the touch icon only:
 * iOS composites a transparent pixel onto BLACK, so an icon with rounded
 * corners of its own comes back framed in a dark vignette under Apple's mask.
 * The rounded tile keeps its transparent corners everywhere else.
 *
 * @type {{ src: string; out: string; size: number; opaque?: boolean; why: string }[]}
 */
const JOBS = [
  // Manifest "any" icons — Chrome/Android install, the tab on high-DPI.
  { src: "icon.svg", out: "icon-192.png", size: 192, why: "manifest, any" },
  { src: "icon.svg", out: "icon-512.png", size: 512, why: "manifest, any + splash" },
  // Maskable pair — Android adaptive launcher shapes.
  { src: "icon-maskable.svg", out: "icon-maskable-192.png", size: 192, why: "manifest, maskable" },
  { src: "icon-maskable.svg", out: "icon-maskable-512.png", size: 512, why: "manifest, maskable" },
  // The one iOS reads. 180 is what current iPhones ask for; iOS downsamples
  // for every other slot, so a single size is enough.
  { src: "icon-apple.svg", out: "apple-touch-icon.png", size: 180, opaque: true, why: "iOS home screen" },
  // Raster favicons, for the browsers that still prefer one to the SVG.
  { src: "icon.svg", out: "favicon-32.png", size: 32, why: "tab" },
  { src: "icon.svg", out: "favicon-16.png", size: 16, why: "tab" },
];

for (const job of JOBS) {
  const svg = readFileSync(join(ICONS_DIR, job.src));
  let pipeline = sharp(svg, { density: 384 }).resize(job.size, job.size);
  if (job.opaque) pipeline = pipeline.flatten({ background: TILE }).removeAlpha();
  await pipeline.png().toFile(join(ICONS_DIR, job.out));
  console.log(`✓ ${job.out} (${job.size}×${job.size}) — ${job.why}`);
}

// favicon.ico, at the site root because browsers ask for it blindly: the 16
// and 32 PNGs just written, wrapped in an ICO container (PNG entries are
// valid in an ICO since Windows Vista and in every current browser).
const entries = ["favicon-16.png", "favicon-32.png"].map((name) => readFileSync(join(ICONS_DIR, name)));
const header = Buffer.alloc(6 + 16 * entries.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((data, i) => {
  const size = i === 0 ? 16 : 32;
  const at = 6 + 16 * i;
  header[at] = size; // width
  header[at + 1] = size; // height
  header.writeUInt16LE(1, at + 4); // colour planes
  header.writeUInt16LE(32, at + 6); // bits per pixel
  header.writeUInt32LE(data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += data.length;
});
writeFileSync(join(ICONS_DIR, "..", "favicon.ico"), Buffer.concat([header, ...entries]));
console.log("✓ favicon.ico (16 + 32) — the root favicon");

console.log("Done. Commit the PNGs alongside the SVG you changed.");
