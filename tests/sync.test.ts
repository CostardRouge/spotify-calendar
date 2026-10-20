import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeCooldown, appendUnique, initialJob, resumeOffset } from "../lib/sync.ts";
import type { Album } from "../lib/types.ts";

function item(id: string, kind: Album["kind"] = "album"): Album {
  return {
    id,
    kind,
    name: id,
    addedAt: "2026-10-19T08:00:00Z",
    dateKey: "2026-10-19",
    year: null,
    cover: "",
    artists: [],
    genres: [],
  };
}

describe("resumeOffset", () => {
  it("resumes a kind after the items of that kind already held", () => {
    const held = [item("a1"), item("t1", "track"), item("a2"), item("t2", "track"), item("t3", "track")];
    assert.equal(resumeOffset(held, "album"), 2);
    assert.equal(resumeOffset(held, "track"), 3);
    assert.equal(resumeOffset([], "album"), 0);
  });
});

describe("appendUnique", () => {
  it("appends the items not yet held, in their order, after the held ones", () => {
    const held = [item("a1"), item("a2")];
    const next = appendUnique(held, [item("a2"), item("a3"), item("a4"), item("a3")]);
    assert.deepEqual(
      next.map((i) => i.id),
      ["a1", "a2", "a3", "a4"],
    );
    assert.deepEqual(
      held.map((i) => i.id),
      ["a1", "a2"],
    );
  });

  it("hands back the held list itself when a page brings nothing new", () => {
    const held = [item("a1"), item("a2")];
    assert.equal(appendUnique(held, [item("a1")]), held);
    assert.equal(appendUnique(held, []), held);
  });
});

describe("activeCooldown", () => {
  const now = 1_700_000_000_000;

  it("waits for the later of the persisted and the server cooldowns", () => {
    assert.equal(activeCooldown(now + 5_000, now + 60_000, now), now + 60_000);
    assert.equal(activeCooldown(now + 60_000, now + 5_000, now), now + 60_000);
    assert.equal(activeCooldown(null, now + 5_000, now), now + 5_000);
    assert.equal(activeCooldown(now + 5_000, undefined, now), now + 5_000);
  });

  it("is over once both have elapsed, or were never recorded", () => {
    assert.equal(activeCooldown(now - 1, now - 1_000, now), null);
    assert.equal(activeCooldown(now, null, now), null);
    assert.equal(activeCooldown(null, null, now), null);
  });
});

describe("initialJob", () => {
  it("starts idle, with nothing loaded and no cooldown", () => {
    const job = initialJob();
    assert.equal(job.status, "idle");
    assert.equal(job.phase, "");
    assert.deepEqual(job.albums, { loaded: 0, total: null });
    assert.equal(job.rateLimitedUntil, null);
    assert.deepEqual(job.logs, []);
  });
});
