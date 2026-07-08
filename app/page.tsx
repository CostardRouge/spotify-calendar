"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Album } from "@/lib/types";
import { activeMonths, emptyFilters, filterAlbums, type Filters } from "@/lib/library";
import { stateToSearch, searchToState } from "@/lib/urlState";
import {
  MONTHS,
  keyOf,
  formatDay,
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

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "year", label: "Year" },
  { id: "list", label: "List" },
  { id: "stats", label: "Stats" },
];

const latestOf = (list: Album[]) =>
  list.reduce(
    (m, a) => (+new Date(a.addedAt) > +m ? new Date(a.addedAt) : m),
    new Date(0),
  );

export default function HomePage() {
  const { items, hydrated, job, isRunning, start } = useSync();

  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Point the calendar at the most recent save, once, when data first appears.
  const initedRef = useRef(false);
  useEffect(() => {
    if (!initedRef.current && items.length) {
      initedRef.current = true;
      setAnchor(latestOf(items));
    }
  }, [items]);

  // Restore state from the URL once, on mount, before we start writing it back.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const init = searchToState(window.location.search);
    if (init.view) setView(init.view);
    if (init.anchorKey) {
      setAnchor(new Date(init.anchorKey + "T00:00:00"));
      initedRef.current = true; // an explicit date beats the auto-jump-to-latest
    }
    if (init.filters) setFilters(init.filters);
    if (init.collapsed != null) setCollapsed(init.collapsed);
    setUrlReady(true);
  }, []);

  // Mirror state into the URL so a refresh (or shared link) restores the view.
  useEffect(() => {
    if (!urlReady) return;
    const hasNavView = view !== "list" && view !== "stats";
    const qs = stateToSearch({
      view,
      anchorKey: hasNavView ? keyOf(anchor) : null,
      filters,
      collapsed,
    });
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [urlReady, view, anchor, filters, collapsed]);

  const filtered = useMemo(() => filterAlbums(items, filters), [items, filters]);
  const months = useMemo(() => activeMonths(items), [items]);
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
        return formatDay(keyOf(anchor));
      case "year":
        return String(anchor.getFullYear());
      case "list":
        return "All saved items";
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
          onClick={() => setCollapsed((c) => !c)}
          title="Toggle filters"
        >
          ☰
        </button>
        <div className="logo">
          <span className="dot" /> Library Calendar
        </div>
        <nav className="viewswitch">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={"vbtn" + (view === v.id ? " active" : "")}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <SyncWidget />
        <div className="stat">
          <b>{filtered.length}</b> of {items.length}
        </div>
        <button className="btn" onClick={logout}>
          Log out
        </button>
      </header>

      <main className="main">
        <FilterPanel
          albums={items}
          filters={filters}
          setFilters={setFilters}
          collapsed={collapsed}
        />

        <section className="cal">
          <div className="cal-head">
            {hasNav && (
              <>
                <button className="btn icon" onClick={() => step(-1)}>
                  ‹
                </button>
                <div className="month-label">{headerLabel()}</div>
                <button className="btn icon" onClick={() => step(1)}>
                  ›
                </button>
                <select
                  value={`${anchor.getFullYear()}-${anchor.getMonth()}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    setAnchor(new Date(y, m, 1));
                  }}
                  title="Jump to a month with saved items"
                >
                  {months.map(([y, m]) => (
                    <option key={`${y}-${m}`} value={`${y}-${m}`}>
                      {MONTHS[m]} {y}
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={() => setAnchor(new Date(latestDate))}>
                  Latest
                </button>
              </>
            )}
            {!hasNav && <div className="month-label">{headerLabel()}</div>}
            <div className="spacer" />
          </div>

          <div className="view-body">
            {showEmpty ? (
              <div className="empty-state">
                <h2>No data yet</h2>
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
                {view === "month" && (
                  <Calendar
                    albums={filtered}
                    year={anchor.getFullYear()}
                    month={anchor.getMonth()}
                    onSelectDay={setSelectedDay}
                  />
                )}
                {view === "week" && (
                  <WeekView albums={filtered} anchor={anchor} onSelectDay={setSelectedDay} />
                )}
                {view === "day" && <DayView albums={filtered} anchor={anchor} />}
                {view === "year" && (
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
