import { readSession } from "./auth";
import { refreshAccessToken } from "./spotify";
import type { SpotifyTokens } from "./types";

/**
 * Resolve a usable access token from cookies, refreshing if expired.
 * Returns null when the user is not authenticated.
 * If `refreshed` is set, the caller must persist it via writeTokenCookies.
 */
export async function resolveAccessToken(): Promise<
  { accessToken: string; refreshed: SpotifyTokens | null } | null
> {
  const session = readSession();
  let accessToken = session.access;
  let refreshed: SpotifyTokens | null = null;

  if ((!accessToken || Date.now() >= session.expires) && session.refresh) {
    try {
      refreshed = await refreshAccessToken(session.refresh);
      accessToken = refreshed.access_token;
    } catch {
      return null;
    }
  }

  if (!accessToken) return null;
  return { accessToken, refreshed };
}
