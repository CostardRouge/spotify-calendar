/**
 * Centralised, validated access to server-side configuration.
 * All secrets come from environment variables (see .env.example).
 */
export const config = {
  clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  redirectUri:
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://127.0.0.1:3000/api/auth/callback",
  scopes: [
    "user-library-read",
    // Playback: read current state / devices and control the user's active
    // Spotify Connect device (requires Premium for the control endpoints).
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
  ].join(" "),
};

/**
 * Public base URL of the app, derived from the redirect URI so browser-facing
 * redirects always target the host the user actually reaches — never the
 * container-internal host that `request.url` would expose behind Docker.
 * Optionally overridable with APP_BASE_URL.
 */
export const appBaseUrl =
  process.env.APP_BASE_URL ??
  config.redirectUri.replace(/\/api\/auth\/callback\/?$/, "");

export function assertConfigured() {
  const missing: string[] = [];
  if (!config.clientId) missing.push("SPOTIFY_CLIENT_ID");
  if (!config.clientSecret) missing.push("SPOTIFY_CLIENT_SECRET");
  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill them in.`,
    );
  }
}

export const COOKIE = {
  access: "sp_access",
  refresh: "sp_refresh",
  expires: "sp_expires",
  scope: "sp_scope",
  state: "sp_state",
};
