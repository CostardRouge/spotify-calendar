import { NextRequest, NextResponse } from "next/server";
import { writeTokenCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/session";
import { fetchAlbumsPage } from "@/lib/spotify";
import { noteRateLimit, clearRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** One page of saved albums: /api/albums?offset=0&limit=50 */
export async function GET(req: NextRequest) {
  const auth = await resolveAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const limit = Math.min(
    50,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50),
  );

  try {
    const page = await fetchAlbumsPage(auth.accessToken, offset, limit);
    clearRateLimit();
    const res = NextResponse.json(page);
    if (auth.refreshed) writeTokenCookies(res, auth.refreshed);
    return res;
  } catch (e) {
    const status = (e as any)?.status;
    if (status === 401) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (status === 429) {
      const retryAfter = Number((e as any).retryAfter) || 60;
      noteRateLimit(retryAfter);
      const mins = Math.max(1, Math.round(retryAfter / 60));
      return NextResponse.json(
        {
          error: "rate_limited",
          detail: `Spotify is rate-limiting this app. Try again in about ${mins} min (${retryAfter}s).`,
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    return NextResponse.json(
      { error: "fetch_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
}
