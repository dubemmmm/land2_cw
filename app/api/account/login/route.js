import { NextResponse } from "next/server";
import { crossSiteResponse, setUserCookie, withFaults } from "@/lib/auth";
import { burnPasswordCheck, verifyPassword } from "@/lib/passwords";
import { clearAttempts, findUserByEmail, isLimited, normalizeEmail, recordAttempt } from "@/lib/userStore";

export const dynamic = "force-dynamic";
const WINDOW = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export const POST = withFaults(async (request) => {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const key = `login:${email}`;

  if (await isLimited(key, MAX_FAILURES, WINDOW)) {
    return NextResponse.json({ error: "Too many wrong attempts. Try again in 15 minutes, or reset your password.", code: "locked" }, { status: 429 });
  }

  const user = email ? await findUserByEmail(email) : null;
  const ok = user ? await verifyPassword(password, user.password_hash) : (await burnPasswordCheck(password), false);
  if (!ok) {
    await recordAttempt(key, WINDOW);
    return NextResponse.json({ error: "That email or password is not correct." }, { status: 401 });
  }

  // The password is right, so it is safe to say why the account cannot be used yet.
  if (user.status === "pending_email") {
    return NextResponse.json({ error: "Confirm your email address first. We sent you a link when you signed up.", code: "unverified" }, { status: 403 });
  }
  if (user.status === "pending_approval") {
    return NextResponse.json({ error: "Your agent account is waiting for CW to approve it. We will email you when it is ready.", code: "pending_approval" }, { status: 403 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "This account is not active. Contact CW if you think this is a mistake.", code: "inactive" }, { status: 403 });
  }

  await clearAttempts(key);
  return setUserCookie(NextResponse.json({ ok: true }), user);
});
