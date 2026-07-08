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

export function getCache<T>(key: string): { data: T; ageMs: number } | null {
  const now = Date.now();

  const m = mem.get(key) as Entry<T> | undefined;
  if (m && now - m.ts < TTL_MS) return { data: m.data, ageMs: now - m.ts };

  try {
    const parsed = JSON.parse(fs.readFileSync(fileFor(key), "utf8")) as Entry<T>;
    if (parsed && now - parsed.ts < TTL_MS) {
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
