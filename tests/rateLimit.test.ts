import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { clearRateLimit, getRateLimit, noteRateLimit } from "../lib/rateLimit.ts";

// The record is module-level state shared by the server process: start every
// test from a clear one, on a clock the test controls.
const NOW = 1_700_000_000_000;

describe("the shared rate-limit cooldown", () => {
  beforeEach(() => {
    mock.timers.reset();
    mock.timers.enable({ apis: ["Date"], now: NOW });
    clearRateLimit();
  });

  it("is clear until a 429 is noted", () => {
    assert.deepEqual(getRateLimit(), { limited: false, retryAfter: 0, until: null });
  });

  it("answers a 429 with the seconds left and the moment it ends", () => {
    noteRateLimit(30);
    assert.deepEqual(getRateLimit(), { limited: true, retryAfter: 30, until: NOW + 30_000 });
    mock.timers.tick(10_500);
    // Remaining seconds round up: the client must never come back early.
    assert.equal(getRateLimit().retryAfter, 20);
  });

  it("never shortens a cooldown already recorded", () => {
    noteRateLimit(60);
    noteRateLimit(5);
    assert.equal(getRateLimit().until, NOW + 60_000);
    noteRateLimit(120);
    assert.equal(getRateLimit().until, NOW + 120_000);
  });

  it("clears itself once the time has passed, and on request", () => {
    noteRateLimit(30);
    mock.timers.tick(30_000);
    assert.equal(getRateLimit().limited, false);
    noteRateLimit(30);
    clearRateLimit();
    assert.equal(getRateLimit().limited, false);
  });

  it("treats a missing or negative Retry-After as no cooldown", () => {
    noteRateLimit(-5);
    assert.equal(getRateLimit().limited, false);
    noteRateLimit(0);
    assert.equal(getRateLimit().limited, false);
  });
});
