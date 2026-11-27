"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { computeStats, groupByDay } from "@/lib/library";
import { formatDay } from "@/lib/dates";

const n = (v: number) => v.toLocaleString();

/** Years and months between a first save and now, said as a person would. */
function since(dateKey: string): string {
  const from = new Date(dateKey + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth();
  if (now.getDate() < from.getDate()) months--;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} year${y > 1 ? "s" : ""}`);
  if (m || !y) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

/**
 * The library in a bento grid: tiles of one or two columns by what they hold,
 * so a name (an artist, a day) gets the room it needs instead of being cut in
 * a row of equal cards. The top artist and the top five carry their covers.
 * No genre tile: Spotify gives this app no genres (docs/memory/spotify-api.md).
 * Over the whole library, whatever the filters say.
 */
export default function StatsView({ albums }: { albums: Album[] }) {
  const s = useMemo(() => computeStats(albums), [albums]);
  const busyItems = useMemo(
    () => (s.busiestDay ? (groupByDay(albums)[s.busiestDay.dateKey] ?? []) : []),
    [albums, s.busiestDay],
  );
  const maxYear = Math.max(1, ...s.perYearAdded.map((y) => y.count));
  const maxDec = Math.max(1, ...s.perDecade.map((d) => d.count));
  const top = s.topArtists[0];
  const topTitles = top
    ? [...new Set(albums.filter((a) => a.artists.some((x) => x.id === top.id)).map((a) => a.name))]
        .slice(0, 3)
        .join(", ")
    : "";

  return (
    <div className="stats-view">
      <div className="bento">
        <div className="tile t-hero">
          {top?.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tile-bg" src={top.cover} alt="" decoding="async" />
          )}
          <div className="tile-hero-text">
            <span className="tile-label accent">Top artist</span>
            <span className="tile-big hero-name">{top?.name ?? "—"}</span>
            {top && (
              <span className="tile-sub">
                {n(top.count)} saves{topTitles ? ` · ${topTitles}` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="tile t-albums filled">
          <span className="tile-label">Saved albums</span>
          <span className="tile-big">{n(s.totalAlbums)}</span>
        </div>
        <div className="tile t-songs">
          <span className="tile-label">Liked songs</span>
          <span className="tile-big">{n(s.totalTracks)}</span>
        </div>
        <div className="tile t-artists">
          <span className="tile-label">Artists</span>
          <span className="tile-big">{n(s.uniqueArtists)}</span>
        </div>
        <div className="tile t-days">
          <span className="tile-label">Days with saves</span>
          <span className="tile-big">{n(s.activeDays)}</span>
        </div>

        <div className="tile t-top">
          <span className="tile-label">Most saved artists</span>
          <ol className="top-list">
            {s.topArtists.map((a, i) => (
              <li key={a.id}>
                <span className="top-rank">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt="" loading="lazy" decoding="async" />
                <span className="top-name">
                  {a.name}
                  <span className="top-bar" aria-hidden="true">
                    <span style={{ width: `${(a.count / (top?.count || 1)) * 100}%` }} />
                  </span>
                </span>
                <span className="top-n">{n(a.count)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="tile t-busy">
          <span className="tile-label">
            Busiest day{s.busiestDay ? ` · ${s.busiestDay.count} saves` : ""}
          </span>
          <span className="tile-mid">{s.busiestDay ? formatDay(s.busiestDay.dateKey) : "—"}</span>
          <div className="busy-covers">
            {busyItems.slice(0, 6).map((al) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={al.id} src={al.cover} alt="" title={al.name} loading="lazy" decoding="async" />
            ))}
          </div>
        </div>

        <div className="tile t-first">
          <span className="tile-label">First save</span>
          <span className="tile-mid">{s.firstSave ? formatDay(s.firstSave) : "—"}</span>
          {s.firstSave && <span className="tile-sub">{since(s.firstSave)} of records</span>}
        </div>

        <div className="tile t-oldest">
          {s.oldest?.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="oldest-cover" src={s.oldest.cover} alt="" loading="lazy" decoding="async" />
          )}
          <span className="oldest-text">
            <span className="tile-label">Oldest record</span>
            <span className="tile-mid">{s.oldest?.name ?? "—"}</span>
            {s.oldest && (
              <span className="tile-sub">
                {s.oldest.artists.map((a) => a.name).join(", ")} · {s.oldest.year}
              </span>
            )}
          </span>
        </div>

        <div className="tile t-years">
          <span className="tile-label">Saves per year</span>
          <div className="bar-chart">
            {s.perYearAdded.map((y) => (
              <div className="bar-row" key={y.year}>
                <span className="bar-label">{y.year}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(y.count / maxYear) * 100}%` }} />
                </div>
                <span className="bar-value">{y.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tile t-decades">
          <span className="tile-label">By release decade</span>
          <div className="dec-chart">
            {s.perDecade.map((d) => (
              <div className="dec-col" key={d.decade}>
                <span className="dec-n">{d.count}</span>
                <span className="dec-bar" style={{ height: `${Math.max(4, Math.round((d.count / maxDec) * 72))}px` }} />
                <span className="dec-l">{d.decade.replace(/^\d\d(\d0s)$/, "’$1")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
