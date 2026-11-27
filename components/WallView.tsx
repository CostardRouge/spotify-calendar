"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { monthDays } from "@/lib/library";
import { WD } from "@/lib/dates";
import type { WallOrder } from "@/lib/prefs";

const LONG_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The month as a wall of covers, the default month layout (the owner's
 * choice: "elegant and new"). Each day that holds saves is an orange-numbered
 * tile followed by its covers at full size, in the order they were saved; the
 * days run from the 1st (or from the last day, by the device's choice). Empty
 * days are not drawn — the grid layout is the calendar for that.
 */
export default function WallView({
  albums,
  year,
  month,
  order,
  hintSeen,
  onDismissHint,
  onSelectDay,
}: {
  albums: Album[];
  year: number;
  month: number;
  order: WallOrder;
  hintSeen: boolean;
  onDismissHint: () => void;
  onSelectDay: (dateKey: string) => void;
}) {
  const days = useMemo(() => monthDays(albums, year, month, order), [albums, year, month, order]);

  return (
    <div className="wall-view">
      {!hintSeen && (
        <div className="wall-hint" role="note">
          <span className="wall-hint-n" aria-hidden="true">
            12
          </span>
          <span className="wall-hint-text">
            The wall: each orange number is a day, its covers follow in the order you saved
            them. Prefer a calendar? Switch to <b>Grid</b>.
          </span>
          <button className="btn" onClick={onDismissHint}>
            Got it
          </button>
        </div>
      )}

      {days.length === 0 ? (
        <p className="wall-empty">Nothing saved this month{albums.length ? " with these filters" : ""}.</p>
      ) : (
        <div className="wall">
          {days.map(({ dateKey, items }) => {
            const d = new Date(dateKey + "T00:00:00");
            const n = items.length;
            const label = `${LONG_WD[d.getDay()]} ${d.getDate()}, ${n} ${n > 1 ? "saves" : "save"}`;
            return (
              <div className="wall-day" key={dateKey}>
                <button className="wall-date" onClick={() => onSelectDay(dateKey)} aria-label={`Open ${label}`}>
                  <span className="wall-wd">{WD[d.getDay()]}</span>
                  <span className="wall-n">{d.getDate()}</span>
                  <span className="wall-count">{n > 1 ? `${n} saves` : "1 save"}</span>
                </button>
                {items.map((al) => {
                  const artists = al.artists.map((a) => a.name).join(", ");
                  return (
                    <button
                      className="wall-cover"
                      key={al.id}
                      onClick={() => onSelectDay(dateKey)}
                      aria-label={`${al.name} — ${artists}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={al.cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <span className="wall-caption" aria-hidden="true">
                        <span className="wall-title">{al.name}</span>
                        <span className="wall-artist">{artists}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
