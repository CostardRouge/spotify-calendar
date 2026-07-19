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
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
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
  try {
    res = await fetch(API + path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      await sleep(500 * 2 ** attempt);
      return apiGet(path, token, attempt + 1, rateWaits);
    }
    throw e;
  }

  if (res.status === 401) {
    const err = new Error("unauthorized");
    (err as any).status = 401;
    throw err;
  }

  // 403 on a read endpoint (e.g. GET /me/player) means the account isn't
  // Premium — mirrors apiSend's handling of control endpoints. Without this,
  // the error falls through to the generic branch below with no `.status`,
  // and callers like mapPlayerError() (which only special-cases 401/403/404/429)
  // then hit their catch-all and return a literal HTTP 502 to the browser —
  // which is what was happening on every /api/player poll for non-Premium
  // accounts, every 5s, forever.
  if (res.status === 403) {
    const err = new Error("premium_required");
    (err as any).status = 403;
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

/** A single item in the playback queue (track or podcast episode). */
export interface QueueTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  cover: string;
  uri: string;
}

/**
 * The playback queue as Spotify exposes it: the currently-playing item plus a
 * flat "up next" list. Note the Web API does NOT distinguish user-queued items
 * from context-continuation items — they arrive in one array — and it offers no
 * "previously played" here, so we only surface Now Playing + Up Next.
 */
export interface QueueState {
  nowPlaying: QueueTrack | null;
  upNext: QueueTrack[];
}

/** Normalize a raw queue item (track or episode) into a QueueTrack. */
function toQueueTrack(t: any): QueueTrack | null {
  if (!t) return null;
  const imgs = t.album?.images ?? t.images ?? t.show?.images ?? [];
  // Smallest image is last; fine for a compact list row.
  const cover = imgs.length ? imgs[imgs.length - 1]?.url ?? "" : "";
  const artists = t.artists?.length
    ? t.artists.map((a: any) => a.name).join(", ")
    : t.show?.name ?? "";
  return {
    id: t.id ?? "",
    name: t.name ?? "",
    artists,
    album: t.album?.name ?? t.show?.name ?? "",
    cover,
    uri: t.uri ?? "",
  };
}

/**
 * Current playback queue: GET /me/player/queue. Requires playback-read scope.
 * Returns empty state when nothing is active.
 */
export async function getQueue(token: string): Promise<QueueState> {
  const d: any = await apiGet("/me/player/queue", token);
  return {
    nowPlaying: toQueueTrack(d?.currently_playing),
    upNext: (d?.queue ?? [])
      .map(toQueueTrack)
      .filter(Boolean) as QueueTrack[],
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
 * albums/tracks). Returns a map artistId -> genres. Best-effort per artist.
 *
 * IMPORTANT (Spotify Web API change, Feb 6 2026): the bulk "Get Several Artists"
 * endpoint (GET /artists?ids=...) was REMOVED. Calling it now fails, and because
 * this helper treats non-401/429 errors as non-fatal, that failure used to be
 * swallowed — leaving *every* artist ungenred so the sync finished "done" with a
 * completely empty genre filter. We now resolve genres via the still-supported
 * single-artist endpoint GET /artists/{id}, one request per artist. The
 * per-artist server cache (see app/api/genres/route.ts) makes repeat/overlapping
 * lookups free, so the extra requests are only ever paid once per artist.
 *
 * Data caveat: Spotify is also deprecating the artist `genres` field itself, so
 * a growing share of artists now return an empty array even on a successful
 * request. That is a source-data limitation, not an error — those artists simply
 * stay ungenred, and the genre filter reflects whatever Spotify still classifies.
 */
export async function fetchArtistGenresBatch(
  token: string,
  ids: string[],
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i++) {
    const id = unique[i];
    // Gentle pacing between per-artist calls. Resolving a large library is now
    // one request per artist, so firing them back-to-back reliably trips
    // Spotify's rolling rate window. Stay comfortably under it.
    if (i > 0) await sleep(80);
    try {
      const a: any = await apiGet("/artists/" + encodeURIComponent(id), token);
      // Key by the *requested* id (the /api/genres route looks results up by the
      // id it asked for); relinked responses could carry a different a.id.
      map[id] = Array.isArray(a?.genres) ? a.genres : [];
    } catch (e) {
      // A rate limit / auth failure must NOT be swallowed: doing so returns empty
      // genres for the run and marks the sync "done" with an empty genre filter.
      // Surface it so the caller can back off and let the user resume.
      if ((e as any)?.status === 429 || (e as any)?.status === 401) throw e;
      // Other transient errors (e.g. a 404 for a stale/relinked artist id) stay
      // non-fatal: leave that artist ungenred and continue.
    }
  }
  return map;
}
