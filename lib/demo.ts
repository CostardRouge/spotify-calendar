/**
 * Demo mode: when DEMO_MODE=1 the API routes serve a fixture library instead
 * of calling Spotify, and no authentication is required. This exists so the
 * showcase workflow (GitHub Pages) can boot the app headlessly and take real
 * screenshots — and so anyone can `DEMO_MODE=1 npm run dev` to poke around
 * without creating a Spotify app.
 *
 * The fixture data lives in lib/demo-library.json (regenerate with
 * `node scripts/build-demo-library.mjs`). It contains real releases with real
 * cover art; only the save-dates are synthetic.
 */

import type { Album, LibraryResponse } from "./types";
import type { Page, PlaybackState } from "./spotify";
import demoData from "./demo-library.json";

export const isDemo = () => process.env.DEMO_MODE === "1";

const library = demoData as unknown as LibraryResponse;

/** One page of the fixture library, same shape as the Spotify-backed routes. */
export function demoPage(
  kind: "album" | "track",
  offset: number,
  limit: number,
): Page {
  const all: Album[] = kind === "album" ? library.albums : library.tracks;
  const items = all.slice(offset, offset + limit);
  return { items, total: all.length, next: offset + limit < all.length };
}

/** Genres for artist ids — items ship pre-genred, so resolve from the fixtures. */
export function demoGenres(artistIds: string[]): Record<string, string[]> {
  const byArtist: Record<string, string[]> = {};
  for (const item of [...library.albums, ...library.tracks]) {
    for (const a of item.artists) {
      if (!byArtist[a.id]) byArtist[a.id] = item.genres;
    }
  }
  const out: Record<string, string[]> = {};
  for (const id of artistIds) out[id] = byArtist[id] ?? [];
  return out;
}

/** A believable "now playing" so the mini-player isn't empty in screenshots. */
export function demoPlayback(): PlaybackState {
  const t = library.tracks[0];
  return {
    isPlaying: true,
    deviceId: "demo-device",
    deviceName: "Living Room Speaker",
    progressMs: 73_000,
    durationMs: 214_000,
    track: {
      id: t.id.replace(/^t_/, ""),
      name: t.name,
      artists: t.artists.map((a) => a.name).join(", "),
      album: t.albumName ?? "",
      cover: t.cover,
      uri: `spotify:track:${t.id.replace(/^t_/, "")}`,
    },
  };
}
