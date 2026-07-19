"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Album } from "@/lib/types";
import {
  initialJob,
  loadJob,
  saveJob,
  type JobLog,
  type SyncJob,
} from "@/lib/sync";
import { loadSnapshot, saveSnapshot } from "@/lib/clientCache";

const PAGE = 50;
const SNAPSHOT_EVERY_PAGES = 5;
// Artist genres now resolve one request per artist (Spotify removed the bulk
// /artists?ids= endpoint in Feb 2026), so each /api/genres POST does N serial
// Spotify calls. Keep the chunk small: when the app sits behind a proxy/CDN
// with a fixed edge timeout (Cloudflare's Free/Pro plans cut any request at a
// hard 100s and return their own 502), a 200-artist chunk can cross that cap
// on a large library and get killed at the edge before the route ever
// responds. 50 keeps each POST at ~10s — well under 100s even with pacing and
// the occasional rate-limit back-off — and the sync is resumable/chunked, so
// more, shorter requests just chain naturally.
const GENRE_CHUNK = 50;

/** Human-readable "come back later" message for an active cooldown. */
function rateLimitMsg(until: number): string {
  const secs = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  const mins = Math.ceil(secs / 60);
  const at = new Date(until).toLocaleTimeString();
  return `Spotify rate limit active — try again in ~${mins} min (around ${at}).`;
}

