import fs from "fs";
import path from "path";
import os from "os";

/**
 * Best-effort server-side cache: in-memory (fast, per-process) with a disk
 * backing so data survives restarts. Both layers are guarded — if the disk
 * isn't writable the cache silently degrades to memory-only.
 *
 * Config:
 *   CACHE_TTL_SECONDS  how long entries stay fresh (default 3600 = 1h)
 *   CACHE_DIR          where to persist (default: OS temp dir)
 */
const TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 3600) * 1000;
const DIR =
  process.env.CACHE_DIR || path.join(os.tmpdir(), "spotify-calendar-cache");

interface Entry<T> {
  ts: number;
  data: T;
}

const mem = new Map<string, Entry<unknown>>();

function fileFor(key: string): string {
  return path.join(DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
}

/**
 * `maxAgeMs` overrides the global TTL for one family of keys. Artist genres
 * need it: they cost one Spotify request per artist, and with the 1h default
 * every hourly auto-refresh would re-query every artist Spotify has no genre
 * for — thousands of calls, straight into the rate limit.
 */
export function getCache<T>(
  key: string,
  maxAgeMs: number = TTL_MS,
): { data: T; ageMs: number } | null {
  const now = Date.now();

  const m = mem.get(key) as Entry<T> | undefined;
  if (m && now - m.ts < maxAgeMs) return { data: m.data, ageMs: now - m.ts };

  try {
    const parsed = JSON.parse(fs.readFileSync(fileFor(key), "utf8")) as Entry<T>;
    if (parsed && now - parsed.ts < maxAgeMs) {
      mem.set(key, parsed);
      return { data: parsed.data, ageMs: now - parsed.ts };
    }
  } catch {
    // no disk entry / not readable — ignore
  }
  return null;
}

export function setCache<T>(key: string, data: T): void {
  const entry: Entry<T> = { ts: Date.now(), data };
  mem.set(key, entry);
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileFor(key), JSON.stringify(entry));
  } catch {
    // memory-only fallback
  }
}

export const cacheTtlSeconds = TTL_MS / 1000;
