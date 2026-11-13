import { NextResponse } from "next/server";
import { crossSiteResponse, setUserCookie } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";
import { clearAttempts, consumeToken, markEmailVerified, setPassword, tokenIsLive } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "");
  const password = String(body.password || "");

  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  // Check before consuming, so a rejected password does not burn the link.
  if (!(await tokenIsLive(token, "reset"))) {
    return NextResponse.json({ error: "This link has expired or has already been used.", code: "expired" }, { status: 400 });
  }
  const found = await consumeToken(token, "reset");
  if (!found) return NextResponse.json({ error: "This link has expired or has already been used.", code: "expired" }, { status: 400 });

  // Following an emailed link proves the address, so it also confirms the email.
  let user = await setPassword(found.id, password);
  if (user.status === "pending_email") user = await markEmailVerified(user);
  await clearAttempts(`login:${user.email}`);

  const response = NextResponse.json({ ok: true, status: user.status });
  return user.status === "active" ? setUserCookie(response, user) : response;
}
