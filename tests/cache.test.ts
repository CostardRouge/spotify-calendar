import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { purgeLegacyCache } from "../lib/cache.ts";

const DIR = mkdtempSync(join(tmpdir(), "sillon-cache-"));
after(() => rmSync(DIR, { recursive: true, force: true }));

describe("the legacy cache cleanup", () => {
  it("removes the genre files and leaves the library store alone", () => {
    writeFileSync(join(DIR, "genre_abc.json"), '{"ts":1,"data":[]}');
    writeFileSync(join(DIR, "genre-v2_def.json"), '{"ts":1,"data":[]}');
    writeFileSync(join(DIR, "genres-withheld.json"), '{"ts":1,"data":true}');
    mkdirSync(join(DIR, "library"));
    writeFileSync(join(DIR, "library", "library_u_123.json"), "{}");
    writeFileSync(join(DIR, "notes.txt"), "kept");

    assert.equal(purgeLegacyCache(DIR), 3);
    assert.deepEqual(readdirSync(DIR).sort(), ["library", "notes.txt"]);
    assert.deepEqual(readdirSync(join(DIR, "library")), ["library_u_123.json"]);
  });

  it("does nothing, quietly, when the folder is empty or missing", () => {
    assert.equal(purgeLegacyCache(DIR), 0);
    assert.equal(purgeLegacyCache(join(DIR, "nowhere")), 0);
  });
});
