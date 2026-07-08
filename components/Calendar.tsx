"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { WD, keyOf, addDays } from "@/lib/dates";
import Covers from "./Covers";

/** Month grid view. */
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
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(gridStart, i);
      const key = keyOf(d);
      return {
        key,
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        albums: byDay[key] ?? [],
      };
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
          const has = c.albums.length > 0;
          const classes = [
            "day",
            c.inMonth ? "" : "other",
            has ? "has" : "",
            c.key === todayKey ? "today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={c.key}
              className={classes}
              onClick={() => has && onSelectDay(c.key)}
            >
              <div className="dnum">{c.day}</div>
              {has && <div className="count">{c.albums.length}</div>}
              <Covers albums={c.albums} />
            </div>
          );
        })}
      </div>
    </>
  );
}
