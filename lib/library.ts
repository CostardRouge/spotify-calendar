import type { Album } from "./types";

export type Kind = "album" | "track";

export interface Filters {
  search: string;
  yearMin: number | null;
  yearMax: number | null;
  artists: Set<string>;
  genres: Set<string>;
  kinds: Set<Kind>; // which sources to show (albums / liked tracks)
}

export const emptyFilters = (): Filters => ({
  search: "",
  yearMin: null,
  yearMax: null,
  artists: new Set(),
  genres: new Set(),
  kinds: new Set<Kind>(["album", "track"]),
});

export function albumPasses(al: Album, f: Filters): boolean {
  if (f.kinds.size && !f.kinds.has(al.kind)) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = (
      al.name +
      " " +
      (al.albumName ?? "") +
      " " +
      al.artists.map((a) => a.name).join(" ")
    ).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.yearMin != null && (al.year == null || al.year < f.yearMin)) return false;
  if (f.yearMax != null && (al.year == null || al.year > f.yearMax)) return false;
  if (f.artists.size && !al.artists.some((a) => f.artists.has(a.id))) return false;
  if (f.genres.size && !al.genres.some((g) => f.genres.has(g))) return false;
  return true;
}

export function filterAlbums(albums: Album[], f: Filters): Album[] {
  return albums.filter((a) => albumPasses(a, f));
}

export function groupByDay(albums: Album[]): Record<string, Album[]> {
  const m: Record<string, Album[]> = {};
  for (const al of albums) (m[al.dateKey] ??= []).push(al);
  return m;
}

/**
 * "Drop the needle": one day that holds at least one of `albums`, picked at
 * random — a way back into a library too long to scroll. Every day weighs the
 * same, however many saves it holds, so a quiet Tuesday comes up as often as
 * a binge. `rand` is injectable so the pick is testable. Null when empty.
 */
export function randomDay(albums: Album[], rand: () => number = Math.random): string | null {
  const days = [...new Set(albums.map((a) => a.dateKey))].sort();
  if (!days.length) return null;
  return days[Math.min(days.length - 1, Math.floor(rand() * days.length))];
}

/** Shifts a YYYY-MM-DD key by `days`, in calendar days (UTC arithmetic, no DST). */
function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * "A year ago": the saves of the same day one year before `dateKey` — or, when
 * that day is empty, of the nearest day within `window` days of it (the earlier
 * one on a tie). A strict same-day match is rare in a personal library and an
 * empty memory card is no memory at all, hence the window. 29 February looks
 * back to 28 February. Null when nothing falls within the window.
 */
export function yearAgo(
  albums: Album[],
  dateKey: string,
  window = 3,
): { dateKey: string; items: Album[] } | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  const lastYear = new Date(Date.UTC(y - 1, m - 1, d));
  // Date.UTC rolls 29 Feb of a leap year into 1 March of the year before.
  if (lastYear.getUTCMonth() !== m - 1) lastYear.setUTCDate(0);
  const target = lastYear.toISOString().slice(0, 10);
  const byDay = groupByDay(albums);
  for (let off = 0; off <= window; off++) {
    for (const k of off === 0 ? [target] : [shiftKey(target, -off), shiftKey(target, off)]) {
      const items = byDay[k];
      if (items?.length) return { dateKey: k, items };
    }
  }
  return null;
}

export interface ArtistEntry {
  id: string;
  name: string;
  count: number;
}

export function artistIndex(albums: Album[]): ArtistEntry[] {
  const idx: Record<string, ArtistEntry> = {};
  for (const al of albums)
    for (const a of al.artists) {
      idx[a.id] ??= { id: a.id, name: a.name, count: 0 };
      idx[a.id].count++;
    }
  return Object.values(idx).sort((a, b) => b.count - a.count);
}

export function genreIndex(albums: Album[]): { genre: string; count: number }[] {
  const idx: Record<string, number> = {};
  for (const al of albums) for (const g of al.genres) idx[g] = (idx[g] ?? 0) + 1;
  return Object.entries(idx)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

/** [year, monthIndex] pairs that contain saves, newest first. */
export function activeMonths(albums: Album[]): [number, number][] {
  const set = new Set<string>();
  for (const al of albums) {
    const d = new Date(al.addedAt);
    set.add(d.getFullYear() + "-" + d.getMonth());
  }
  return [...set]
    .map((s) => s.split("-").map(Number) as [number, number])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
}

export function yearBounds(albums: Album[]): [number, number] | null {
  const years = albums.map((a) => a.year).filter((y): y is number => y != null);
  if (!years.length) return null;
  return [Math.min(...years), Math.max(...years)];
}

export interface LibraryStats {
  totalAlbums: number;
  totalTracks: number;
  uniqueArtists: number;
  uniqueGenres: number;
  topArtist: { name: string; count: number } | null;
  topGenre: { genre: string; count: number } | null;
  firstSave: string | null; // dateKey
  lastSave: string | null; // dateKey
  busiestDay: { dateKey: string; count: number } | null;
  perYearAdded: { year: number; count: number }[]; // items added per calendar year
  perDecade: { decade: string; count: number }[]; // by release decade
}

/** Compute global stats from the (unfiltered) item list (albums + tracks). */
export function computeStats(items: Album[]): LibraryStats {
  const albums = items; // includes both kinds; counts split below
  const artists = artistIndex(albums);
  const genres = genreIndex(albums);

  const byDay = groupByDay(albums);
  let busiest: { dateKey: string; count: number } | null = null;
  for (const [dateKey, list] of Object.entries(byDay)) {
    if (!busiest || list.length > busiest.count) busiest = { dateKey, count: list.length };
  }

  const sortedByAdded = [...albums].sort(
    (a, b) => +new Date(a.addedAt) - +new Date(b.addedAt),
  );

  const perYear: Record<number, number> = {};
  for (const al of albums) {
    const y = new Date(al.addedAt).getFullYear();
    perYear[y] = (perYear[y] ?? 0) + 1;
  }
  const perYearAdded = Object.entries(perYear)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);

  const perDec: Record<string, number> = {};
  for (const al of albums) {
    if (al.year == null) continue;
    const dec = `${Math.floor(al.year / 10) * 10}s`;
    perDec[dec] = (perDec[dec] ?? 0) + 1;
  }
  const perDecade = Object.entries(perDec)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => parseInt(a.decade) - parseInt(b.decade));

  return {
    totalAlbums: items.filter((i) => i.kind === "album").length,
    totalTracks: items.filter((i) => i.kind === "track").length,
    uniqueArtists: artists.length,
    uniqueGenres: genres.length,
    topArtist: artists[0]
      ? { name: artists[0].name, count: artists[0].count }
      : null,
    topGenre: genres[0] ? { genre: genres[0].genre, count: genres[0].count } : null,
    firstSave: sortedByAdded[0]?.dateKey ?? null,
    lastSave: sortedByAdded[sortedByAdded.length - 1]?.dateKey ?? null,
    busiestDay: busiest,
    perYearAdded,
    perDecade,
  };
}
