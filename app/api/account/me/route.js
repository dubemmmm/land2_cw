import { NextResponse } from "next/server";
import { getAdminSession, getUserSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Who is signed in, for the nav and the portal rail.
export async function GET() {
  const [user, admin] = await Promise.all([getUserSession().catch(() => null), getAdminSession().catch(() => null)]);
  return NextResponse.json(
    { user: user ? { name: user.name, role: user.role } : null, admin: Boolean(admin) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
