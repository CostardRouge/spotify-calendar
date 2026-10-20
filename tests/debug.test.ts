import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { debug, syncDebugEnabled } from "../lib/debug.ts";

describe("the SYNC_DEBUG instrumentation", () => {
  afterEach(() => {
    delete process.env.SYNC_DEBUG;
    mock.restoreAll();
  });

  it('stays silent unless SYNC_DEBUG is exactly "1"', () => {
    const log = mock.method(console, "log", () => {});
    delete process.env.SYNC_DEBUG;
    debug("token refresh -> 200 in 80ms scope=\"user-library-read\"");
    process.env.SYNC_DEBUG = "true";
    debug("token refresh -> 200 in 80ms scope=\"user-library-read\"");
    assert.equal(log.mock.callCount(), 0);
    assert.equal(syncDebugEnabled(), false);
  });

  it("prefixes every line with [SYNC-DEBUG] once turned on", () => {
    const log = mock.method(console, "log", () => {});
    process.env.SYNC_DEBUG = "1";
    assert.equal(syncDebugEnabled(), true);
    debug("GET /me -> 200 in 12ms", "detail");
    assert.equal(log.mock.callCount(), 1);
    assert.deepEqual(log.mock.calls[0].arguments, ["[SYNC-DEBUG] GET /me -> 200 in 12ms", "detail"]);
  });
});
