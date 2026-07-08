"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { formatDay } from "@/lib/dates";
import { playItem, itemToUri } from "@/lib/playerClient";

/**
 * How many day-groups to mount on first paint, and how many more to reveal each
 * time the scroll sentinel comes into view. Keeping the first commit small is
 * what stops a large library from freezing the main thread on refresh.
 */
const INITIAL_GROUPS = 40;
const GROUP_STEP = 40;

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

  // Progressive rendering: mount only a window of groups and grow it as the user
  // scrolls near the bottom. The initial DOM stays small no matter how large the
  // library is, so the main thread is free to handle hover/pointer input.
  const [visible, setVisible] = useState(INITIAL_GROUPS);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset the window whenever the underlying data changes (filters / re-sync).
  useEffect(() => {
    setVisible(INITIAL_GROUPS);
    containerRef.current?.scrollTo({ top: 0 });
  }, [groups]);

  // Reveal more groups just before the sentinel scrolls into view. The list is
  // its own scroll container, so we observe against it via `root`.
  useEffect(() => {
    if (visible >= groups.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(v + GROUP_STEP, groups.length));
        }
      },
      { root: containerRef.current, rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, groups.length]);

  if (!albums.length) {
    return <p className="day-view-empty">No albums match the current filters.</p>;
  }

  const shown = groups.slice(0, visible);

  return (
    <div className="list-view" ref={containerRef}>
      {shown.map((g) => (
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
                width={52}
                height={52}
                loading="lazy"
                decoding="async"
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
              <button
                className="alrow-play"
                title={al.kind === "track" ? "Play song" : "Play album"}
                aria-label="Play on Spotify"
                onClick={() =>
                  al.kind === "track"
                    ? playItem({ uris: [itemToUri(al.id, "track")] })
                    : playItem({ contextUri: itemToUri(al.id, "album") })
                }
              >
                ▶
              </button>
              <div className="yr">{al.year ?? ""}</div>
            </div>
          ))}
        </div>
      ))}
      {visible < groups.length && (
        <div ref={sentinelRef} className="list-sentinel" aria-hidden="true" />
      )}
    </div>
  );
}
