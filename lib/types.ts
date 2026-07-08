export interface Artist {
  id: string;
  name: string;
}

/**
 * A library item shown in the UI. Can be a saved album or a liked (saved)
 * track — both carry an `added_at` timestamp and album art, so they share
 * one shape. `kind` distinguishes them.
 */
export interface Album {
  id: string;
  kind: "album" | "track";
  name: string;
  albumName?: string; // for tracks: the album the track belongs to
  addedAt: string; // ISO timestamp the item was saved to the library
  dateKey: string; // YYYY-MM-DD (local) of addedAt
  year: number | null; // release year
  cover: string; // album art URL ("" if none)
  artists: Artist[];
  genres: string[];
}

export interface LibraryResponse {
  albums: Album[];
  tracks: Album[];
}

/** Raw Spotify token endpoint response. */
export interface SpotifyTokens {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}
