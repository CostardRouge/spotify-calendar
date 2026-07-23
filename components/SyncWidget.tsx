"use client";

import Link from "next/link";
import { useSync } from "./SyncProvider";
import type { SyncJob } from "@/lib/sync";

const STATUS_COLOR: Record<string, string> = {
  idle: "var(--muted)",
  running: "var(--accent)",
  paused: "#e0b341",
  done: "var(--accent)",
  error: "#ff6b6b",
};

export function phaseLabel(job: SyncJob): string {
  switch (job.status) {
    case "running": {
      if (job.phase === "albums")
        return `Albums ${job.albums.loaded}/${job.albums.total ?? "…"}`;
      if (job.phase === "tracks")
        return `Songs ${job.tracks.loaded}/${job.tracks.total ?? "…"}`;
      if (job.phase === "genres")
        return `Genres ${job.genres.loaded}/${job.genres.total ?? "…"}`;
      return "Syncing…";
    }
    case "paused":
      return "Paused";
    case "error":
      return "Sync error";
    case "done":
      return "Synced";
    default:
      return "Not synced";
  }
}

export default function SyncWidget() {
  const { job, isRunning, start, refresh, pause } = useSync();
  const color = STATUS_COLOR[job.status] ?? "var(--muted)";

  return (
    <div className="sync-widget">
      <span className="sync-dot" style={{ background: color }} />
      <Link href="/sync" className="sync-label" title="Open sync details">
        {phaseLabel(job)}
      </Link>
      {isRunning ? (
        <button className="sync-mini" onClick={pause} title="Pause sync">
          ❚❚
        </button>
      ) : job.status === "paused" ? (
        <button className="sync-mini" onClick={start} title="Resume sync">
          ▶
        </button>
      ) : job.status === "done" ? (
        <button className="sync-mini" onClick={refresh} title="Check for new saves">
          ↻
        </button>
      ) : job.status === "idle" ? (
        <button className="sync-mini" onClick={start} title="Start sync">
          ↻
        </button>
      ) : null}
    </div>
  );
}
