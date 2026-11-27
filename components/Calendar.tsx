"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { WD, keyOf, addDays } from "@/lib/dates";

/**
 * The month as a calendar grid, the layout beside the wall. A day's first
 * cover fills its cell (the owner found the 50px fan "too small to enjoy the
 * artwork"); the day number sits on a dark pill so it reads over any image,
 * the count shows only past one, and the next covers peek in a corner. On a
 * pointer that hovers, a card opens beside the cell with the whole day.
 */
export default function Calendar({
  albums,
  year,
  month,
  onSelectDay,
}: {
  albums: Album[];
  year: number;
  month: number;
  onSelectDay: (dateKey: string) => void;
}) {
  const byDay = useMemo(() => groupByDay(albums), [albums]);
  const todayKey = keyOf(new Date());

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const gridStart = addDays(first, -first.getDay());
    // Five weeks when the month fits in them, six otherwise: a whole row of
    // the next month's days would only shrink the covers.
    const days = new Date(year, month + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + days) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = addDays(gridStart, i);
      const key = keyOf(d);
      const list = [...(byDay[key] ?? [])].sort(
        (a, b) => +new Date(a.addedAt) - +new Date(b.addedAt),
      );
      return { key, day: d.getDate(), col: i % 7, row: Math.floor(i / 7), inMonth: d.getMonth() === month, albums: list };
    });
  }, [year, month, byDay]);

  return (
    <>
      <div className="weekdays">
        {WD.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid">
        {cells.map((c) => {
          const has = c.inMonth && c.albums.length > 0;
          const classes = [
            "day",
            c.inMonth ? "" : "other",
            has ? "has" : "",
            c.key === todayKey ? "today" : "",
            c.col >= 4 ? "peek-left" : "",
            c.row >= 3 ? "peek-up" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const n = c.albums.length;
          const date = new Date(c.key + "T00:00:00");
          return (
            <div
              key={c.key}
              className={classes}
              onClick={() => has && onSelectDay(c.key)}
              onKeyDown={(e) => {
                if (has && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectDay(c.key);
                }
              }}
              role={has ? "button" : undefined}
              tabIndex={has ? 0 : undefined}
              aria-label={
                has
                  ? `${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${n} saved`
                  : undefined
              }
            >
              {has && (
                <div className="day-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.albums[0].cover}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  />
                </div>
              )}
              <div className="dnum">{c.day}</div>
              {n > 1 && has && <div className="count">×{n}</div>}
              {n > 1 && has && (
                <div className="day-more" aria-hidden="true">
                  {c.albums.slice(1, 4).map((al) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={al.id}
                      src={al.cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ))}
                </div>
              )}
              {has && (
                <div className="day-peek" aria-hidden="true">
                  <div className="peek-head">
                    <span className="peek-date">
                      {date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                    <span className="peek-n">{n > 1 ? `${n} saves` : "1 save"}</span>
                  </div>
                  <div className="peek-covers">
                    {c.albums.slice(0, 5).map((al) => (
                      <div className="peek-item" key={al.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={al.cover}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                        <span className="peek-name">{al.name}</span>
                        <span className="peek-artist">{al.artists.map((a) => a.name).join(", ")}</span>
                      </div>
                    ))}
                  </div>
                  <span className="peek-hint">Click to open the day</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
