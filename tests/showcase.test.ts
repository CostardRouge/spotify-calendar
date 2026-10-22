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

// llms.txt (C17, J2) is the showcase's summary for language models, served at
// its root by pages.yml. It is hand-written, so this suite holds it to the
// page: every address it names is the showcase, an anchor the page carries,
// or a GitHub address the page itself links to.
describe("the showcase's llms.txt", () => {
  const llms = readFileSync(join(process.cwd(), "showcase", "llms.txt"), "utf8");
  const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "pages.yml"), "utf8");

  it("follows the llmstxt.org shape: one H1, a summary, sections of links", () => {
    assert.match(llms, /^# spotify-calendar\n\n> \S/);
    assert.equal((llms.match(/^# /gm) ?? []).length, 1);
    assert.ok((llms.match(/^## /gm) ?? []).length >= 2);
  });

  it("names only addresses the showcase serves or links to", () => {
    const urls = [...llms.matchAll(/\]\((https:[^)]+)\)/g)].map((m) => m[1] as string);
    assert.ok(urls.includes(SITE), "links the showcase");
    assert.ok(urls.includes(`${SITE}#legal`), "links the legal notice");
    for (const url of urls) {
      if (url.startsWith(SITE)) {
        const anchor = url.slice(SITE.length);
        if (anchor) assert.match(html, new RegExp(`id="${anchor.slice(1)}"`), url);
      } else {
        assert.ok(html.includes(`href="${url}"`), `the page links ${url}`);
      }
    }
  });

  it("is copied to the showcase's root by the Pages workflow", () => {
    assert.match(workflow, /cp showcase\/llms\.txt site\//);
  });
});
