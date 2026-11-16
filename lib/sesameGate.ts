/**
 * Sésame in front of the whole app (the owner's identity provider, OpenID
 * Connect): the pure half. Two short signed cookies, both HMAC-SHA256 with a
 * key derived from SESAME_CLIENT_SECRET, so no new secret to set and a value
 * can be neither forged nor edited:
 *   - the gate (`sc_gate`, 30 days): "Sésame let this browser in";
 *   - the round trip (`sc_sesame`, ten minutes): the PKCE verifier, the state
 *     and where to go next, between leaving for Sésame and coming back.
 * Web Crypto only, so the same code runs in proxy.ts and in a route.
 */

export const GATE_COOKIE = "sc_gate";
export const GATE_SECONDS = 30 * 24 * 3600;
export const FLOW_COOKIE = "sc_sesame";
export const FLOW_PATH = "/api/auth/sesame";
export const FLOW_SECONDS = 600;
export const CALLBACK_PATH = "/api/auth/sesame/callback";

export type Flow = { state: string; verifier: string; next: string };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function hmac(purpose: string, secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(`spotify-calendar:${purpose}:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload))));
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function seal(purpose: string, data: object, seconds: number, secret: string, now: number): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: now + seconds * 1000 })).toString("base64url");
  return `${payload}.${await hmac(purpose, secret, payload)}`;
}

async function open(purpose: string, raw: string | undefined, secret: string, now: number): Promise<Record<string, unknown> | null> {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  if (!sameText(raw.slice(dot + 1), await hmac(purpose, secret, payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
    return typeof data.exp === "number" && data.exp > now ? data : null;
  } catch {
    return null;
  }
}

/** The gate cookie's value for a Sésame subject. */
export function sealGate(sub: string, secret: string, now = Date.now()): Promise<string> {
  return seal("gate", { sub }, GATE_SECONDS, secret, now);
}

/** Whether a gate cookie is genuine and alive. */
export async function gateOpen(raw: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  const data = await open("gate", raw, secret, now);
  return typeof data?.sub === "string" && data.sub.length > 0;
}

export function sealFlow(flow: Flow, secret: string, now = Date.now()): Promise<string> {
  return seal("flow", flow, FLOW_SECONDS, secret, now);
}

export async function openFlow(raw: string | undefined, secret: string, now = Date.now()): Promise<Flow | null> {
  const data = await open("flow", raw, secret, now);
  if (!data || typeof data.state !== "string" || typeof data.verifier !== "string") return null;
  return { state: data.state, verifier: data.verifier, next: safeNext(typeof data.next === "string" ? data.next : null) };
}

/** Only ever a path on this site: never a full URL, never `//host`. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

/** The origin as the browser used it, behind Traefik and the tunnel. */
export function originFrom(headers: Headers, fallback: string): string {
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
  if (!host) return fallback;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(fallback).protocol.replace(":", "");
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

/** Paths the gate leaves open: the round trip itself, the Docker healthcheck. */
export function gatePublic(pathname: string): boolean {
  return pathname === "/api/health" || pathname === FLOW_PATH || pathname.startsWith(`${FLOW_PATH}/`);
}
