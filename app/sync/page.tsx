"use client";

import Link from "next/link";
import { useSync } from "@/components/SyncProvider";
import { phaseLabel } from "@/components/SyncWidget";

function Bar({ loaded, total }: { loaded: number; total: number | null }) {
  const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div className="sync-bar">
      <div className="sync-bar-track">
        <div className="sync-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sync-bar-text">
        {loaded}
        {total != null ? ` / ${total}` : ""}
      </span>
    </div>
  );
}

export default function SyncPage() {
  const { job, items, isRunning, start, restart, pause, cancel, clearError } =
    useSync();

  const fmt = (ts: number | null) =>
    ts ? new Date(ts).toLocaleString() : "—";

  const cooldownActive =
    !!job.rateLimitedUntil && job.rateLimitedUntil > Date.now();

  return (
    <div className="sync-page">
      <div className="sync-page-head">
        <Link href="/" className="btn">
          ‹ Back
        </Link>
        <h1>Library sync</h1>
        <span className="spacer" />
        <span className="sync-status-pill" data-status={job.status}>
          {job.status}
        </span>
      </div>

      <div className="sync-summary">
        <div>
          <strong>{phaseLabel(job)}</strong> · {items.length} items loaded
        </div>
        <div className="sync-times">
          Started {fmt(job.startedAt)} · Updated {fmt(job.updatedAt)}
          {job.finishedAt ? ` · Finished ${fmt(job.finishedAt)}` : ""}
        </div>
      </div>

      {cooldownActive && (
        <div className="sync-error">
          <strong>Rate limited:</strong> Spotify has throttled this app. Syncing
          is paused until around{" "}
          {new Date(job.rateLimitedUntil!).toLocaleTimeString()}. Avoid retrying
          before then — it only extends the cooldown.
        </div>
      )}

      {job.error && !cooldownActive && (
        <div className="sync-error">
          <strong>Error:</strong> {job.error}
          <button className="clear-link" onClick={clearError}>
            dismiss
          </button>
        </div>
      )}

      <div className="sync-progress">
        <div className="sync-prog-row">
          <span>Saved albums</span>
          <Bar loaded={job.albums.loaded} total={job.albums.total} />
        </div>
        <div className="sync-prog-row">
          <span>Liked songs</span>
          <Bar loaded={job.tracks.loaded} total={job.tracks.total} />
        </div>
        <div className="sync-prog-row">
          <span>Genres</span>
          <Bar loaded={job.genres.loaded} total={job.genres.total} />
        </div>
      </div>

      <div className="sync-actions">
        {isRunning ? (
          <button className="btn" onClick={pause}>
            ❚❚ Pause
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={start}
            disabled={job.status === "done" || cooldownActive}
          >
            ▶ {job.status === "paused" ? "Resume" : "Start"}
          </button>
        )}
        <button className="btn" onClick={cancel} disabled={!isRunning && job.status !== "paused"}>
          ✕ Cancel
        </button>
        <button className="btn" onClick={restart} disabled={isRunning || cooldownActive}>
          ↻ Redo (full)
        </button>
      </div>

      <div className="sync-logs">
        <h3>Logs</h3>
        <div className="sync-log-list">
          {job.logs.length === 0 && <div className="no-match">No log entries yet.</div>}
          {[...job.logs].reverse().map((l, i) => (
            <div key={i} className={"log-row log-" + l.level}>
              <span className="log-time">
                {new Date(l.ts).toLocaleTimeString()}
              </span>
              <span className="log-level">{l.level}</span>
              <span className="log-msg">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
