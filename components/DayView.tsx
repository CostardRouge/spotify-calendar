"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { keyOf } from "@/lib/dates";
import { spotifyUrl } from "@/lib/playerClient";
import { PlayButton, QueueButton } from "@/components/PlayQueueButton";

/** Detailed single-day view listing every album added that day. */
export default function DayView({
  albums,
  anchor,
}: {
  albums: Album[];
  anchor: Date;
}) {
  const key = keyOf(anchor);
  const list = useMemo(
    () =>
      albums
        .filter((a) => a.dateKey === key)
        .sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)),
    [albums, key],
  );

  return (
    <div className="day-view">
      {list.length === 0 ? (
        <p className="day-view-empty">No albums added on this day.</p>
      ) : (
        <>
          <p className="day-view-sub">
            {list.length} album{list.length > 1 ? "s" : ""} saved
          </p>
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
                <div className="dv-artist">
                  {al.artists.map((a) => a.name).join(", ")}
                </div>
                <div className="dv-year">{al.year ?? ""}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
