import type { Album } from "./types";

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

/** Pre-isolation single-user key — claimed by the first account to log in. */
const LEGACY_JOB_KEY = "slc_sync_job_v1";

/** Mirrors ANON_USER_ID in clientCache: "nobody logged in". */
const ANON = "anon";

const jobKeyFor = (userId: string) => `${LEGACY_JOB_KEY}:${userId}`;

/**
 * Job state is stored per Spotify user id so two accounts sharing a browser
 * never resume or overwrite each other's sync. The legacy un-keyed record is
 * migrated to the first logged-in account that loads it (its owner, on a
 * personal browser); anonymous visitors can read it but never claim it.
 */
export function loadJob(userId: string): SyncJob | null {
  try {
    const raw = localStorage.getItem(jobKeyFor(userId));
    if (raw) return JSON.parse(raw) as SyncJob;

    const legacy = localStorage.getItem(LEGACY_JOB_KEY);
    if (!legacy) return null;
    const job = JSON.parse(legacy) as SyncJob;
    if (userId !== ANON) {
      localStorage.setItem(jobKeyFor(userId), legacy);
      localStorage.removeItem(LEGACY_JOB_KEY);
    }
    return job;
  } catch {
    return null;
  }
}

export function saveJob(userId: string, job: SyncJob): void {
  try {
    localStorage.setItem(jobKeyFor(userId), JSON.stringify(job));
  } catch {
    // ignore quota/availability
  }
}

// ---------------------------------------------------------------------------
// The sync loop's arithmetic, pure so tests/sync.test.ts can hold it still.
// ---------------------------------------------------------------------------

/**
 * Where the next page of `kind` starts: after what is already held. The offset
 * is derived from the items, never from a stored cursor, so an interrupted and
 * resumed run neither gaps nor duplicates (docs/memory/data-and-sync.md).
 */
export function resumeOffset(items: Album[], kind: Album["kind"]): number {
  let n = 0;
  for (const it of items) if (it.kind === kind) n++;
  return n;
}

/**
 * The held list plus the incoming items not already in it, by id, once each,
 * in their order. Returns `held` itself when nothing is new, so a caller can
 * skip a state update on an overlapping page.
 */
export function appendUnique(held: Album[], incoming: Album[]): Album[] {
  if (!incoming.length) return held;
  const seen = new Set(held.map((i) => i.id));
  const fresh: Album[] = [];
  for (const it of incoming) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    fresh.push(it);
  }
  return fresh.length ? [...held, ...fresh] : held;
}

/**
 * The cooldown a run must wait for, or null when none is active: the later of
 * the one persisted with the job and the one the server knows, if it is still
 * ahead of `now`. Firing a Spotify request before it ends only prolongs the ban.
 */
export function activeCooldown(
  persistedUntil: number | null | undefined,
  serverUntil: number | null | undefined,
  now: number,
): number | null {
  const until = Math.max(persistedUntil ?? 0, serverUntil ?? 0);
  return until > now ? until : null;
}
