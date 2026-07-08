import type { Album } from "./types";

/**
 * Small client-side snapshot in localStorage so the app paints instantly on
 * repeat visits (stale-while-revalidate). Guarded against the ~5MB quota;
 * very large libraries simply skip the client cache and rely on the server one.
 */
const KEY = "slc_snapshot_v1";
const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_BYTES = 4_500_000;

export interface Snapshot {
  ts: number;
  items: Album[];
  likedSongs: number;
}

export function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    if (!s || Date.now() - s.ts > TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSnapshot(items: Album[], likedSongs: number): void {
  try {
    const payload = JSON.stringify({ ts: Date.now(), items, likedSongs });
    if (payload.length > MAX_BYTES) {
      localStorage.removeItem(KEY);
      return;
    }
    localStorage.setItem(KEY, payload);
  } catch {
    // quota exceeded or unavailable — ignore
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
