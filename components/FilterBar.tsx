"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Album } from "@/lib/types";
import { artistIndex, emptyFilters, yearBounds, type Filters, type Kind } from "@/lib/library";
import Icon from "@/components/Icons";
import { useDismiss } from "@/components/useDismiss";

type SetFilters = (updater: (f: Filters) => Filters) => void;

/**
 * A filter that needs a list or two fields opens a menu from the bar — the
 * long lists (dozens of artists) cannot stay open beside the views the way the
 * old side column held them. On a phone the menu is a sheet from the bottom.
 */
function FilterMenu({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div className="fmenu" ref={ref}>
      <button
        className={"fchip" + (active ? " on" : "")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <Icon name="chevron" />
      </button>
      {open && (
        <>
          <button className="fmenu-scrim" aria-label="Close" onClick={close} />
          <div className="fmenu-pop" role="dialog" aria-label={label}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The filters, always in view above the calendar: what to show (all, albums,
 * songs), the search, and the artist and release-year menus. They were a side
 * column that could be folded away; the owner wanted them in sight and the
 * views in the side rail instead (design canvas, iteration 3).
 */
export default function FilterBar({
  albums,
  filters,
  setFilters,
  shown,
}: {
  albums: Album[];
  filters: Filters;
  setFilters: SetFilters;
  /** How many items pass the filters. */
  shown: number;
}) {
  const [artistQ, setArtistQ] = useState("");
  const artists = useMemo(() => artistIndex(albums), [albums]);
  const bounds = useMemo(() => yearBounds(albums), [albums]);
  const counts = useMemo(() => {
    let album = 0;
    let track = 0;
    for (const a of albums) a.kind === "track" ? track++ : album++;
    return { album, track };
  }, [albums]);
  const shownArtists = useMemo(() => {
    const q = artistQ.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 300);
  }, [artists, artistQ]);

  // The kinds set is never empty (lib/library.ts): "All" is both.
  const kind: "all" | Kind = filters.kinds.size === 1 ? [...filters.kinds][0] : "all";
  const setKind = (k: "all" | Kind) =>
    setFilters((f) => ({
      ...f,
      kinds: new Set<Kind>(k === "all" ? ["album", "track"] : [k]),
    }));

  const toggleArtist = (id: string) =>
    setFilters((f) => {
      const next = new Set(f.artists);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, artists: next };
    });

  const picked = artists.filter((a) => filters.artists.has(a.id));
  const artistLabel =
    picked.length === 0
      ? "Artist"
      : picked.length === 1
        ? `Artist · ${picked[0].name}`
        : `Artists · ${picked.length}`;
  const yearActive = filters.yearMin != null || filters.yearMax != null;
  const yearLabel = yearActive
    ? `Released ${filters.yearMin ?? "…"}–${filters.yearMax ?? "…"}`
    : "Released";
  const narrowed = kind !== "all" || !!filters.search || picked.length > 0 || yearActive;

  const segs: { id: "all" | Kind; label: string; n: number }[] = [
    { id: "all", label: "All", n: albums.length },
    { id: "album", label: "Albums", n: counts.album },
    { id: "track", label: "Songs", n: counts.track },
  ];

  return (
    <div className="filterbar">
      <div className="seg" role="radiogroup" aria-label="Show">
        {segs.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={kind === s.id}
            className={kind === s.id ? "on" : ""}
            onClick={() => setKind(s.id)}
          >
            {s.label} <span className="seg-n">{s.n}</span>
          </button>
        ))}
      </div>

      <label className="fsearch">
        <Icon name="search" />
        <input
          className="search-input"
          type="search"
          placeholder="Album or artist…"
          aria-label="Search albums and artists"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </label>

      <FilterMenu label={artistLabel} active={picked.length > 0}>
        <input
          className="mini-search"
          placeholder="Find an artist…"
          aria-label="Find an artist"
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
                onChange={() => toggleArtist(a.id)}
              />
              <span>{a.name}</span>
              <span className="cnt">{a.count}</span>
            </label>
          ))}
        </div>
        {picked.length > 0 && (
          <button className="clear-link" onClick={() => setFilters((f) => ({ ...f, artists: new Set() }))}>
            Clear artists
          </button>
        )}
      </FilterMenu>

      <FilterMenu label={yearLabel} active={yearActive}>
        <span className="fmenu-title">Release year</span>
        <div className="range-row">
          <input
            type="number"
            aria-label="From year"
            placeholder={bounds ? String(bounds[0]) : ""}
            value={filters.yearMin ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, yearMin: e.target.value ? +e.target.value : null }))
            }
          />
          <span>to</span>
          <input
            type="number"
            aria-label="To year"
            placeholder={bounds ? String(bounds[1]) : ""}
            value={filters.yearMax ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, yearMax: e.target.value ? +e.target.value : null }))
            }
          />
        </div>
        {yearActive && (
          <button
            className="clear-link"
            onClick={() => setFilters((f) => ({ ...f, yearMin: null, yearMax: null }))}
          >
            Clear years
          </button>
        )}
      </FilterMenu>

      <div className="stat">
        <b>{shown}</b>
        {narrowed ? (
          <>
            {" "}
            of {albums.length}
            <button
              className="clear-link"
              onClick={() =>
setFilters(() => emptyFilters())
              }
            >
              Clear
            </button>
          </>
        ) : (
          " saves"
        )}
      </div>
    </div>
  );
}
