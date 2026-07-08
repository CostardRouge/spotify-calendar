"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { computeStats } from "@/lib/library";
import { formatDay } from "@/lib/dates";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/** Global library statistics dashboard. */
export default function StatsView({
  albums,
  likedSongs,
}: {
  albums: Album[];
  likedSongs: number;
}) {
  const s = useMemo(() => computeStats(albums), [albums]);
  const maxYear = Math.max(1, ...s.perYearAdded.map((y) => y.count));
  const maxDec = Math.max(1, ...s.perDecade.map((d) => d.count));

  return (
    <div className="stats-view">
      <div className="stats-cards">
        <StatCard label="Saved albums" value={s.totalAlbums.toLocaleString()} />
        <StatCard label="Liked songs" value={likedSongs.toLocaleString()} />
        <StatCard label="Unique artists" value={s.uniqueArtists.toLocaleString()} />
        <StatCard label="Genres" value={s.uniqueGenres.toLocaleString()} />
        <StatCard
          label="Top artist"
          value={s.topArtist?.name ?? "—"}
          sub={s.topArtist ? `${s.topArtist.count} albums` : undefined}
        />
        <StatCard
          label="Top genre"
          value={s.topGenre?.genre ?? "—"}
          sub={s.topGenre ? `${s.topGenre.count} albums` : undefined}
        />
        <StatCard
          label="Busiest day"
          value={s.busiestDay ? `${s.busiestDay.count} albums` : "—"}
          sub={s.busiestDay ? formatDay(s.busiestDay.dateKey) : undefined}
        />
        <StatCard
          label="First save"
          value={s.firstSave ? new Date(s.firstSave).getFullYear() : "—"}
          sub={s.firstSave ? formatDay(s.firstSave) : undefined}
        />
      </div>

      <div className="stats-charts">
        <div className="chart-block">
          <h3>Albums added per year</h3>
          <div className="bar-chart">
            {s.perYearAdded.map((y) => (
              <div className="bar-row" key={y.year}>
                <span className="bar-label">{y.year}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(y.count / maxYear) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{y.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-block">
          <h3>By release decade</h3>
          <div className="bar-chart">
            {s.perDecade.map((d) => (
              <div className="bar-row" key={d.decade}>
                <span className="bar-label">{d.decade}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill alt"
                    style={{ width: `${(d.count / maxDec) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
