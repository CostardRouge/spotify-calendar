/**
 * Tiny in-memory record of Spotify rate-limit (429) cooldowns, shared across
 * requests in this server process. Lets clients ask "am I allowed to sync yet?"
 * WITHOUT making a Spotify call — which is important, because any request during
 * an active ban counts against the app and can prolong the cooldown.
 *
 * In-memory only: a server restart clears it. That's fine — the client also
 * persists the cooldown, so the two together cover the common cases.
 */

let rateLimitedUntil = 0; // epoch ms; 0 means "not limited"

/** Record a 429. `retryAfterSeconds` comes from Spotify's Retry-After header. */
export function noteRateLimit(retryAfterSeconds: number): void {
  const until = Date.now() + Math.max(0, retryAfterSeconds) * 1000;
  if (until > rateLimitedUntil) rateLimitedUntil = until;
}

/** Clear the cooldown (e.g. after a successful request). */
export function clearRateLimit(): void {
  rateLimitedUntil = 0;
}

/**
 * Current status. `retryAfter` is remaining seconds (0 when clear); `until` is
 * the epoch-ms timestamp the cooldown ends (null when clear).
 */
export function getRateLimit(): {
  limited: boolean;
  retryAfter: number;
  until: number | null;
} {
  const now = Date.now();
  if (rateLimitedUntil <= now) {
    if (rateLimitedUntil !== 0) rateLimitedUntil = 0;
    return { limited: false, retryAfter: 0, until: null };
  }
  return {
    limited: true,
    retryAfter: Math.ceil((rateLimitedUntil - now) / 1000),
    until: rateLimitedUntil,
  };
}
