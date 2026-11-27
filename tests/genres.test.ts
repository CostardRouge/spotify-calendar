import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// lib/cache.ts reads CACHE_DIR when it is imported: point it at a scratch
// folder first, then import.
const DIR = mkdtempSync(join(tmpdir(), "sillon-cache-"));
process.env.CACHE_DIR = DIR;
const { getCache, purgeCache, setCache } = await import("../lib/cache.ts");
const { fetchArtistGenres } = await import("../lib/spotify.ts");

after(() => rmSync(DIR, { recursive: true, force: true }));

/** Replaces fetch with canned artist answers and counts the calls. */
function mockSpotify(answer: (id: string) => object) {
  const calls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const id = String(url).split("/artists/")[1];
    calls.push(id);
    return new Response(JSON.stringify(answer(id)), { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = real) };
}

describe("the artist genre lookup", () => {
  it("stops at the first artist Spotify answers without a genres field", async () => {
    // What the Home Lab instance got on 2026-11-27: no genres, popularity or followers.
    const spotify = mockSpotify((id) => ({ id, name: "Drake", images: [], type: "artist" }));
    const seen: string[] = [];
    try {
      await assert.rejects(
        fetchArtistGenres("token", ["a", "b", "c"], Date.now() + 60_000, (id) => seen.push(id)),
        (e: { genresWithheld?: boolean }) => e.genresWithheld === true,
      );
    } finally {
      spotify.restore();
    }
    assert.deepEqual(spotify.calls, ["a"], "one call, not one per artist");
    assert.deepEqual(seen, [], "nothing reported, so nothing cached");
  });

  it("reports genres, and an empty list as a definitive answer, when the field is there", async () => {
    const spotify = mockSpotify((id) => ({ id, genres: id === "a" ? ["french rap"] : [] }));
    const seen: [string, string[], boolean][] = [];
    try {
      await fetchArtistGenres("token", ["a", "b"], Date.now() + 60_000, (id, g, d) => seen.push([id, g, d]));
    } finally {
      spotify.restore();
    }
    assert.deepEqual(seen, [
      ["a", ["french rap"], true],
      ["b", [], true],
    ]);
  });
});

describe("purging the cache", () => {
  it("removes the legacy genre: generation and keeps genre-v2", () => {
    setCache("genre:x1", []);
    setCache("genre:x2", []);
    setCache("genre-v2:y1", ["pop"]);
    assert.equal(purgeCache("genre_"), 2);
    assert.deepEqual(readdirSync(DIR).sort(), ["genre-v2_y1.json"]);
    assert.deepEqual(getCache<string[]>("genre-v2:y1")?.data, ["pop"]);
  });

  it("removes only the entries its predicate accepts, from disk and memory", () => {
    setCache("genre-v2:empty", []);
    setCache("genre-v2:full", ["rap"]);
    const empty = (e: { data: unknown }) => Array.isArray(e.data) && e.data.length === 0;
    assert.equal(purgeCache("genre-v2_", empty), 1);
    assert.equal(getCache("genre-v2:empty"), null, "gone from memory too");
    assert.deepEqual(getCache<string[]>("genre-v2:full")?.data, ["rap"]);
  });

  it("drops an unreadable file and survives a missing folder", () => {
    writeFileSync(join(DIR, "genre-v2_broken.json"), "{not json");
    assert.equal(purgeCache("genre-v2_broken"), 1);
    process.env.CACHE_DIR = join(DIR, "nowhere");
  });
});
