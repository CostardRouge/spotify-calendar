import type { Album } from "./types";

/**
 * Durable client-side snapshot of the library, backed by IndexedDB.
 *
 * Why IndexedDB (and not localStorage): localStorage caps at ~5MB and is
 * synchronous, so large libraries used to skip the client cache entirely and a
 * page reload / new deploy meant re-syncing from scratch. IndexedDB has no
 * practical size cap and survives reloads and redeploys, so the loaded albums
 * and tracks persist until the user chooses to re-sync.
 *
 * The store keeps a single record. It is versioned: bump SCHEMA_VERSION whenever
 * the `Album` shape changes so old snapshots are invalidated cleanly (a re-sync)
 * instead of silently feeding a mismatched shape into the UI.
 */
const DB_NAME = "spotify-calendar";
const STORE = "library";
const RECORD_KEY = "snapshot";

/** Bump this when the persisted `Album`/`Snapshot` shape changes. */
export const SCHEMA_VERSION = 1;

/** Legacy localStorage key — migrated once, then removed. */
const LEGACY_KEY = "slc_snapshot_v1";

export interface Snapshot {
  ts: number;
  items: Album[];
  likedSongs: number;
  v: number;
}

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

// A single, reused connection. Opening per-call would be wasteful given how
// often the sync loop persists.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // If the open fails, don't cache the rejection forever.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** One-time import of an existing localStorage snapshot into IndexedDB. */
async function migrateLegacy(): Promise<Snapshot | null> {
  if (typeof localStorage === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const old = JSON.parse(raw) as Partial<Snapshot>;
    if (old && Array.isArray(old.items)) {
      const snap: Snapshot = {
        ts: typeof old.ts === "number" ? old.ts : Date.now(),
        items: old.items as Album[],
        likedSongs: typeof old.likedSongs === "number" ? old.likedSongs : 0,
        v: SCHEMA_VERSION,
      };
      await idbPut(RECORD_KEY, snap);
      return snap;
    }
  } catch {
    // corrupt legacy entry — nothing to migrate
  } finally {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Load the persisted library. Returns null if nothing is stored, IndexedDB is
 * unavailable, or the stored schema version no longer matches (in which case the
 * stale record is cleared). There is intentionally no time-based expiry: the
 * snapshot is the durable local copy and stays until the user re-syncs.
 */
export async function loadSnapshot(): Promise<Snapshot | null> {
  if (!idbAvailable()) return null;
  try {
    const snap = await idbGet<Snapshot>(RECORD_KEY);
    if (!snap) return await migrateLegacy();
    if (snap.v !== SCHEMA_VERSION) {
      await idbDelete(RECORD_KEY).catch(() => {});
      return null;
    }
    if (!Array.isArray(snap.items)) return null;
    return snap;
  } catch {
    return null;
  }
}

export async function saveSnapshot(items: Album[], likedSongs: number): Promise<void> {
  if (!idbAvailable()) return;
  const snap: Snapshot = { ts: Date.now(), items, likedSongs, v: SCHEMA_VERSION };
  try {
    await idbPut(RECORD_KEY, snap);
  } catch {
    // storage full / unavailable — degrade to no client cache
  }
}

export async function clearSnapshot(): Promise<void> {
  if (!idbAvailable()) return;
  try {
    await idbDelete(RECORD_KEY);
  } catch {
    // ignore
  }
}
