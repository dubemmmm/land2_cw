import { NextResponse } from "next/server";
import { clearUserCookie, crossSiteResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  return clearUserCookie(NextResponse.json({ ok: true }));
}
