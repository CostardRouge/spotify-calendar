import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight endpoint used by the Docker healthcheck. */
export async function GET() {
  return NextResponse.json({ status: "ok", uptime: process.uptime() });
}
