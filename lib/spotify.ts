import { config } from "./config";
import type { Album, SpotifyTokens } from "./types";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

function basicAuthHeader(): string {
  const raw = `${config.clientId}:${config.clientSecret}`;
  return "Basic " + Buffer.from(raw).toString("base64");
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Use a refresh token to obtain a fresh access token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const __t0 = Date.now(); // [SYNC-DEBUG] temporary instrumentation
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    console.log(`[SYNC-DEBUG] token refresh -> ${res.status} in ${Date.now() - __t0}ms`);
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }
  const tokens: SpotifyTokens = await res.json();
  // Log the granted scope: a refresh echoes the scopes the *refresh token* was
  // minted with. If playback scopes are absent here, that's the scope-drift
  // cause of the /me/player 401s.
  console.log(
    `[SYNC-DEBUG] token refresh -> ${res.status} in ${Date.now() - __t0}ms scope="${tokens.scope ?? ""}"`,
  );
  return tokens;
}

const MAX_RETRIES = 4; // for 5xx / network errors
const MAX_RATE_WAITS = 5; // for 429 back-offs (bounded so we can never hang)
const MAX_RATE_WAIT_MS = 10_000;

/**
 * Authenticated GET against the Spotify Web API, with *bounded* back-off on
 * rate limits (429) and transient server errors (500/502/503/504). Every retry
 * path is capped, so a call always settles in finite time.
 */
