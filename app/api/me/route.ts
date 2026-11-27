import { NextResponse } from "next/server";
import { readSession, writeTokenCookies, writeUserIdCookie } from "@/lib/auth";
import { resolveUserId } from "@/lib/session";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * Identity of the authenticated user: { id, name }. The client keys its local
 * storage (library snapshot, sync job) by the id so accounts sharing a
 * browser never read or overwrite each other's data; the name, cookied at
 * login, labels the account menu ("" for sessions older than that cookie —
 * no Spotify call is spent fetching it).
 */
export async function GET() {
  if (isDemo()) return NextResponse.json({ id: "demo", name: "Demo" });

  const resolved = await resolveUserId();
  if (!resolved) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userName } = await readSession();
  const res = NextResponse.json({ id: resolved.userId, name: userName });
  if (resolved.refreshed) writeTokenCookies(res, resolved.refreshed);
  // Sessions from before per-user isolation have no sp_uid cookie — set it now
  // so subsequent requests skip the Spotify profile lookup.
  if (resolved.cookieMissing) writeUserIdCookie(res, resolved.userId);
  return res;
}