/** The server's shared cooldown, if any. Does NOT contact Spotify. */
async function serverCooldownUntil(): Promise<number | null> {
  try {
    const r = await fetch("/api/ratelimit", { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.until && Date.now() < j.until ? j.until : null;
  } catch {
    return null;
  }
}

interface SyncContextValue {
  items: Album[];
  hydrated: boolean;
  job: SyncJob;
  isRunning: boolean;
  start: () => void; // resume / continue
  restart: () => void; // redo from scratch
  pause: () => void;
  cancel: () => void;
  clearError: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  // --- items (with a ref mirror for use inside the async loop) ---
  const itemsRef = useRef<Album[]>([]);
  const [items, setItemsState] = useState<Album[]>([]);
  const setItems = useCallback((next: Album[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  // --- job (ref is the source of truth; state mirrors it for rendering) ---
  const jobRef = useRef<SyncJob>(initialJob());
  const [job, setJobState] = useState<SyncJob>(jobRef.current);
  const commitJob = useCallback(() => {
    const snapshot = { ...jobRef.current, logs: [...jobRef.current.logs] };
    setJobState(snapshot);
    saveJob(snapshot);
  }, []);
  const patchJob = useCallback(
    (p: Partial<SyncJob>) => {
      Object.assign(jobRef.current, p, { updatedAt: Date.now() });
      commitJob();
    },
    [commitJob],
  );
  const log = useCallback(
    (level: JobLog["level"], message: string) => {
      jobRef.current.logs.push({ ts: Date.now(), level, message });
      if (jobRef.current.logs.length > 300) jobRef.current.logs.shift();
      commitJob();
    },
    [commitJob],
  );

  // --- control flags ---
  const runningRef = useRef(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  // Hydrate from storage on mount — never auto-start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await loadSnapshot();
      if (!cancelled && snap?.items?.length) setItems(snap.items);
      const stored = loadJob();
      if (stored) {
        // A job that was "running" when the app closed was interrupted.
        if (stored.status === "running") {
          stored.status = "paused";
          stored.logs = [
            ...(stored.logs ?? []),
            { ts: Date.now(), level: "warn", message: "Interrupted — resume to continue." },
          ];
        }
        jobRef.current = stored;
        if (!cancelled) setJobState(stored);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRequested = () => pauseRef.current || cancelRef.current;

  const persistSnapshot = useCallback(() => {
    const tracks = itemsRef.current.filter((i) => i.kind === "track").length;
    // Fire-and-forget: the async IndexedDB write must not block the sync loop.
    void saveSnapshot(itemsRef.current, tracks).catch(() => {});
  }, []);

  const appendUnique = useCallback(
    (incoming: Album[]) => {
      if (!incoming.length) return;
      const seen = new Set(itemsRef.current.map((i) => i.id));
      const fresh = incoming.filter((i) => !seen.has(i.id));
      if (fresh.length) setItems([...itemsRef.current, ...fresh]);
    },
    [setItems],
  );

  async function apiJson(url: string, timeoutMs: number): Promise<any> {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 401) {
      const e: any = new Error("Session expired — please log in again.");
      e.unauthorized = true;
      throw e;
    }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const retryAfter =
        Number(body.retryAfter) ||
        Number(res.headers.get("Retry-After")) ||
        60;
      const e: any = new Error(body.detail || "Spotify rate limit");
      e.rateLimited = true;
      e.retryAfter = retryAfter;
      throw e;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || body.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Paginate one kind. Offset is derived from what we already hold, so an
  // interrupted+resumed run never gaps or (thanks to appendUnique) duplicates.
  async function syncKind(kind: "album" | "track") {
    const endpoint = kind === "album" ? "/api/albums" : "/api/tracks";
    const progressKey = kind === "album" ? "albums" : "tracks";
    patchJob({ phase: kind === "album" ? "albums" : "tracks" });
    let pages = 0;

    while (true) {
      if (stopRequested()) return;
      const offset = itemsRef.current.filter((i) => i.kind === kind).length;
      const data = await apiJson(`${endpoint}?offset=${offset}&limit=${PAGE}`, 30000);
      appendUnique(data.items ?? []);
      const loaded = itemsRef.current.filter((i) => i.kind === kind).length;
      patchJob({ [progressKey]: { loaded, total: data.total ?? loaded } } as any);

      pages++;
      if (pages % SNAPSHOT_EVERY_PAGES === 0) persistSnapshot();

      if (!data.next || (data.items ?? []).length === 0) break;
      // Gentle pacing: stay well under Spotify's rolling rate window so a
      // large library doesn't trigger a throttle mid-sync.
      await new Promise((r) => setTimeout(r, 250));
    }
    persistSnapshot();
  }

  async function syncGenres() {
    patchJob({ phase: "genres" });
    const need = new Set<string>();
    for (const it of itemsRef.current) {
      if (it.genres.length === 0)
        for (const a of it.artists) if (a.id) need.add(a.id);
    }
    const ids = [...need];
    patchJob({ genres: { loaded: 0, total: ids.length } });
    if (!ids.length) return;

    const genreMap: Record<string, string[]> = {};

    // Fold whatever genres we've resolved so far onto the items and persist.
    // Called before surfacing a rate limit so partial progress survives a
    // pause/resume (the resume recomputes `need` and skips already-genred items).
    const applyGenres = () => {
      if (!Object.keys(genreMap).length) return;
      setItems(
        itemsRef.current.map((it) =>
          it.genres.length
            ? it
            : {
                ...it,
                genres: [
                  ...new Set(it.artists.flatMap((a) => genreMap[a.id] ?? [])),
                ],
              },
        ),
      );
      persistSnapshot();
    };

    for (let i = 0; i < ids.length; i += GENRE_CHUNK) {
      if (stopRequested()) return;
      const chunk = ids.slice(i, i + GENRE_CHUNK);
      const res = await fetch("/api/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistIds: chunk }),
        // Abort below a typical 100s CDN edge timeout so a stalled chunk fails
        // as a clean client-side TimeoutError (resumable) rather than waiting
        // out an opaque edge 502.
        signal: AbortSignal.timeout(90000),
      });
      if (res.ok) {
        const { genres } = await res.json();
        Object.assign(genreMap, genres);
      } else {
        // A non-ok response here used to be silently ignored, so a throttled
        // genre phase would still complete "done" with an empty genre filter.
        // Surface it so run() can pause/flag and the phase can be resumed.
        const body = await res.json().catch(() => ({} as any));
        if (res.status === 401) {
          const e: any = new Error(body.error || "Session expired — please log in again.");
          e.unauthorized = true;
          throw e;
        }
        if (res.status === 429) {
          applyGenres(); // keep partial progress before backing off
          const e: any = new Error(body.detail || "Spotify rate limit");
          e.rateLimited = true;
          e.retryAfter =
            Number(body.retryAfter) || Number(res.headers.get("Retry-After")) || 60;
          throw e;
        }
        // Other errors: skip this chunk, keep going (best-effort).
      }
      patchJob({ genres: { loaded: Math.min(i + GENRE_CHUNK, ids.length), total: ids.length } });
    }

    applyGenres();
  }

  const run = useCallback(async (restart: boolean) => {
    if (runningRef.current) return;

    // Pre-flight: never fire a Spotify request while a cooldown is active —
    // that only prolongs the ban. Respect both the persisted cooldown and the
    // server's shared record (covers a fresh browser with empty localStorage).
    const persisted = jobRef.current.rateLimitedUntil ?? 0;
    const server = (await serverCooldownUntil()) ?? 0;
    const until = Math.max(persisted, server);
    if (until && Date.now() < until) {
      patchJob({ status: "error", rateLimitedUntil: until, error: rateLimitMsg(until) });
      log("warn", rateLimitMsg(until));
      return;
    }
    // Cooldown has elapsed — drop any stale marker before starting.
    if (jobRef.current.rateLimitedUntil) patchJob({ rateLimitedUntil: null });

    runningRef.current = true;
    pauseRef.current = false;
    cancelRef.current = false;
    setIsRunning(true);

    if (restart) {
      setItems([]);
      jobRef.current = {
        ...initialJob(),
        status: "running",
        startedAt: Date.now(),
      };
      commitJob();
    } else {
      patchJob({
        status: "running",
        error: null,
        startedAt: jobRef.current.startedAt ?? Date.now(),
      });
    }
    log("info", restart ? "Sync started (full)" : "Sync resumed");

    try {
      await syncKind("album");
      if (stopRequested()) return finishStopped();
      await syncKind("track");
      if (stopRequested()) return finishStopped();
      await syncGenres();
      if (stopRequested()) return finishStopped();

      patchJob({ status: "done", phase: "done", finishedAt: Date.now() });
      persistSnapshot();
      log("info", "Sync complete");
    } catch (e: any) {
      if (e?.unauthorized) {
        patchJob({ status: "error", error: e.message });
        log("error", e.message);
        window.location.href = "/login";
        return;
      }
      if (e?.rateLimited) {
        const rlUntil = Date.now() + (Number(e.retryAfter) || 60) * 1000;
        patchJob({
          status: "error",
          rateLimitedUntil: rlUntil,
          error: rateLimitMsg(rlUntil),
        });
        log("error", rateLimitMsg(rlUntil));
        return;
      }
      if (e?.name === "TimeoutError") {
        patchJob({ status: "error", error: "A request timed out. Resume to retry." });
        log("error", "Request timed out");
      } else {
        patchJob({ status: "error", error: String(e?.message || e) });
        log("error", String(e?.message || e));
      }
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }

    function finishStopped() {
      if (cancelRef.current) {
        patchJob({ status: "idle" });
        log("warn", "Sync cancelled");
      } else {
        patchJob({ status: "paused" });
        log("info", "Sync paused");
      }
      persistSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => run(false), [run]);
  const restart = useCallback(() => run(true), [run]);
  const pause = useCallback(() => {
    if (runningRef.current) pauseRef.current = true;
  }, []);
  const cancel = useCallback(() => {
    if (runningRef.current) cancelRef.current = true;
    else {
      patchJob({ status: "idle" });
      log("warn", "Sync cancelled");
    }
  }, [patchJob, log]);
  const clearError = useCallback(() => {
    if (jobRef.current.status === "error")
      patchJob({ status: "paused", error: null });
  }, [patchJob]);

  return (
    <SyncContext.Provider
      value={{ items, hydrated, job, isRunning, start, restart, pause, cancel, clearError }}
    >
      {children}
    </SyncContext.Provider>
  );
}
