import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, adminCredentials, createAdminToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const credentials = adminCredentials();

  if (email !== credentials.email.toLowerCase() || password !== credentials.password) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(credentials.email), adminCookieOptions());
  return response;
}
