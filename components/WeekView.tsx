"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { WD, keyOf, startOfWeek, addDays } from "@/lib/dates";
import { PlayButton } from "@/components/PlayQueueButton";

/**
 * The week in big covers: seven columns, each led by the day's first save at
 * the column's full width (play on it), the rest listed under it. On a phone
 * the days stack, the lead cover beside its list.
 */
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
      const list = [...(byDay[key] ?? [])].sort(
        (a, b) => +new Date(a.addedAt) - +new Date(b.addedAt),
      );
      return { d, key, albums: list };
    });
  }, [anchor, byDay]);

  const artistsOf = (al: Album) => al.artists.map((a) => a.name).join(", ");

  return (
    <div className="week-grid">
      {days.map(({ d, key, albums }, i) => {
        const [lead, ...rest] = albums;
        return (
          <div key={key} className={"week-col" + (key === todayKey ? " today" : "")}>
            <div className="week-col-head">
              <span className="wd">{WD[i]}</span>
              <span className="dn">{d.getDate()}</span>
              {albums.length > 1 && <span className="count">×{albums.length}</span>}
            </div>
            {lead ? (
              <div className="week-body">
                <div className="wk-lead">
                  <div className="wk-cover">
                    <button
                      className="wk-art"
                      onClick={() => onSelectDay(key)}
                      aria-label={`Open the day: ${lead.name} — ${artistsOf(lead)}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lead.cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                    </button>
                    <PlayButton item={lead} className="wk-play" />
                  </div>
                  <div className="wk-lead-text">
                    <span className="wi-name">{lead.name}</span>
                    <span className="wi-artist">{artistsOf(lead)}</span>
                  </div>
                </div>
                {rest.map((al) => (
                  <button
                    key={al.id}
                    className="week-item"
                    onClick={() => onSelectDay(key)}
                    title={`${al.name} — ${artistsOf(al)}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={al.cover}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                    />
                    <span className="wi-text">
                      <span className="wi-name">{al.name}</span>
                      <span className="wi-artist">{artistsOf(al)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="week-empty">No saves</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
