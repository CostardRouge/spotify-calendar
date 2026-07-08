import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/session";
import { previous } from "@/lib/spotify";
import { mapPlayerError } from "@/lib/playerErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Skip to previous track: POST /api/player/previous  Body: { deviceId?: string } */
export async function POST(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let deviceId: string | undefined;
  try {
    const text = await req.text();
    if (text) deviceId = JSON.parse(text)?.deviceId;
  } catch {
    /* no body is fine */
  }
  try {
    await previous(auth.accessToken, deviceId);
    const res = NextResponse.json({ ok: true });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
