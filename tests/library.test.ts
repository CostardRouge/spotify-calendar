import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activeMonths,
  artistIndex,
  computeStats,
  emptyFilters,
  filterAlbums,
  groupByDay,
} from "../lib/library.ts";
import type { Album } from "../lib/types.ts";

/** A library item with sensible defaults; `addedAt` is UTC, `dateKey` its day. */
function item(
  id: string,
  addedAt: string,
  over: Partial<Album> = {},
): Album {
  return {
    id,
    kind: "album",
    name: `Album ${id}`,
    addedAt,
    dateKey: addedAt.slice(0, 10),
    year: 2000,
    cover: "",
    artists: [{ id: "a1", name: "Artist One" }],
    genres: [],
    ...over,
  };
}

const monday = item("m1", "2026-10-19T08:00:00Z");
const mondayLater = item("m2", "2026-10-19T20:00:00Z", {
  kind: "track",
  name: "Song",
  albumName: "The Record",
  year: 1994,
  artists: [{ id: "a2", name: "Artist Two" }],
  genres: ["hip hop"],
});
const tuesday = item("t1", "2026-10-20T09:00:00Z", {
  year: null,
  genres: ["jazz", "hip hop"],
});
const library = [monday, mondayLater, tuesday];

describe("groupByDay", () => {
  it("groups by the day key and keeps each day's order", () => {
    const byDay = groupByDay(library);
    assert.deepEqual(Object.keys(byDay).sort(), ["2026-10-19", "2026-10-20"]);
    assert.deepEqual(
      byDay["2026-10-19"].map((i) => i.id),
      ["m1", "m2"],
    );
    assert.deepEqual(
      byDay["2026-10-20"].map((i) => i.id),
      ["t1"],
    );
  });

  it("gives an empty library no days at all", () => {
    assert.deepEqual(groupByDay([]), {});
  });
});

describe("filterAlbums", () => {
  it("shows everything with the empty filters", () => {
    assert.equal(filterAlbums(library, emptyFilters()).length, 3);
  });

  it("filters by kind, text, release year, artist and genre", () => {
    const ids = (f: Partial<ReturnType<typeof emptyFilters>>) =>
      filterAlbums(library, { ...emptyFilters(), ...f }).map((i) => i.id);

    assert.deepEqual(ids({ kinds: new Set(["track"]) }), ["m2"]);
    // Text matches the name, a track's album and the artists, case-insensitively.
    assert.deepEqual(ids({ search: "the record" }), ["m2"]);
    assert.deepEqual(ids({ search: "ARTIST ONE" }), ["m1", "t1"]);
    // A year range excludes items whose release year is unknown.
    assert.deepEqual(ids({ yearMin: 1990, yearMax: 1999 }), ["m2"]);
    assert.deepEqual(ids({ yearMin: 2000 }), ["m1"]);
    assert.deepEqual(ids({ artists: new Set(["a2"]) }), ["m2"]);
    assert.deepEqual(ids({ genres: new Set(["hip hop"]) }), ["m2", "t1"]);
    assert.deepEqual(ids({ genres: new Set(["jazz"]), kinds: new Set(["track"]) }), []);
  });
});

describe("computeStats", () => {
  it("counts kinds, finds the busiest day and the first and last saves", () => {
    const stats = computeStats(library);
    assert.equal(stats.totalAlbums, 2);
    assert.equal(stats.totalTracks, 1);
    assert.equal(stats.uniqueArtists, 2);
    assert.equal(stats.uniqueGenres, 2);
    assert.deepEqual(stats.busiestDay, { dateKey: "2026-10-19", count: 2 });
    assert.equal(stats.firstSave, "2026-10-19");
    assert.equal(stats.lastSave, "2026-10-20");
    assert.deepEqual(stats.topArtist, { name: "Artist One", count: 2 });
    assert.deepEqual(stats.topGenre, { genre: "hip hop", count: 2 });
    assert.deepEqual(stats.perYearAdded, [{ year: 2026, count: 3 }]);
    // Release decades count only items with a known year, oldest first.
    assert.deepEqual(stats.perDecade, [
      { decade: "1990s", count: 1 },
      { decade: "2000s", count: 1 },
    ]);
  });

  it("answers an empty library with nulls, not errors", () => {
    const stats = computeStats([]);
    assert.equal(stats.busiestDay, null);
    assert.equal(stats.firstSave, null);
    assert.equal(stats.topArtist, null);
    assert.deepEqual(stats.perDecade, []);
  });
});

describe("indexes", () => {
  it("lists artists by how many items they appear on", () => {
    assert.deepEqual(artistIndex(library), [
      { id: "a1", name: "Artist One", count: 2 },
      { id: "a2", name: "Artist Two", count: 1 },
    ]);
  });

  it("lists the months with saves, newest first, once each", () => {
    const older = item("o1", "2025-02-14T10:00:00Z");
    assert.deepEqual(activeMonths([older, ...library]), [
      [2026, 9],
      [2025, 1],
    ]);
  });
});
