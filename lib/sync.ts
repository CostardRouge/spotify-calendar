export type JobStatus = "idle" | "running" | "paused" | "done" | "error";
export type Phase = "" | "albums" | "tracks" | "genres" | "done";

export interface JobLog {
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
}
export interface Progress {
  loaded: number;
  total: number | null;
}

export interface SyncJob {
  status: JobStatus;
  phase: Phase;
  albums: Progress;
  tracks: Progress;
  genres: Progress;
  startedAt: number | null;
  updatedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  /** Epoch ms until which Spotify has rate-limited us; null when clear. */
  rateLimitedUntil: number | null;
  logs: JobLog[];
}

export function initialJob(): SyncJob {
  return {
    status: "idle",
    phase: "",
    albums: { loaded: 0, total: null },
    tracks: { loaded: 0, total: null },
    genres: { loaded: 0, total: null },
    startedAt: null,
    updatedAt: null,
    finishedAt: null,
    error: null,
    rateLimitedUntil: null,
    logs: [],
  };
}

const JOB_KEY = "slc_sync_job_v1";

export function loadJob(): SyncJob | null {
  try {
    const raw = localStorage.getItem(JOB_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncJob;
  } catch {
    return null;
  }
}

export function saveJob(job: SyncJob): void {
  try {
    localStorage.setItem(JOB_KEY, JSON.stringify(job));
  } catch {
    // ignore quota/availability
  }
}
