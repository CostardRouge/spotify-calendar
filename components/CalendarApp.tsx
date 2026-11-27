"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Album } from "@/lib/types";
import { activeMonths, emptyFilters, filterAlbums, randomDay, type Filters } from "@/lib/library";
import { stateToSearch, searchToState } from "@/lib/urlState";
import {
  MONTHS,
  keyOf,
  startOfWeek,
  addDays,
  addMonths,
  addYears,
  type ViewMode,
} from "@/lib/dates";
import { useSync } from "@/components/SyncProvider";
import SyncWidget from "@/components/SyncWidget";
import Calendar from "@/components/Calendar";
import WeekView from "@/components/WeekView";
import DayView from "@/components/DayView";
import YearView from "@/components/YearView";
import ListView from "@/components/ListView";
import StatsView from "@/components/StatsView";
import FilterPanel from "@/components/FilterPanel";
import DayModal from "@/components/DayModal";
import MiniPlayer from "@/components/MiniPlayer";
import Icon from "@/components/Icons";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "year", label: "Year" },
  // The list reads as a journal now: the days, newest first, one under the other.
  { id: "list", label: "Journal" },
  { id: "stats", label: "Stats" },
];

const latestOf = (list: Album[]) =>
  list.reduce(
    (m, a) => (+new Date(a.addedAt) > +m ? new Date(a.addedAt) : m),
    new Date(0),
  );

