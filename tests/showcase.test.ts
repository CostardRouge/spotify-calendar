import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The showcase on GitHub Pages is a public page (COMMON-PROJECT-SPEC, C17):
// findable, with a legal notice whose facts the page must keep true. The
// notice says the page loads no script and no third-party resource — this
// suite is what holds the HTML to that sentence.
const SITE = "https://costardrouge.github.io/spotify-calendar/";
const html = readFileSync(join(process.cwd(), "showcase", "index.html"), "utf8");

describe("the showcase page", () => {
  it("loads no script and no third-party resource, as its legal notice says", () => {
    assert.equal((html.match(/<script/g) ?? []).length, 0);
    // A resource is a src= or a stylesheet/icon href=; links to GitHub are fine.
    assert.equal((html.match(/\bsrc="https?:/g) ?? []).length, 0, "no remote src");
    for (const link of html.match(/<link[^>]*>/g) ?? []) {
      if (/rel="canonical"/.test(link)) continue;
      assert.doesNotMatch(link, /href="https?:/, link);
    }
    assert.doesNotMatch(html, /@import|fonts\.googleapis|fonts\.gstatic/);
  });

  it("names its canonical address and an absolute 1200 × 630 card for link previews", () => {
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}" />`));
    assert.match(html, new RegExp(`<meta property="og:url" content="${SITE}" />`));
    assert.match(html, new RegExp(`<meta property="og:image" content="${SITE}og-image.png" />`));
    assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
    assert.match(html, /<meta property="og:image:height" content="630" \/>/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, "one h1");
    // The card is public/og-image.png, which pages.yml copies beside the page.
    const png = readFileSync(join(process.cwd(), "public", "og-image.png"));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  });

  it("carries the legal notice: publisher, host, what is measured, licence", () => {
    assert.match(html, /<section class="legal[^"]*" id="legal"/);
    assert.match(html, /Steeve Pommier/);
    assert.match(html, /GitHub Pages: GitHub, Inc\./);
    assert.match(html, /no tracker, no analytics script and no third-party resource/);
    assert.match(html, /MIT licence/);
    assert.match(html, /<a href="#legal">Legal notice<\/a>/);
  });
});
