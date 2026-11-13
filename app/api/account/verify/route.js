import { NextResponse } from "next/server";
import { crossSiteResponse, setUserCookie } from "@/lib/auth";
import { consumeToken, markEmailVerified } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const found = await consumeToken(String(body.token || ""), "verify");
  if (!found) {
    return NextResponse.json({ error: "This link has expired or has already been used." }, { status: 400 });
  }
  const user = await markEmailVerified(found);
  const response = NextResponse.json({ ok: true, status: user.status, role: user.role });
  return user.status === "active" ? setUserCookie(response, user) : response;
}
