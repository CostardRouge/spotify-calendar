"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { formatDay } from "@/lib/dates";

/** Flat chronological list of all (filtered) albums, grouped by save date. */
export default function ListView({ albums }: { albums: Album[] }) {
  const groups = useMemo(() => {
    const byDay = groupByDay(albums);
    return Object.keys(byDay)
      .sort((a, b) => (a < b ? 1 : -1)) // newest date first
      .map((key) => ({
        key,
        albums: byDay[key].sort(
          (a, b) => +new Date(b.addedAt) - +new Date(a.addedAt),
        ),
      }));
  }, [albums]);

  if (!albums.length) {
    return <p className="day-view-empty">No albums match the current filters.</p>;
  }

  return (
    <div className="list-view">
      {groups.map((g) => (
        <div className="list-group" key={g.key}>
          <div className="list-date">
            {formatDay(g.key)} <span className="list-count">· {g.albums.length}</span>
          </div>
          {g.albums.map((al) => (
            <div className="alrow" key={al.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={al.cover}
                alt=""
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <div className="meta">
                <div className="n">
                  {al.kind === "track" && <span className="kind-tag">♪</span>}
                  {al.name}
                </div>
                <div className="a">
                  {al.artists.map((x) => x.name).join(", ")}
                  {al.kind === "track" && al.albumName ? ` · ${al.albumName}` : ""}
                </div>
              </div>
              <div className="yr">{al.year ?? ""}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
