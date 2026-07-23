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
// Artists per /api/genres POST. Genres resolve via Spotify's bulk endpoint
// (50 ids/request), so a chunk of this size is only a handful of upstream calls
// and finishes comfortably inside the route's 120s budget.
const GENRE_CHUNK = 200;

// Auto-start rules, applied once per app load after hydration:
// – a job interrupted mid-run (tab closed while "running") resumes immediately;
// – a user-paused job resumes only after sitting idle this long, so pausing
//   and then reloading the page doesn't fight the user;
const AUTO_RESUME_PAUSED_AFTER_MS = 30 * 60 * 1000;
// – a completed library this stale checks for new saves (incremental refresh).
const AUTO_REFRESH_AFTER_MS = 60 * 60 * 1000;

type RunMode = "resume" | "restart" | "refresh";

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
  refresh: () => void; // fetch only newly saved items
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

  // Action decided during hydration, fired once by the effect further below.
  const autoStartRef = useRef<RunMode | null>(null);

  // Hydrate from storage on mount, then decide whether to auto-start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await loadSnapshot();
      if (!cancelled && snap?.items?.length) setItems(snap.items);
      const stored = loadJob();
      const now = Date.now();
      let auto: RunMode | null = null;

      if (stored) {
        // A job that was "running" when the app closed was interrupted.
        if (stored.status === "running") {
          stored.status = "paused";
          stored.logs = [
            ...(stored.logs ?? []),
            { ts: now, level: "warn", message: "Interrupted — resuming automatically." },
          ];
          auto = "resume";
        } else if (
          stored.status === "paused" &&
          now - (stored.updatedAt ?? 0) > AUTO_RESUME_PAUSED_AFTER_MS
        ) {
          // A long-abandoned pause (came back days later) resumes itself;
          // a fresh, deliberate pause is respected.
          auto = "resume";
        } else if (
          stored.status === "error" &&
          stored.rateLimitedUntil &&
          now >= stored.rateLimitedUntil
        ) {
          // The cooldown that stopped the last run has elapsed — pick it up.
          auto = "resume";
        } else if (
          stored.status === "done" &&
          snap?.items?.length &&
          now - snap.ts > AUTO_REFRESH_AFTER_MS
        ) {
          auto = "refresh";
        }
        jobRef.current = stored;
        if (!cancelled) setJobState(stored);
      } else if (snap?.items?.length && now - snap.ts > AUTO_REFRESH_AFTER_MS) {
        // Library snapshot without a job record (e.g. cleared localStorage).
        auto = "refresh";
      }

      if (!cancelled) {
        autoStartRef.current = auto;
        setHydrated(true);
      }
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

  // Fetch only items saved since the last sync. Spotify returns /me/albums and
  // /me/tracks newest-first, so we walk from offset 0 and stop at the first
  // page that overlaps something we already hold. Returns how many new items
  // were found. Cheap on an up-to-date library: usually a single page.
  async function syncKindIncremental(kind: "album" | "track"): Promise<number> {
    const endpoint = kind === "album" ? "/api/albums" : "/api/tracks";
    const progressKey = kind === "album" ? "albums" : "tracks";
    patchJob({ phase: kind === "album" ? "albums" : "tracks" });

    const existing = new Set(
      itemsRef.current.filter((i) => i.kind === kind).map((i) => i.id),
    );
    const fresh: Album[] = [];
    const freshIds = new Set<string>();
    let offset = 0;
    let total: number | null = null;
    // Set once the scan reaches items we already hold (or the end of the
    // list). If we're interrupted before then, the partial batch is discarded:
    // merging it would leave a gap between it and the items from the last
    // sync, and a later offset-based resume would silently skip that gap.
    let complete = false;

    while (true) {
      if (stopRequested()) break;
      const data = await apiJson(`${endpoint}?offset=${offset}&limit=${PAGE}`, 30000);
      total = data.total ?? total;
      const pageItems: Album[] = data.items ?? [];

      let overlap = false;
      for (const it of pageItems) {
        if (existing.has(it.id)) {
          // First already-known item: everything from here on was saved
          // before the last sync and is already in the library.
          overlap = true;
        } else if (!freshIds.has(it.id)) {
          freshIds.add(it.id);
          fresh.push(it);
        }
      }

      if (overlap || pageItems.length === 0 || !data.next) {
        complete = true;
        break;
      }
      offset += pageItems.length;
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!complete) return 0;

    if (fresh.length) {
      // Prepend: the library list stays newest-first.
      setItems([...fresh, ...itemsRef.current]);
      log(
        "info",
        `Found ${fresh.length} new ${kind === "album" ? "album" : "liked song"}${fresh.length === 1 ? "" : "s"}`,
      );
    }
    const loaded = itemsRef.current.filter((i) => i.kind === kind).length;
    patchJob({ [progressKey]: { loaded, total: total ?? loaded } } as any);
    persistSnapshot();
    return fresh.length;
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
        signal: AbortSignal.timeout(120000),
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

  const run = useCallback(async (mode: RunMode) => {
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

    if (mode === "restart") {
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
    log(
      "info",
      mode === "restart"
        ? "Sync started (full)"
        : mode === "refresh"
          ? "Checking for new saves…"
          : "Sync resumed",
    );

    try {
      let newCount = 0;
      if (mode === "refresh") {
        newCount += await syncKindIncremental("album");
        if (stopRequested()) return finishStopped();
        newCount += await syncKindIncremental("track");
        if (stopRequested()) return finishStopped();
      } else {
        await syncKind("album");
        if (stopRequested()) return finishStopped();
        await syncKind("track");
        if (stopRequested()) return finishStopped();
      }
      await syncGenres();
      if (stopRequested()) return finishStopped();

      patchJob({ status: "done", phase: "done", finishedAt: Date.now() });
      persistSnapshot();
      log(
        "info",
        mode === "refresh"
          ? newCount
            ? `Refresh complete — ${newCount} new item${newCount === 1 ? "" : "s"}`
            : "Refresh complete — no new saves"
          : "Sync complete",
      );
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

  // Fire the auto-start decided at hydration (resume an interrupted run, or
  // refresh a stale library). run() re-checks the rate-limit cooldown itself.
  useEffect(() => {
    if (!hydrated || !autoStartRef.current) return;
    const mode = autoStartRef.current;
    autoStartRef.current = null;
    void run(mode);
  }, [hydrated, run]);

  const start = useCallback(() => run("resume"), [run]);
  const restart = useCallback(() => run("restart"), [run]);
  const refresh = useCallback(() => run("refresh"), [run]);
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
      value={{
        items,
        hydrated,
        job,
        isRunning,
        start,
        restart,
        refresh,
        pause,
        cancel,
        clearError,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
