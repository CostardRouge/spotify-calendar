import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";
import { appBaseUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(appBaseUrl + "/login");
  clearAuthCookies(res);
  return res;
}
