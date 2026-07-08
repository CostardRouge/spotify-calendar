"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { WD, keyOf, startOfWeek, addDays } from "@/lib/dates";

/** Single-week view — 7 tall day columns listing the albums added each day. */
export default function WeekView({
  albums,
  anchor,
  onSelectDay,
}: {
  albums: Album[];
  anchor: Date;
  onSelectDay: (dateKey: string) => void;
}) {
  const byDay = useMemo(() => groupByDay(albums), [albums]);
  const todayKey = keyOf(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = keyOf(d);
      return { d, key, albums: byDay[key] ?? [] };
    });
  }, [anchor, byDay]);

  return (
    <div className="week-grid">
      {days.map(({ d, key, albums }, i) => (
        <div key={key} className={"week-col" + (key === todayKey ? " today" : "")}>
          <div className="week-col-head">
            <span className="wd">{WD[i]}</span>
            <span className="dn">{d.getDate()}</span>
            {albums.length > 0 && <span className="count">{albums.length}</span>}
          </div>
          <div className="week-col-body">
            {albums.length === 0 && <div className="week-empty">—</div>}
            {albums.map((al) => (
              <button
                key={al.id}
                className="week-item"
                onClick={() => onSelectDay(key)}
                title={`${al.name} — ${al.artists.map((a) => a.name).join(", ")}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={al.cover}
                  alt=""
                  width={38}
                  height={38}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <span className="wi-text">
                  <span className="wi-name">{al.name}</span>
                  <span className="wi-artist">
                    {al.artists.map((a) => a.name).join(", ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
