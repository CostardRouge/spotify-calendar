"use client";

import { useMemo, useState } from "react";
import type { Album } from "@/lib/types";
import {
  artistIndex,
  genreIndex,
  yearBounds,
  type Filters,
} from "@/lib/library";

export default function FilterPanel({
  albums,
  filters,
  setFilters,
  collapsed,
}: {
  albums: Album[];
  filters: Filters;
  setFilters: (updater: (f: Filters) => Filters) => void;
  collapsed: boolean;
}) {
  const [artistQ, setArtistQ] = useState("");
  const [genreQ, setGenreQ] = useState("");

  const artists = useMemo(() => artistIndex(albums), [albums]);
  const genres = useMemo(() => genreIndex(albums), [albums]);
  const bounds = useMemo(() => yearBounds(albums), [albums]);

  const shownArtists = useMemo(
    () =>
      artists
        .filter((a) => a.name.toLowerCase().includes(artistQ.toLowerCase()))
        .slice(0, 300),
    [artists, artistQ],
  );
  const shownGenres = useMemo(
    () => genres.filter((g) => g.genre.toLowerCase().includes(genreQ.toLowerCase())),
    [genres, genreQ],
  );

  const toggle = (key: "artists" | "genres", value: string) =>
    setFilters((f) => {
      const next = new Set(f[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...f, [key]: next };
    });

  const kindCounts = useMemo(() => {
    let album = 0,
      track = 0;
    for (const a of albums) a.kind === "track" ? track++ : album++;
    return { album, track };
  }, [albums]);

  const toggleKind = (value: "album" | "track") =>
    setFilters((f) => {
      const next = new Set(f.kinds);
      next.has(value) ? next.delete(value) : next.add(value);
      // Never allow an empty selection — fall back to showing both.
      if (next.size === 0) {
        next.add("album");
        next.add("track");
      }
      return { ...f, kinds: next };
    });

  return (
    <aside className={"side" + (collapsed ? " collapsed" : "")}>
      <div className="side-inner">
        <h3>Filters</h3>

        <div className="filter-group">
          <span className="gl">Show</span>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={filters.kinds.has("album")}
              onChange={() => toggleKind("album")}
            />
            <span>Saved albums</span>
            <span className="cnt">{kindCounts.album}</span>
          </label>
          <label className="checkrow">
            <input
              type="checkbox"
              checked={filters.kinds.has("track")}
              onChange={() => toggleKind("track")}
            />
            <span>Liked songs</span>
            <span className="cnt">{kindCounts.track}</span>
          </label>
        </div>

        <div className="filter-group">
          <span className="gl">Search</span>
          <input
            className="search-input"
            placeholder="Album or artist…"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
          />
        </div>

        <div className="filter-group">
          <span className="gl">Release year</span>
          <div className="range-row">
            <input
              type="number"
              placeholder={bounds ? String(bounds[0]) : ""}
              value={filters.yearMin ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  yearMin: e.target.value ? +e.target.value : null,
                }))
              }
            />
            <span>to</span>
            <input
              type="number"
              placeholder={bounds ? String(bounds[1]) : ""}
              value={filters.yearMax ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  yearMax: e.target.value ? +e.target.value : null,
                }))
              }
            />
          </div>
        </div>

        <div className="filter-group">
          <span className="gl">Artist</span>
          <input
            className="mini-search"
            placeholder="Find artist…"
            value={artistQ}
            onChange={(e) => setArtistQ(e.target.value)}
          />
          <div className="checklist">
            {shownArtists.length === 0 && <div className="no-match">No matches</div>}
            {shownArtists.map((a) => (
              <label className="checkrow" key={a.id}>
                <input
                  type="checkbox"
                  checked={filters.artists.has(a.id)}
                  onChange={() => toggle("artists", a.id)}
                />
                <span>{a.name}</span>
                <span className="cnt">{a.count}</span>
              </label>
            ))}
          </div>
          {filters.artists.size > 0 && (
            <button
              className="clear-link"
              onClick={() =>
                setFilters((f) => ({ ...f, artists: new Set() }))
              }
            >
              Clear artists
            </button>
          )}
        </div>

        <div className="filter-group">
          <span className="gl">Genre</span>
          <input
            className="mini-search"
            placeholder="Find genre…"
            value={genreQ}
            onChange={(e) => setGenreQ(e.target.value)}
          />
          <div className="checklist">
            {shownGenres.length === 0 && (
              <div className="no-match">No genres found</div>
            )}
            {shownGenres.map((g) => (
              <label className="checkrow" key={g.genre}>
                <input
                  type="checkbox"
                  checked={filters.genres.has(g.genre)}
                  onChange={() => toggle("genres", g.genre)}
                />
                <span>{g.genre}</span>
                <span className="cnt">{g.count}</span>
              </label>
            ))}
          </div>
          {filters.genres.size > 0 && (
            <button
              className="clear-link"
              onClick={() => setFilters((f) => ({ ...f, genres: new Set() }))}
            >
              Clear genres
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
