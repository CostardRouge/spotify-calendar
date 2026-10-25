import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The showcase on GitHub Pages is a public page (COMMON-PROJECT-SPEC, C17):
// findable, with a legal notice whose facts the page must keep true. The page
// loads one inline script — the Umami loader and the notice's switch — and
// nothing else; this suite holds the HTML to that, and the notice to the code.
const SITE = "https://costardrouge.github.io/spotify-calendar/";
const html = readFileSync(join(process.cwd(), "showcase", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const loader = scripts[0]?.[2] ?? "";
const constant = (name: string) => loader.match(new RegExp(`const ${name} = "([^"]*)"`))?.[1];
// The notice's visible text: no script, no style, no comment, no tag.
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

describe("the showcase page", () => {
  it("loads exactly one inline script and no other third-party resource", () => {
    assert.equal(scripts.length, 1, "one script");
    assert.equal(scripts[0]?.[1], "", "inline, no src or attribute");
    assert.equal((html.match(/<script/g) ?? []).length, 1);
    // A resource is a src= or a stylesheet/icon href=; links to GitHub are fine.
    assert.equal((html.match(/\bsrc="https?:/g) ?? []).length, 0, "no remote src");
    for (const link of html.match(/<link[^>]*>/g) ?? []) {
      if (/rel="canonical"/.test(link)) continue;
      assert.doesNotMatch(link, /href="https?:/, link);
    }
    assert.doesNotMatch(html, /@import|fonts\.googleapis|fonts\.gstatic/);
    // The script's only remote address is the tracker's.
    const urls = loader.match(/https?:\/\/[^"'\s]+/g) ?? [];
    assert.deepEqual(urls, ["https://insight.steevepommier.com/insight"]);
  });

  it("loads the self-hosted Umami tracker with the showcase's id, and only for visitors who did not decline", () => {
    assert.equal(constant("WEBSITE_ID"), "3607d2c6-a9b8-4146-9aeb-bb03d6a0671b");
    assert.equal(constant("SRC"), "https://insight.steevepommier.com/insight");
    assert.equal(constant("DOMAINS"), "costardrouge.github.io");
    assert.equal(constant("KEY"), "umami.disabled");
    // An empty id loads nothing; DNT, GPC and the opt-out key stop the load itself.
    assert.match(loader, /if \(WEBSITE_ID && !dnt && !gpc && !optedOut\(\)\)/);
    assert.match(loader, /navigator\.doNotTrack/);
    assert.match(loader, /navigator\.globalPrivacyControl === true/);
    assert.match(loader, /tag\.defer = true/);
    for (const attr of ["data-website-id", "data-domains", "data-do-not-track", "data-exclude-search", "data-exclude-hash"]) {
      assert.match(loader, new RegExp(`setAttribute\\("${attr}"`), attr);
    }
    // Automatic tracking only: no custom event, no data sent by hand.
    assert.doesNotMatch(html, /umami\.track|data-umami-event|data-auto-track/);
  });

  it("states in its legal notice what the tracker does, and offers the switch", () => {
    assert.ok(text.includes(new URL(constant("SRC") ?? "").host), "names the tracker's host");
    assert.ok(text.includes(constant("DOMAINS") ?? "-"), "names the counted domain");
    assert.ok(text.includes(constant("KEY") ?? "-"), "names the opt-out key");
    assert.match(text, /self-hosted/);
    assert.match(text, /Do Not Track/);
    assert.match(text, /Global Privacy Control/);
    assert.match(text, /without query string or fragment/);
    assert.match(text, /your country, derived from your IP address/);
    assert.match(text, /your IP address is not stored/);
    assert.match(text, /No cookie is set/);
    assert.match(text, /No event is sent/);
    assert.match(text, /does not even load the counter and nothing is sent/);
    assert.match(html, /<button type="button" class="btn" id="audience-toggle" hidden><\/button>/);
    assert.match(loader, /storage\.setItem\(KEY, "1"\)/);
    assert.match(loader, /storage\.removeItem\(KEY\)/);
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
    assert.match(html, /<h3>Audience measurement<\/h3>/);
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
