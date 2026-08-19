import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import type { Album } from "./types";

/**
 * Server-side per-user library store. One JSON file per Spotify account, so a
 * sync from one user can never overwrite another user's saved library. Unlike
 * lib/cache.ts this has no TTL: the snapshot is the user's durable copy and is
 * only replaced by their own next completed sync.
 *
 * Config:
 *   LIBRARY_DIR  where to persist (default: <CACHE_DIR>/library when CACHE_DIR
 *                is set — in the Home Lab compose that lands on the persisted
 *                volume — otherwise the OS temp dir).
 */
const DIR =
  process.env.LIBRARY_DIR ||
  (process.env.CACHE_DIR
    ? path.join(process.env.CACHE_DIR, "library")
    : path.join(os.tmpdir(), "spotify-calendar-library"));

/** Bump when the persisted shape changes so stale snapshots are discarded. */
export const LIBRARY_SCHEMA_VERSION = 1;

export interface StoredLibrary {
  ts: number; // epoch ms of the last completed sync
  items: Album[];
  likedSongs: number;
  v: number;
}

function fileFor(userId: string): string {
  // Spotify ids are URL-safe, but never trust an id as a raw path segment:
  // sanitize for readability and suffix a hash so distinct ids can't collide
  // after sanitization.
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const hash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 12);
  return path.join(DIR, `library_${safe}_${hash}.json`);
}

export function readLibrary(userId: string): StoredLibrary | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(fileFor(userId), "utf8"),
    ) as StoredLibrary;
    if (
      parsed &&
      parsed.v === LIBRARY_SCHEMA_VERSION &&
      Array.isArray(parsed.items)
    ) {
      return parsed;
    }
  } catch {
    // missing / unreadable / corrupt — treated as "no server copy"
  }
  return null;
}

export function writeLibrary(
  userId: string,
  items: Album[],
  likedSongs: number,
): boolean {
  const snap: StoredLibrary = {
    ts: Date.now(),
    items,
    likedSongs,
    v: LIBRARY_SCHEMA_VERSION,
  };
  try {
    fs.mkdirSync(DIR, { recursive: true });
    // Write-then-rename so a crash mid-write never truncates the good copy.
    const tmp = fileFor(userId) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(snap));
    fs.renameSync(tmp, fileFor(userId));
    return true;
  } catch {
    return false; // disk unavailable — the client keeps its local copy anyway
  }
}
