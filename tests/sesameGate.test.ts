import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gateOpen, gatePublic, openFlow, originFrom, safeNext, sealFlow, sealGate } from "../lib/sesameGate.ts";

// lib/sesameGate.ts: the signed cookies that put Sésame in front of the app.

describe("the Sésame gate", () => {
  it("opens with a cookie sealed by the same secret, and only while alive", async () => {
    const raw = await sealGate("sub-1", "secret", 1_000);
    assert.equal(await gateOpen(raw, "secret", 2_000), true);
    assert.equal(await gateOpen(raw, "another", 2_000), false);
    assert.equal(await gateOpen(raw, "secret", 1_000 + 31 * 24 * 3600 * 1000), false);
    assert.equal(await gateOpen(undefined, "secret"), false);
    assert.equal(await gateOpen("forged.value", "secret"), false);
  });

  it("refuses an edited cookie, and a flow cookie passed as a gate", async () => {
    const raw = await sealGate("sub-1", "secret");
    const [, sig] = raw.split(".");
    const edited = Buffer.from(JSON.stringify({ sub: "sub-2", exp: Date.now() + 1e6 })).toString("base64url");
    assert.equal(await gateOpen(`${edited}.${sig}`, "secret"), false);
    const flow = await sealFlow({ state: "s", verifier: "v", next: "/" }, "secret");
    assert.equal(await gateOpen(flow, "secret"), false);
  });

  it("carries the round trip and keeps next on this site", async () => {
    const raw = await sealFlow({ state: "s", verifier: "v", next: "/week?d=1" }, "secret");
    assert.deepEqual(await openFlow(raw, "secret"), { state: "s", verifier: "v", next: "/week?d=1" });
    assert.equal(await openFlow(raw, "another"), null);
    const evil = await sealFlow({ state: "s", verifier: "v", next: "//evil.example" }, "secret");
    assert.equal((await openFlow(evil, "secret"))?.next, "/");
    for (const bad of ["//x", "/\\x", "https://x", "", null]) assert.equal(safeNext(bad), "/");
  });

  it("leaves open only the round trip and the healthcheck", () => {
    assert.equal(gatePublic("/api/health"), true);
    assert.equal(gatePublic("/api/auth/sesame/callback"), true);
    assert.equal(gatePublic("/api/auth/sesame"), true);
    assert.equal(gatePublic("/api/auth/login"), false, "the Spotify sign-in is behind the gate");
    assert.equal(gatePublic("/month"), false);
    assert.equal(gatePublic("/api/auth/sesamex"), false);
  });

  it("builds the origin the browser used, behind Traefik", () => {
    const h = new Headers({ host: "calendar.steeve.website", "x-forwarded-proto": "https" });
    assert.equal(originFrom(h, "http://0.0.0.0:3000"), "https://calendar.steeve.website");
  });
});
