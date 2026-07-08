import { NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/session";
import { getDevices } from "@/lib/spotify";
import { mapPlayerError } from "@/lib/playerErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Available Spotify Connect devices: GET /api/player/devices */
export async function GET() {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const devices = await getDevices(auth.accessToken);
    const res = NextResponse.json({ devices });
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    return mapPlayerError(e);
  }
}
