import { NextResponse } from "next/server";
import { getRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Report the current Spotify rate-limit cooldown known to this server.
 * Does NOT contact Spotify — safe to poll before/while deciding to sync.
 * Returns { limited, retryAfter (seconds), until (epoch ms or null) }.
 */
export async function GET() {
  return NextResponse.json(getRateLimit());
}
