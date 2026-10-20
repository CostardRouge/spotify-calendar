// A save lands on the day the BROWSER sees, so the day keys are computed in
// local time. The runner gives each file its own process, so pinning a zone far
// from UTC here makes "local, not UTC" a real assertion on CI (which runs UTC).
process.env.TZ = "Pacific/Auckland";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonths, keyOf, startOfWeek } from "../lib/dates.ts";

describe("keyOf", () => {
  it("writes the day as YYYY-MM-DD, month and day padded", () => {
    assert.equal(keyOf(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
    assert.equal(keyOf(new Date(2026, 11, 31)), "2026-12-31");
  });

  it("keys a save by its local day, not its UTC day", () => {
    // 13:30 UTC on 1 March is already 2 March in Auckland (UTC+13 in summer).
    assert.equal(keyOf(new Date("2026-03-01T13:30:00Z")), "2026-03-02");
  });
});

describe("date arithmetic", () => {
  it("adds days and months without touching the given date", () => {
    const jan31 = new Date(2026, 0, 31);
    assert.equal(keyOf(addDays(jan31, 1)), "2026-02-01");
    assert.equal(keyOf(addDays(jan31, -31)), "2025-12-31");
    assert.equal(keyOf(addMonths(new Date(2026, 0, 15), 1)), "2026-02-15");
    assert.equal(keyOf(addMonths(new Date(2026, 11, 15), 1)), "2027-01-15");
    assert.equal(keyOf(jan31), "2026-01-31");
  });

  it("starts the week on Sunday at midnight", () => {
    const wednesday = new Date(2026, 9, 21, 15, 45); // 2026-10-21 is a Wednesday
    const start = startOfWeek(wednesday);
    assert.equal(keyOf(start), "2026-10-18");
    assert.equal(start.getDay(), 0);
    assert.deepEqual(
      [start.getHours(), start.getMinutes(), start.getSeconds()],
      [0, 0, 0],
    );
  });
});
