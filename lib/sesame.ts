/**
 * Sésame's settings and its OpenID Connect client (openid-client, OpenID
 * Certified: discovery, PKCE, the code exchange, the ID token's checks). Set
 * the three SESAME_* variables and the whole app sits behind a Sésame
 * sign-in (proxy.ts); leave them empty and nothing changes.
 */
import * as oidc from "openid-client";

export type SesameSettings = { issuer: string; clientId: string; clientSecret: string };

declare global {
  var __spotifyCalendarSesame: { key: string; client: Promise<oidc.Configuration> } | undefined;
}

export function sesameSettings(): SesameSettings | null {
  const issuer = process.env.SESAME_ISSUER;
  const clientId = process.env.SESAME_CLIENT_ID;
  const clientSecret = process.env.SESAME_CLIENT_SECRET;
  return issuer && clientId && clientSecret ? { issuer, clientId, clientSecret } : null;
}

/** Discovered once per issuer + id; a failure is not cached (Sésame may be restarting). */
export function sesameClient(s: SesameSettings): Promise<oidc.Configuration> {
  const cacheKey = `${s.issuer}|${s.clientId}`;
  const cached = globalThis.__spotifyCalendarSesame;
  if (cached?.key === cacheKey) return cached.client;
  const issuer = new URL(s.issuer);
  const client = oidc
    .discovery(
      issuer,
      s.clientId,
      s.clientSecret,
      oidc.ClientSecretBasic(s.clientSecret),
      issuer.protocol === "http:" ? { execute: [oidc.allowInsecureRequests] } : undefined,
    )
    .catch((error) => {
      globalThis.__spotifyCalendarSesame = undefined;
      throw error;
    });
  globalThis.__spotifyCalendarSesame = { key: cacheKey, client };
  return client;
}
