"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { keyOf, formatDay } from "@/lib/dates";
import { yearAgo } from "@/lib/library";
import { spotifyUrl } from "@/lib/playerClient";
import { PlayButton, QueueButton } from "@/components/PlayQueueButton";

/**
 * One day: its first cover as a sleeve with the record sliding out, the count,
 * what you were saving around the same day a year before (lib/library.ts
 * yearAgo), then every save of the day. CalendarApp turns the page on a
 * horizontal swipe.
 */
export default function DayView({
  albums,
  anchor,
  onGoToDay,
}: {
  albums: Album[];
  anchor: Date;
  onGoToDay: (dateKey: string) => void;
}) {
  const key = keyOf(anchor);
  const list = useMemo(
    () =>
      albums
        .filter((a) => a.dateKey === key)
        .sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)),
    [albums, key],
  );
  const memory = useMemo(() => yearAgo(albums, key), [albums, key]);

  const albumCount = list.filter((a) => a.kind !== "track").length;
  const trackCount = list.length - albumCount;
  const parts = [];
  if (albumCount) parts.push(`${albumCount} album${albumCount > 1 ? "s" : ""}`);
  if (trackCount) parts.push(`${trackCount} song${trackCount > 1 ? "s" : ""}`);
  const lead = list[0];

  return (
    <div className="day-view">
      {lead ? (
        <div className="day-hero">
          <div className="sleeve" aria-hidden="true">
            <div className="sleeve-record">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {lead.cover && <img src={lead.cover} alt="" decoding="async" />}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {lead.cover && <img className="sleeve-cover" src={lead.cover} alt="" decoding="async" />}
          </div>
          <div className="day-hero-text">
            <span className="day-hero-count">{list.length}</span>
            <p className="day-view-sub">{parts.join(" · ")} saved this day</p>
          </div>
        </div>
      ) : (
        <p className="day-view-empty">Nothing saved on this day.</p>
      )}

      {memory && (
        <button className="memory" onClick={() => onGoToDay(memory.dateKey)}>
          <span className="memory-covers" aria-hidden="true">
            {memory.items.slice(0, 3).map((al) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={al.id} src={al.cover} alt="" loading="lazy" decoding="async" />
            ))}
          </span>
          <span className="memory-text">
            <span className="memory-tag">A year ago · {formatDay(memory.dateKey)}</span>
            <span className="memory-line">
              {[...new Set(memory.items.flatMap((al) => al.artists.map((a) => a.name)))]
                .slice(0, 3)
                .join(", ")}
              {memory.items.length > 1 ? ` — ${memory.items.length} saves` : ` — ${memory.items[0].name}`}
            </span>
          </span>
        </button>
      )}

      {list.length > 0 && (
        <div className="day-view-grid">
          {list.map((al) => (
            <div className="dv-card" key={al.id}>
              <div className="dv-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={al.cover}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
                <QueueButton item={al} className="dv-queue" />
                <PlayButton item={al} className="dv-play" />
              </div>
              <div className="dv-name">
                {al.kind === "track" && <span className="kind-tag">♪</span>}
                <a
                  className="al-link"
                  href={spotifyUrl(al.id, al.kind)}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open “${al.name}” in Spotify`}
                >
                  {al.name}
                </a>
              </div>
              <div className="dv-artist">{al.artists.map((a) => a.name).join(", ")}</div>
              <div className="dv-year">{al.year ?? ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
