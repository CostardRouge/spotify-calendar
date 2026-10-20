/**
 * The [SYNC-DEBUG] instrumentation of lib/spotify.ts, kept for the scope-drift
 * investigation (docs/memory/architecture.md) but off by default: it prints
 * every Spotify call with its timing and, on a token refresh, the granted
 * scope string — nothing a production console should carry. SYNC_DEBUG=1
 * turns it on (.env.example). The variable is read at each call, not at
 * import, so a test can flip it.
 */
export function syncDebugEnabled(): boolean {
  return process.env.SYNC_DEBUG === "1";
}

export function debug(message: string, ...rest: unknown[]): void {
  if (syncDebugEnabled()) console.log(`[SYNC-DEBUG] ${message}`, ...rest);
}
