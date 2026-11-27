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
import { usePrefs } from "@/components/usePrefs";
import Calendar from "@/components/Calendar";
import WallView from "@/components/WallView";
import WeekView from "@/components/WeekView";
import DayView from "@/components/DayView";
import YearView from "@/components/YearView";
import ListView from "@/components/ListView";
import StatsView from "@/components/StatsView";
import FilterBar from "@/components/FilterBar";
import AccountMenu from "@/components/AccountMenu";
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

/**
 * The app's frame (design canvas, iteration 3): on a computer the views sit in
 * a side rail with "Drop the needle" and the account at its foot; on a phone
 * they are the tab bar, the header keeping the logo, the needle and the
 * account. The filters are a bar above every view, always in sight.
 */
export default function CalendarApp({
  initialView,
  version,
}: {
  initialView: ViewMode;
  // package.json's version, read on the server (lib/version.ts) — never
  // imported here, or the whole package.json would ship to the browser.
  version: string;
}) {
  const { items, hydrated, job, start } = useSync();
  const prefs = usePrefs();

  const [filters, setFilters] = useState<Filters>(emptyFilters());
  // The view is owned by the route (/month, /week, …), so it's known before the
  // first paint — no post-mount correction, no flash of the wrong view.
  const [view, setView] = useState<ViewMode>(initialView);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // `anchor` (and the grid's "today" marker) depend on the current date, which
  // differs between the server render and the client. Hold back the
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

  // Restore the filters and the anchor from the URL once, on mount, before we
  // start writing them back.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const init = searchToState(window.location.search);
    if (init.anchorKey) {
      setAnchor(new Date(init.anchorKey + "T00:00:00"));
      initedRef.current = true; // an explicit date beats the auto-jump-to-latest
    }
    if (init.filters) setFilters(init.filters);
    setUrlReady(true);
  }, []);

  // Mirror state into the URL so a refresh (or shared link) restores the view.
  // The view lives in the path; filters and anchor stay in the query.
  useEffect(() => {
    if (!urlReady) return;
    const hasNavView = view !== "list" && view !== "stats";
    const qs = stateToSearch({ anchorKey: hasNavView ? keyOf(anchor) : null, filters });
    const url = qs ? `/${view}?${qs}` : `/${view}`;
    window.history.replaceState(null, "", url);
  }, [urlReady, view, anchor, filters]);

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
        return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
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
        return "Your library";
    }
  };

  const showEmpty = hydrated && items.length === 0;
  const canNeedle = filtered.length > 0;
  const wall = prefs.monthLayout === "wall";

  const needle = (cls: string) => (
    <button
      className={cls}
      onClick={dropNeedle}
      disabled={!canNeedle}
      title="Drop the needle: open a random day from your library"
      aria-label="Drop the needle"
    >
      <Icon name="needle" />
      <span className="needle-label">Drop the needle</span>
    </button>
  );

  return (
    <div className="app">
      <aside className="rail">
        <div className="logo">
          <span className="mark" aria-hidden="true" /> sillon
        </div>
        <nav className="rail-nav" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={"rail-btn" + (view === v.id ? " active" : "")}
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? "page" : undefined}
            >
              <Icon name={v.id} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
        {needle("btn ghost needle-btn")}
        <AccountMenu version={version} variant="rail" />
      </aside>

      <div className="stage">
        <header className="phone-head">
          <div className="logo">
            <span className="mark" aria-hidden="true" /> sillon
          </div>
          <span className="spacer" />
          {needle("btn icon ghost needle-btn")}
          <AccountMenu version={version} variant="avatar" />
        </header>

        <FilterBar albums={items} filters={filters} setFilters={setFilters} shown={filtered.length} />

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
                    aria-label="Jump to a month"
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
            {view === "month" && !showEmpty && (
              <div className="layout-tools">
                {wall && (
                  <button
                    className="btn order-btn"
                    onClick={() => prefs.setWallOrder(prefs.wallOrder === "asc" ? "desc" : "asc")}
                    aria-label={
                      prefs.wallOrder === "asc"
                        ? "Order: first day first. Show the last day first"
                        : "Order: last day first. Show the first day first"
                    }
                    title="Change the order of the days"
                  >
                    <Icon name="sort" />
                    <span className="order-label">{prefs.wallOrder === "asc" ? "1 → 31" : "31 → 1"}</span>
                  </button>
                )}
                <div className="seg layout-seg" role="radiogroup" aria-label="Month layout">
                  <button
                    role="radio"
                    aria-checked={wall}
                    className={wall ? "on" : ""}
                    onClick={() => prefs.setMonthLayout("wall")}
                  >
                    Wall
                  </button>
                  <button
                    role="radio"
                    aria-checked={!wall}
                    className={!wall ? "on" : ""}
                    onClick={() => prefs.setMonthLayout("grid")}
                  >
                    Grid
                  </button>
                </div>
              </div>
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
                {mounted && view === "month" && wall && (
                  <WallView
                    albums={filtered}
                    year={anchor.getFullYear()}
                    month={anchor.getMonth()}
                    order={prefs.wallOrder}
                    hintSeen={prefs.wallHintSeen}
                    onDismissHint={prefs.dismissWallHint}
                    onSelectDay={setSelectedDay}
                  />
                )}
                {mounted && view === "month" && !wall && (
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
                    month={anchor.getMonth()}
                    onSelectDay={setSelectedDay}
                    onSelectMonth={(m) => {
                      setAnchor(new Date(anchor.getFullYear(), m, 1));
                      setView("month");
                    }}
                  />
                )}
                {view === "list" && <ListView albums={filtered} />}
                {view === "stats" && <StatsView albums={items} />}
              </>
            )}
          </div>
        </section>

        <nav className="bottomnav" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={"bnav-btn" + (view === v.id ? " active" : "")}
              aria-current={view === v.id ? "page" : undefined}
              onClick={() => setView(v.id)}
            >
              <Icon name={v.id} />
              {v.label}
            </button>
          ))}
        </nav>
      </div>

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
