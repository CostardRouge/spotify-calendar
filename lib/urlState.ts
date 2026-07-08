import { emptyFilters, type Filters, type Kind } from "./library";
import type { ViewMode } from "./dates";

const VIEWS: ViewMode[] = ["month", "week", "day", "year", "list", "stats"];
const KINDS: Kind[] = ["album", "track"];
const isDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The slice of app state we reflect in the URL. */
export interface UrlState {
  view: ViewMode;
  anchorKey: string | null; // YYYY-MM-DD; null for views without navigation
  filters: Filters;
  collapsed: boolean;
}

/** Serialize state into query params, omitting anything at its default. */
export function stateToSearch(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.view !== "month") p.set("view", s.view);
  if (s.anchorKey) p.set("d", s.anchorKey);

  const f = s.filters;
  if (f.search) p.set("q", f.search);
  if (f.yearMin != null) p.set("ymin", String(f.yearMin));
  if (f.yearMax != null) p.set("ymax", String(f.yearMax));
  if (f.artists.size) p.set("artists", [...f.artists].join(","));
  if (f.genres.size) p.set("genres", [...f.genres].join(","));
  // kinds defaults to both; only serialize when narrowed.
  if (f.kinds.size && f.kinds.size !== KINDS.length)
    p.set("kinds", [...f.kinds].join(","));
  if (s.collapsed) p.set("panel", "0");

  return p.toString();
}

/** Parse query params back into a partial state (only keys present in the URL). */
export function searchToState(search: string): Partial<UrlState> {
  const p = new URLSearchParams(search);
  const out: Partial<UrlState> = {};

  const view = p.get("view");
  if (view && (VIEWS as string[]).includes(view)) out.view = view as ViewMode;

  const d = p.get("d");
  if (d && isDateKey(d)) out.anchorKey = d;

  const f = emptyFilters();
  let touched = false;

  const q = p.get("q");
  if (q) { f.search = q; touched = true; }

  const ymin = p.get("ymin");
  if (ymin != null && ymin !== "" && !Number.isNaN(Number(ymin))) {
    f.yearMin = Number(ymin); touched = true;
  }
  const ymax = p.get("ymax");
  if (ymax != null && ymax !== "" && !Number.isNaN(Number(ymax))) {
    f.yearMax = Number(ymax); touched = true;
  }

  const artists = p.get("artists");
  if (artists) { f.artists = new Set(artists.split(",").filter(Boolean)); touched = true; }

  const genres = p.get("genres");
  if (genres) { f.genres = new Set(genres.split(",").filter(Boolean)); touched = true; }

  const kinds = p.get("kinds");
  if (kinds) {
    const valid = kinds.split(",").filter((k): k is Kind => (KINDS as string[]).includes(k));
    if (valid.length) { f.kinds = new Set(valid); touched = true; }
  }

  if (touched) out.filters = f;
  if (p.get("panel") === "0") out.collapsed = true;

  return out;
}
