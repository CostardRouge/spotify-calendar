import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SPOTIFY_IMAGE_HOSTS, contentSecurityPolicy, securityHeaders } from "../lib/security.ts";

// The headers every response carries (COMMON-PROJECT-SPEC C16): one list in
// lib/security.ts, applied by next.config.ts. This suite holds the list to
// what the app loads, and next.config.ts to the list.
const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("the security headers", () => {
  it("carry the five fixed headers and a report-only policy, never an enforced one", () => {
    const keys = securityHeaders("production").map((h) => h.key);
    assert.deepEqual(keys, [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
      "Content-Security-Policy-Report-Only",
    ]);
    assert.ok(!keys.includes("Content-Security-Policy"), "enforcement is a decision, not a drift");
    for (const { value } of securityHeaders("production")) {
      assert.doesNotMatch(value, /[\r\n]/, "a header value is one line");
    }
  });

  it("allow exactly what the pages load", () => {
    const csp = contentSecurityPolicy(false);
    assert.equal(directive(csp, "default-src"), "'self'");
    assert.equal(directive(csp, "script-src"), "'self' 'unsafe-inline'");
    assert.equal(directive(csp, "connect-src"), "'self'");
    assert.equal(directive(csp, "frame-ancestors"), "'none'");
    assert.equal(directive(csp, "object-src"), "'none'");
    assert.equal(directive(csp, "base-uri"), "'self'");
    const img = directive(csp, "img-src") ?? "";
    assert.match(img, /^'self' data: /);
    for (const host of SPOTIFY_IMAGE_HOSTS) assert.ok(img.includes(host), host);
  });

  it("let React rebuild stacks in development only", () => {
    assert.match(contentSecurityPolicy(true), /'unsafe-eval'/);
    assert.doesNotMatch(contentSecurityPolicy(false), /'unsafe-eval'/);
    const dev = securityHeaders("development").find((h) => h.key === "Content-Security-Policy-Report-Only");
    assert.match(dev?.value ?? "", /'unsafe-eval'/);
  });

  it("are what next.config.ts applies to every path, with the same image hosts", () => {
    // next.config.ts cannot be imported here (its import of `next` is a type,
    // but Next's own loader is what resolves it); the text is held instead.
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    assert.match(config, /import \{ SPOTIFY_IMAGE_HOSTS, securityHeaders \} from "\.\/lib\/security\.ts"/);
    assert.match(config, /headers: async \(\) => \[\{ source: "\/:path\*", headers: securityHeaders\(\) \}\]/);
    assert.match(config, /remotePatterns: SPOTIFY_IMAGE_HOSTS\.map/);
    assert.doesNotMatch(config, /scdn\.co|spotifycdn\.com/, "the hosts live in lib/security.ts alone");
  });
});
