import { NextResponse } from "next/server";
import { writeTokenCookies, writeUserIdCookie } from "@/lib/auth";
import { resolveUserId } from "@/lib/session";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * Identity of the authenticated user: { id }. The client keys its local
 * storage (library snapshot, sync job) by this id so accounts sharing a
 * browser never read or overwrite each other's data.
 */
export async function GET() {
  if (isDemo()) return NextResponse.json({ id: "demo" });

  const resolved = await resolveUserId();
  if (!resolved) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ id: resolved.userId });
  if (resolved.refreshed) writeTokenCookies(res, resolved.refreshed);
  // Sessions from before per-user isolation have no sp_uid cookie — set it now
  // so subsequent requests skip the Spotify profile lookup.
  if (resolved.cookieMissing) writeUserIdCookie(res, resolved.userId);
  return res;
}
