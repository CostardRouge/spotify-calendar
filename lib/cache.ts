import fs from "fs";
import path from "path";
import os from "os";

/**
 * What is left of the server-side cache: its cleanup.
 *
 * The cache under CACHE_DIR held one small JSON file per artist, the genres
 * Spotify used to return. Spotify withholds them from this app (measured
 * 2026-11-27: `GET /artists/{id}` comes back without a `genres` key) and the
 * genre feature is gone, so nothing reads or writes those files any more —
 * 5,682 of them sat on the Home Lab volume, every one an empty list.
 * instrumentation.ts calls this once when the server starts.
 *
 * Only `*.json` files directly in CACHE_DIR go: the per-user library store
 * lives in its `library/` subfolder (lib/libraryStore.ts) and is untouched.
 */
const DIR = process.env.CACHE_DIR || path.join(os.tmpdir(), "spotify-calendar-cache");

export function purgeLegacyCache(dir: string = DIR): number {
  // The folder is a runtime data volume, not part of the app: the ignore
  // comments keep Turbopack from tracing the whole project into the image.
  let names: string[] = [];
  try {
    names = fs.readdirSync(/*turbopackIgnore: true*/ dir);
  } catch {
    return 0; // no cache directory: nothing to clean
  }
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(/*turbopackIgnore: true*/ dir, name);
    try {
      if (!fs.statSync(file).isFile()) continue;
      fs.unlinkSync(file);
      removed++;
    } catch {
      // gone already, or a read-only disk — nothing to do
    }
  }
  return removed;
}