export default function CalendarApp({
  initialView,
  version,
}: {
  initialView: ViewMode;
  // package.json's version, read on the server (lib/version.ts) — never
  // imported here, or the whole package.json would ship to the browser.
  version: string;
}) {
  const { items, hydrated, job, isRunning, start } = useSync();

  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [collapsed, setCollapsed] = useState(false);
  // On a phone the panel is a drawer, closed on every load. It is its own
  // state, not `collapsed`, so opening it on a phone never writes `panel=` into
  // a link that a desktop then opens.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleFilters = () => {
    if (window.matchMedia("(max-width: 768px)").matches) setDrawerOpen((o) => !o);
    else setCollapsed((c) => !c);
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The view is owned by the route (/month, /week, …), so it's known before the
  // first paint — no post-mount correction, no flash of the wrong view.
  const [view, setView] = useState<ViewMode>(initialView);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // `anchor` (and the grid's "today" marker) depend on the current date, which
  // differs between the static server render and the client. Hold back the
  // date-dependent UI until after mount so the first client render matches the
  // server HTML, then reveal the real dates.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Point the calendar at the most recent save, once, when data first appears.
  const initedRef = useRef(false);
  useEffect(() => {
    if (!initedRef.current && items.length) {
      initedRef.current = true;
      setAnchor(latestOf(items));
    }
  }, [items]);

  // Restore the remaining state (filters, anchor, collapsed) from the URL once,
  // on mount, before we start writing it back.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const init = searchToState(window.location.search);
    if (init.anchorKey) {
      setAnchor(new Date(init.anchorKey + "T00:00:00"));
      initedRef.current = true; // an explicit date beats the auto-jump-to-latest
    }
    if (init.filters) setFilters(init.filters);
    if (init.collapsed != null) setCollapsed(init.collapsed);
    setUrlReady(true);
  }, []);

  // Once React has committed the restored panel state, hand control back to it:
  // drop the pre-hydration attribute the head script set and enable the panel
  // transition (deferred a frame so restoring a collapsed panel never animates).
  useEffect(() => {
    if (!urlReady) return;
    const el = document.documentElement;
    el.removeAttribute("data-panel-collapsed");
    const id = requestAnimationFrame(() => el.classList.add("app-ready"));
    return () => cancelAnimationFrame(id);
  }, [urlReady]);

  // Mirror state into the URL so a refresh (or shared link) restores the view.
  // The view lives in the path; filters/anchor/collapsed stay in the query.
  useEffect(() => {
    if (!urlReady) return;
    const hasNavView = view !== "list" && view !== "stats";
    const qs = stateToSearch({
      anchorKey: hasNavView ? keyOf(anchor) : null,
      filters,
      collapsed,
    });
    const url = qs ? `/${view}?${qs}` : `/${view}`;
    window.history.replaceState(null, "", url);
  }, [urlReady, view, anchor, filters, collapsed]);

  const filtered = useMemo(() => filterAlbums(items, filters), [items, filters]);
  const months = useMemo(() => activeMonths(items), [items]);
  // Group active months under their year so the picker can render <optgroup>s:
  // year headings, with the months that have saves listed beneath each.
  const monthsByYear = useMemo(() => {
    const groups: { year: number; months: number[] }[] = [];
    for (const [y, m] of months) {
      let g = groups[groups.length - 1];
      if (!g || g.year !== y) {
        g = { year: y, months: [] };
        groups.push(g);
      }
      g.months.push(m);
    }
    return groups;
  }, [months]);
  const likedSongs = useMemo(
    () => items.filter((i) => i.kind === "track").length,
    [items],
  );
  const latestDate = useMemo(
    () => (items.length ? latestOf(items) : new Date()),
    [items],
  );
  const dayAlbums = useMemo(
    () => (selectedDay ? filtered.filter((a) => a.dateKey === selectedDay) : []),
    [selectedDay, filtered],
  );

  const step = (dir: number) => {
    if (view === "month") setAnchor((a) => addMonths(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "year") setAnchor((a) => addYears(a, dir));
  };
  const hasNav = view !== "list" && view !== "stats";

  // "Drop the needle": open a random day that holds saves (within the current
  // filters), in the day view.
  const dropNeedle = () => {
    const key = randomDay(filtered);
    if (!key) return;
    setAnchor(new Date(key + "T00:00:00"));
    setView("day");
    setDrawerOpen(false);
  };

  // On the day view a horizontal swipe turns the page: left for the next day,
  // right for the previous. Only a clearly horizontal gesture counts, so a
  // vertical scroll through a long day never skips one.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || view !== "day") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  const headerLabel = () => {
    switch (view) {
      case "month":
        return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
      case "week": {
        const s = startOfWeek(anchor);
        const e = addDays(s, 6);
        return `Week of ${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
      }
      case "day":
        // Short names keep the title on one line on a phone.
        return anchor.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      case "year":
        return String(anchor.getFullYear());
      case "list":
        return "Journal";
      case "stats":
        return "Library stats";
    }
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const showEmpty = hydrated && items.length === 0;

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="btn icon"
          onClick={toggleFilters}
          title="Filters"
          aria-label="Filters"
          aria-controls="filters"
        >
          <Icon name="filters" />
        </button>
        <div className="logo">
          <span className="mark" aria-hidden="true" /> sillon
        </div>
        <nav className="viewswitch">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={"vbtn" + (view === v.id ? " active" : "")}
              onClick={() => setView(v.id)}
              title={v.label}
              aria-current={view === v.id ? "page" : undefined}
            >
              <Icon name={v.id} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <button
          className="btn icon settings-btn"
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
          title="Options"
          aria-label="Options"
        >
          <Icon name="options" />
        </button>
        <div className={"topbar-actions" + (settingsOpen ? " open" : "")}>
          <div className="stat">
            <b>{filtered.length}</b> <span className="stat-sep">of</span>{" "}
            {items.length}
          </div>
          <SyncWidget />
          <button className="btn" onClick={logout}>
            Log out
          </button>
          <div className="version" title="Sillon version">
            v{version}
          </div>
        </div>
      </header>

      <main className="main">
        <FilterPanel
          albums={items}
          filters={filters}
          setFilters={setFilters}
          collapsed={collapsed}
          drawerOpen={drawerOpen}
        />
        {drawerOpen && (
          <button
            className="side-scrim"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        <section className="cal">
          <div className="cal-head">
            {hasNav && (
              <>
                <button className="btn icon" onClick={() => step(-1)} aria-label="Previous">
                  <Icon name="prev" />
                </button>
                <div className="month-label">{mounted ? headerLabel() : ""}</div>
                <button className="btn icon" onClick={() => step(1)} aria-label="Next">
                  <Icon name="next" />
                </button>
                {mounted && (
                  <select
                    value={`${anchor.getFullYear()}-${anchor.getMonth()}`}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split("-").map(Number);
                      setAnchor(new Date(y, m, 1));
                    }}
                    title="Jump to a month with saved items"
                  >
                    {monthsByYear.map((g) => (
                      <optgroup key={g.year} label={String(g.year)}>
                        {g.months.map((m) => (
                          <option key={`${g.year}-${m}`} value={`${g.year}-${m}`}>
                            {MONTHS[m]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                <button className="btn" onClick={() => setAnchor(new Date(latestDate))}>
                  Latest
                </button>
              </>
            )}
            {!hasNav && <div className="month-label">{headerLabel()}</div>}
            <div className="spacer" />
            {filtered.length > 0 && (
              <button
                className="btn ghost needle-btn"
                onClick={dropNeedle}
                title="Drop the needle: open a random day from your library"
                aria-label="Drop the needle"
              >
                <Icon name="needle" />
                <span className="needle-label">Drop the needle</span>
              </button>
            )}
          </div>

          <div className="view-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {showEmpty ? (
              <div className="empty-state">
                <span className="mark" aria-hidden="true" />
                <h2>No records yet</h2>
                <p>
                  {job.status === "error"
                    ? "The last sync ran into an error."
                    : "Sync your Spotify library to fill the calendar."}
                </p>
                <div className="empty-actions">
                  <button className="btn primary" onClick={start}>
                    {job.status === "paused" ? "Resume sync" : "Start sync"}
                  </button>
                  <Link className="btn" href="/sync">
                    Sync details
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {mounted && view === "month" && (
                  <Calendar
                    albums={filtered}
                    year={anchor.getFullYear()}
                    month={anchor.getMonth()}
                    onSelectDay={setSelectedDay}
                  />
                )}
                {mounted && view === "week" && (
                  <WeekView albums={filtered} anchor={anchor} onSelectDay={setSelectedDay} />
                )}
                {mounted && view === "day" && (
                  <DayView
                    albums={filtered}
                    anchor={anchor}
                    onGoToDay={(key) => setAnchor(new Date(key + "T00:00:00"))}
                  />
                )}
                {mounted && view === "year" && (
                  <YearView
                    albums={filtered}
                    year={anchor.getFullYear()}
                    onSelectDay={setSelectedDay}
                    onSelectMonth={(m) => {
                      setAnchor(new Date(anchor.getFullYear(), m, 1));
                      setView("month");
                    }}
                  />
                )}
                {view === "list" && <ListView albums={filtered} />}
                {view === "stats" && (
                  <StatsView albums={items} likedSongs={likedSongs} />
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <nav className="bottomnav">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={"bnav-btn" + (view === v.id ? " active" : "")}
            aria-current={view === v.id ? "page" : undefined}
            onClick={() => {
              setView(v.id);
              setDrawerOpen(false);
            }}
          >
            <Icon name={v.id} />
            {v.label}
          </button>
        ))}
      </nav>

      {selectedDay && dayAlbums.length > 0 && (
        <DayModal
          dateKey={selectedDay}
          albums={dayAlbums}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <MiniPlayer />
    </div>
  );
}
