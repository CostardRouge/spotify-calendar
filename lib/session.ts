import { readSession } from "./auth";
import { getMe, refreshAccessToken } from "./spotify";
import type { SpotifyTokens } from "./types";

// Scopes required by the player endpoints. Reading playback state / devices
// needs the read scope; the control routes additionally need the modify scope.
// (Premium is a separate concern, surfaced as 403 by Spotify, not 401.)
export const SCOPE_PLAYBACK_READ = "user-read-playback-state";
export const SCOPE_PLAYBACK_MODIFY = "user-modify-playback-state";

/**
 * Given a space-delimited granted-scope string, return which of `required`
 * are absent. An empty `granted` means "unknown" (older sessions that predate
 * scope tracking) and returns [] so we never block on missing information.
 */
export function missingScopes(granted: string, required: string[]): string[] {
  if (!granted) return [];
  const have = new Set(granted.split(" ").filter(Boolean));
  return required.filter((s) => !have.has(s));
}

/**
 * Resolve a usable access token from cookies, refreshing if expired.
 * Returns null when the user is not authenticated.
 * If `refreshed` is set, the caller must persist it via writeTokenCookies.
 * `scope` is the granted-scope string (from the refresh response when we just
 * refreshed, otherwise from the stored cookie) so callers can detect drift.
 */
export async function resolveAccessToken(): Promise<
  { accessToken: string; refreshed: SpotifyTokens | null; scope: string } | null
> {
  const session = await readSession();
  let accessToken = session.access;
  let scope = session.scope;
  let refreshed: SpotifyTokens | null = null;

  if ((!accessToken || Date.now() >= session.expires) && session.refresh) {
    try {
      refreshed = await refreshAccessToken(session.refresh);
      accessToken = refreshed.access_token;
      if (refreshed.scope !== undefined) scope = refreshed.scope;
    } catch {
      return null;
    }
  }

  if (!accessToken) return null;
  return { accessToken, refreshed, scope };
}

/**
 * Identify the authenticated user. The id normally comes straight from the
 * sp_uid cookie (set at login); sessions minted before per-user isolation lack
 * it, so we fall back to asking Spotify once. When `cookieMissing` is true the
 * caller should persist the id via writeUserIdCookie so the lookup isn't repeated.
 * Returns null when not authenticated.
 */
export async function resolveUserId(): Promise<
  { userId: string; refreshed: SpotifyTokens | null; cookieMissing: boolean } | null
> {
  const session = await readSession();
  if (session.userId) {
    return { userId: session.userId, refreshed: null, cookieMissing: false };
  }
  const auth = await resolveAccessToken();
  if (!auth) return null;
  try {
    const me = await getMe(auth.accessToken);
    if (!me.id) return null;
    return { userId: me.id, refreshed: auth.refreshed, cookieMissing: true };
  } catch {
    return null;
  }
}
