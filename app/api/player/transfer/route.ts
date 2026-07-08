import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/session";
import { transferPlayback } from "@/lib/spotify";
import { mapPlayerError } from "@/lib/playerErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Transfer playback to a device (used by the device picker):
 * POST /api/player/transfer  Body: { deviceId: string, play?: boolean }
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let deviceId = "";
  let play = true;
  try {
    const body = JSON.parse((await req.text()) || "{}");
    deviceId = body?.deviceId ?? "";
    if (typeof body?.play === "boolean") play = body.play;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!deviceId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    await transferPlayback(auth.accessToken, deviceId, play);
    const res = NextResponse.json({ ok: true });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