async function apiGet(
  path: string,
  token: string,
  attempt = 0,
  rateWaits = 0,
): Promise<any> {
  let res: Response;
  const __t0 = Date.now(); // [SYNC-DEBUG] temporary instrumentation
  try {
    res = await fetch(API + path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    console.log(`[SYNC-DEBUG] GET ${path} attempt=${attempt} NETWORK-ERROR after ${Date.now() - __t0}ms:`, (e as Error)?.message);
    if (attempt < MAX_RETRIES) {
      await sleep(500 * 2 ** attempt);
      return apiGet(path, token, attempt + 1, rateWaits);
    }
    throw e;
  }
  console.log(`[SYNC-DEBUG] GET ${path} -> ${res.status} in ${Date.now() - __t0}ms (attempt=${attempt}, rateWaits=${rateWaits}, retry-after=${res.headers.get("Retry-After") ?? "-"})`);

  if (res.status === 401) {
    const err = new Error("unauthorized");
    (err as any).status = 401;
    throw err;
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 1; // seconds
    // Short bursts: wait the advertised time and retry (bounded). Long bans:
    // never hammer — surface a typed error so the caller can stop and tell the
    // user when to come back. Retrying into an active ban only prolongs it.
    if (retryAfter * 1000 <= MAX_RATE_WAIT_MS && rateWaits < MAX_RATE_WAITS) {
      await sleep(retryAfter * 1000);
      return apiGet(path, token, attempt, rateWaits + 1);
    }
    const err = new Error(`Spotify rate limit — retry after ${retryAfter}s`);
    (err as any).status = 429;
    (err as any).retryAfter = retryAfter;
    throw err;
  }

  if (res.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(500 * 2 ** attempt);
    return apiGet(path, token, attempt + 1, rateWaits);
  }

  if (!res.ok) {
    throw new Error(`Spotify API ${path} -> ${res.status}`);
  }
  // 204 No Content (e.g. /me/player when nothing is active) has an empty body,
  // so res.json() would throw — return null instead.
  if (res.status === 204) return null;
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Authenticated write (PUT/POST) against the Spotify Web API, used for playback
 * control. Mirrors apiGet's bounded back-off on 429/5xx and typed 401/429/404
 * errors so route handlers can map them to friendly responses.
 *
 * Playback-control endpoints return 204 No Content on success (no JSON body),
 * so this resolves to void.
 */
async function apiSend(
  method: "PUT" | "POST",
  path: string,
  token: string,
  body?: unknown,
  attempt = 0,
  rateWaits = 0,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      await sleep(500 * 2 ** attempt);
      return apiSend(method, path, token, body, attempt + 1, rateWaits);
    }
    throw e;
  }

  if (res.status === 401) {
    const err = new Error("unauthorized");
    (err as any).status = 401;
    throw err;
  }

  // 404 with reason NO_ACTIVE_DEVICE is the common "nothing is playing" case —
  // surface it typed so the UI can offer the device picker / deep link.
  if (res.status === 404) {
    const err = new Error("no_active_device");
    (err as any).status = 404;
    throw err;
  }

  // 403 typically means the account is not Premium (control is Premium-only).
  if (res.status === 403) {
    const err = new Error("premium_required");
    (err as any).status = 403;
    throw err;
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 1;
    if (retryAfter * 1000 <= MAX_RATE_WAIT_MS && rateWaits < MAX_RATE_WAITS) {
      await sleep(retryAfter * 1000);
      return apiSend(method, path, token, body, attempt, rateWaits + 1);
    }
    const err = new Error(`Spotify rate limit — retry after ${retryAfter}s`);
    (err as any).status = 429;
    (err as any).retryAfter = retryAfter;
    throw err;
  }

  if (res.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(500 * 2 ** attempt);
    return apiSend(method, path, token, body, attempt + 1, rateWaits);
  }

  if (!res.ok) {
    throw new Error(`Spotify API ${method} ${path} -> ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Playback (Spotify Connect) — control the user's active device.
// ---------------------------------------------------------------------------

export interface PlaybackState {
  isPlaying: boolean;
  deviceId: string | null;
  deviceName: string | null;
  progressMs: number;
  durationMs: number;
  track: {
    id: string;
    name: string;
    artists: string;
    album: string;
    cover: string;
    uri: string;
  } | null;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
}

/** Current playback state, or null when nothing is active (204 No Content). */
export async function getPlaybackState(
  token: string,
): Promise<PlaybackState | null> {
  const d: any = await apiGet("/me/player", token);
  // apiGet returns res.json(); Spotify sends 204 (empty) when idle. Guard for it.
  if (!d || !d.item) return null;
  const t = d.item;
  return {
    isPlaying: !!d.is_playing,
    deviceId: d.device?.id ?? null,
    deviceName: d.device?.name ?? null,
    progressMs: d.progress_ms ?? 0,
    durationMs: t.duration_ms ?? 0,
    track: {
      id: t.id,
      name: t.name,
      artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
      album: t.album?.name ?? "",
      cover: t.album?.images?.[0]?.url ?? "",
      uri: t.uri,
    },
  };
}

/** The user's available Spotify Connect devices. */
export async function getDevices(token: string): Promise<Device[]> {
  const d: any = await apiGet("/me/player/devices", token);
  return (d.devices ?? []).map((x: any) => ({
    id: x.id,
    name: x.name,
    type: x.type,
    isActive: !!x.is_active,
    isRestricted: !!x.restricted,
  }));
}

/**
 * Start/resume playback. Provide either a `contextUri` (album/playlist/artist)
 * or `uris` (one or more track URIs). With neither, resumes the current track.
 * Optionally targets a specific `deviceId`.
 */
export async function play(
  token: string,
  opts: { contextUri?: string; uris?: string[]; deviceId?: string } = {},
): Promise<void> {
  const query = opts.deviceId ? `?device_id=${encodeURIComponent(opts.deviceId)}` : "";
  const body: Record<string, unknown> = {};
  if (opts.contextUri) body.context_uri = opts.contextUri;
  if (opts.uris?.length) body.uris = opts.uris;
  await apiSend(
    "PUT",
    `/me/player/play${query}`,
    token,
    Object.keys(body).length ? body : undefined,
  );
}

/**
 * Add a single track/episode uri to the end of the playback queue. Requires an
 * active device (Spotify returns 404 NO_ACTIVE_DEVICE otherwise) and Premium.
 */
export async function queue(
  token: string,
  uri: string,
  deviceId?: string,
): Promise<void> {
  const params = new URLSearchParams({ uri });
  if (deviceId) params.set("device_id", deviceId);
  await apiSend("POST", `/me/player/queue?${params.toString()}`, token);
}

/**
 * All track uris for an album, in track order (paginated). Used to enqueue a
 * whole album, since the queue endpoint only accepts one track uri at a time.
 */
export async function getAlbumTrackUris(
  token: string,
  albumId: string,
): Promise<string[]> {
  const uris: string[] = [];
  let offset = 0;
  const limit = 50;
  while (true) {
    const d: any = await apiGet(
      `/albums/${albumId}/tracks?limit=${limit}&offset=${offset}`,
      token,
    );
    const items = d?.items ?? [];
    for (const t of items) if (t?.uri) uris.push(t.uri);
    if (!d?.next || items.length === 0) break;
    offset += limit;
  }
  return uris;
}

export async function pause(token: string, deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await apiSend("PUT", `/me/player/pause${query}`, token);
}

export async function next(token: string, deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await apiSend("POST", `/me/player/next${query}`, token);
}

export async function previous(token: string, deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await apiSend("POST", `/me/player/previous${query}`, token);
}

/** Transfer playback to a device (used by the device picker). */
export async function transferPlayback(
  token: string,
  deviceId: string,
  play = true,
): Promise<void> {
  await apiSend("PUT", "/me/player", token, {
    device_ids: [deviceId],
    play,
  });
}

function dateKey(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function mapArtists(raw: any[]): { id: string; name: string }[] {
  return (raw ?? []).map((a: any) => ({ id: a.id, name: a.name }));
}

export interface Page {
  items: Album[];
  total: number;
  next: boolean;
}

function mapSavedAlbum(item: any): Album | null {
  const al = item?.album;
  if (!al) return null;
  return {
    id: al.id,
    kind: "album",
    name: al.name,
    addedAt: item.added_at,
    dateKey: dateKey(new Date(item.added_at)),
    year: parseInt(String(al.release_date ?? "").slice(0, 4)) || null,
    cover: al.images?.[0]?.url ?? "",
    artists: mapArtists(al.artists),
    genres: [],
  };
}

function mapSavedTrack(item: any): Album | null {
  const t = item?.track;
  if (!t) return null;
  const al = t.album ?? {};
  return {
    id: "t_" + t.id, // avoid id collisions with albums
    kind: "track",
    name: t.name,
    albumName: al.name,
    addedAt: item.added_at,
    dateKey: dateKey(new Date(item.added_at)),
    year: parseInt(String(al.release_date ?? "").slice(0, 4)) || null,
    cover: al.images?.[0]?.url ?? "",
    artists: mapArtists(t.artists),
    genres: [],
  };
}

/** One page of saved albums. */
export async function fetchAlbumsPage(
  token: string,
  offset: number,
  limit: number,
): Promise<Page> {
  const d: any = await apiGet(`/me/albums?limit=${limit}&offset=${offset}`, token);
  const items = (d.items ?? []).map(mapSavedAlbum).filter(Boolean) as Album[];
  return { items, total: d.total ?? items.length, next: !!d.next };
}

/** One page of liked (saved) tracks. */
export async function fetchTracksPage(
  token: string,
  offset: number,
  limit: number,
): Promise<Page> {
  const d: any = await apiGet(`/me/tracks?limit=${limit}&offset=${offset}`, token);
  const items = (d.items ?? []).map(mapSavedTrack).filter(Boolean) as Album[];
  return { items, total: d.total ?? items.length, next: !!d.next };
}

/**
 * Fetch genres for a set of artist ids (Spotify tags genres on artists, not
 * albums/tracks). Returns a map artistId -> genres. Best-effort per batch.
 */
export async function fetchArtistGenresBatch(
  token: string,
  ids: string[],
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).filter(Boolean);
    if (!batch.length) continue;
    // Gentle pacing between chunks. A large library resolves thousands of
    // artists, and firing every /artists request back-to-back reliably trips
    // Spotify's rolling rate window — which used to come back as a throttled,
    // silently-dropped chunk (i.e. no genres at all). Stay under the window.
    if (i > 0) await sleep(120);
    try {
      const d: any = await apiGet("/artists?ids=" + batch.join(","), token);
      for (const a of d.artists ?? []) if (a) map[a.id] = a.genres ?? [];
    } catch (e) {
      // A rate limit must NOT be swallowed: doing so returns empty genres for
      // the whole run and marks the sync "done" with an empty genre filter.
      // Surface it so the caller can back off and let the user resume.
      if ((e as any)?.status === 429 || (e as any)?.status === 401) throw e;
      // Other transient errors stay non-fatal: leave those artists ungenred.
    }
  }
  return map;
}
