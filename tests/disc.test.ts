import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { discLayout } from "../lib/disc.ts";

describe("the year as a record", () => {
  const counts = { "2026-01-01": 1, "2026-07-16": 5, "2026-12-01": 2, "2025-07-16": 9 };
  const disc = discLayout(counts, 2026, 400);

  it("draws twelve grooves, January innermost, December at the rim, inside the record", () => {
    assert.equal(disc.rings.length, 12);
    for (let i = 1; i < 12; i++) assert.ok(disc.rings[i].r > disc.rings[i - 1].r);
    assert.ok(disc.rings[0].r > disc.label, "the first groove clears the label");
    assert.ok(disc.rings[11].r < 200, "the last groove stays on the record");
  });

  it("keeps only the year's days, in date order", () => {
    assert.deepEqual(
      disc.dots.map((d) => d.dateKey),
      ["2026-01-01", "2026-07-16", "2026-12-01"],
    );
  });

  it("puts the first of a month at twelve o'clock on its own groove", () => {
    const jan = disc.dots[0];
    assert.equal(jan.cx, 200);
    assert.equal(jan.cy, 200 - disc.rings[0].r);
    const dec = disc.dots[2];
    assert.equal(dec.cy, 200 - disc.rings[11].r);
  });

  it("places the middle of a month half a lap round, at six o'clock", () => {
    // July has 31 days: the 16th is 15/31 of a lap, just short of six o'clock,
    // so a hair to the right of the vertical (clockwise, as a record turns).
    const jul = disc.dots[1];
    assert.ok(jul.cy > 200 + disc.rings[6].r * 0.99 && jul.cx > 200 && jul.cx - 200 < 20);
  });

  it("grows a dot with its count, never wide enough to touch the next groove", () => {
    const gap = disc.rings[1].r - disc.rings[0].r;
    assert.ok(disc.dots[1].r > disc.dots[0].r);
    const huge = discLayout({ "2026-03-03": 400 }, 2026, 400).dots[0];
    assert.ok(huge.r * 2 < gap);
  });
});
