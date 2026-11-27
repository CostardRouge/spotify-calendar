/**
 * Runs once when the Next.js server starts (Node runtime only).
 *
 * Its one job: clear the dead per-artist genre cache (lib/cache.ts). It is
 * cheap when there is nothing left — one directory listing — so it simply
 * runs on every start rather than remembering that it already did.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { purgeLegacyCache } = await import("./lib/cache");
  const removed = purgeLegacyCache();
  if (removed) console.log(`[CACHE] removed ${removed} obsolete genre cache files`);
}
