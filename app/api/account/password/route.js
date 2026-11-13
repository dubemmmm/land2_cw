import { NextResponse } from "next/server";
import { crossSiteResponse, getUserRow, setUserCookie } from "@/lib/auth";
import { passwordProblem, verifyPassword } from "@/lib/passwords";
import { allowAttempt, setPassword } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const current = await getUserRow();
  if (!current) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const problem = passwordProblem(body.next);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (!(await allowAttempt(`password:${current.id}`, 10, 15 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!(await verifyPassword(String(body.current || ""), current.password_hash))) {
    return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 });
  }
  // Other devices are signed out; this one gets a fresh session.
  const user = await setPassword(current.id, String(body.next));
  return setUserCookie(NextResponse.json({ ok: true }), user);
}
