import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, adminCredentials, clientIp, createAdminToken, crossSiteResponse } from "@/lib/auth";
import { allowAttempt } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const credentials = adminCredentials();

  if (!credentials) {
    return NextResponse.json({ error: "No admin account is configured on this server." }, { status: 503 });
  }
  // Counting attempts needs the accounts database. If it cannot be reached,
  // say so instead of failing with an empty reply.
  let allowed;
  try {
    allowed = await allowAttempt(`admin-login:${clientIp(request)}`, 10, 15 * 60 * 1000);
  } catch (error) {
    console.error("[admin login] accounts database unavailable:", error.message);
    return NextResponse.json({ error: "Sign-in is unavailable: this server cannot reach its accounts database." }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (email !== credentials.email.toLowerCase() || password !== credentials.password) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(credentials.email), adminCookieOptions());
  return response;
}
