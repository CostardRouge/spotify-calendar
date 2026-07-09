"use client";

/**
 * Thin client-side helpers for controlling playback through our own
 * /api/player/* routes. Any component can call `playItem(...)` to start a
 * liked song or album on the user's active Spotify device; the MiniPlayer
 * listens for the resulting events to surface the device picker / errors.
 */

import type { QueueState } from "@/lib/spotify";

export type PlayerErrorKind =
  | "unauthorized"
  | "reauth_required"
  | "premium_required"
  | "no_active_device"
  | "rate_limited"
  | "player_failed";

export interface PlayRequest {
  /** album/playlist/artist context, e.g. "spotify:album:xyz" */
  contextUri?: string;
  /** one or more track URIs, e.g. ["spotify:track:xyz"] */
  uris?: string[];
  /** target a specific device (from the picker) */
  deviceId?: string;
}

/** Build a Spotify URI from a library item id (tracks are prefixed "t_"). */
export function itemToUri(id: string, kind: "album" | "track"): string {
  const bare = kind === "track" ? id.replace(/^t_/, "") : id;
  return `spotify:${kind}:${bare}`;
}

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Start playback. On "no active device" this dispatches a `player:needdevice`
 * window event (carrying the original request) so the MiniPlayer can show the
 * picker / offer a deep link, then retry with a chosen device.
 * Returns true on success.
 */
export async function playItem(req: PlayRequest): Promise<boolean> {
  const res = await post("/api/player/play", req);
  if (res.ok) {
    // Nudge the mini-player to refresh its state promptly.
    window.dispatchEvent(new CustomEvent("player:changed"));
    return true;
  }

  let kind: PlayerErrorKind = "player_failed";
  try {
    kind = (await res.json())?.error ?? kind;
  } catch {
    /* ignore */
  }

  if (kind === "no_active_device") {
    window.dispatchEvent(
      new CustomEvent<PlayRequest>("player:needdevice", { detail: req }),
    );
  } else {
    window.dispatchEvent(
      new CustomEvent<PlayerErrorKind>("player:error", { detail: kind }),
    );
  }
  return false;
}

/**
 * Add item(s) to the current playback queue. Same event contract as playItem:
 * on "no active device" it dispatches `player:needdevice` (so the MiniPlayer can
 * show the picker); other failures dispatch `player:error`. Returns true on
 * success. Callers should only queue when something is already playing —
 * otherwise start playback with playItem instead.
 */
export async function queueItem(req: PlayRequest): Promise<boolean> {
  const res = await post("/api/player/queue", req);
  if (res.ok) {
    window.dispatchEvent(new CustomEvent("player:changed"));
    return true;
  }

  let kind: PlayerErrorKind = "player_failed";
  try {
    kind = (await res.json())?.error ?? kind;
  } catch {
    /* ignore */
  }

  if (kind === "no_active_device") {
    window.dispatchEvent(
      new CustomEvent<PlayRequest>("player:needdevice", { detail: req }),
    );
  } else {
    window.dispatchEvent(
      new CustomEvent<PlayerErrorKind>("player:error", { detail: kind }),
    );
  }
  return false;
}

export const pausePlayback = () => post("/api/player/pause");
export const resumePlayback = () => post("/api/player/play");
export const nextTrack = () => post("/api/player/next");
export const previousTrack = () => post("/api/player/previous");

/**
 * Read the current playback queue (now playing + up next). Returns null on any
 * failure so callers can render an empty/error state without throwing.
 */
export async function fetchQueue(): Promise<QueueState | null> {
  try {
    const res = await fetch("/api/player/queue", { cache: "no-store" });
    if (!res.ok) return null;
    const { queue } = (await res.json()) as { queue: QueueState | null };
    return queue ?? null;
  } catch {
    return null;
  }
}

/** Open the native Spotify app at a given URI (deep-link fallback). */
export function deepLinkToSpotify(uri: string): void {
  window.location.href = uri;
}

/**
 * Web link to an item's detail page. Opens the Spotify app at that album/song
 * if installed, otherwise the web player. Track ids carry a "t_" prefix in the
 * library to avoid colliding with album ids — strip it for the URL.
 */
export function spotifyUrl(id: string, kind: "album" | "track"): string {
  const bare = kind === "track" ? id.replace(/^t_/, "") : id;
  return `https://open.spotify.com/${kind}/${bare}`;
}
