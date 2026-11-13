import { NextResponse } from "next/server";
import { clientIp, crossSiteResponse } from "@/lib/auth";
import { resetEmail } from "@/lib/emailTemplates";
import { sendMail, siteUrl } from "@/lib/mailer";
import { allowAttempt, findUserByEmail, isEmail, issueToken, normalizeEmail } from "@/lib/userStore";

export const dynamic = "force-dynamic";
const HOUR = 60 * 60 * 1000;

// Always answers the same way, whether or not the email has an account.
export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const allowed = (await allowAttempt(`forgot-ip:${clientIp(request)}`, 20, HOUR)) && (await allowAttempt(`mail:${email}`, 3, HOUR));
  if (allowed) {
    const user = await findUserByEmail(email);
    if (user && user.status !== "suspended" && user.status !== "declined") {
      const token = await issueToken(user.id, "reset");
      await sendMail({ to: email, ...resetEmail({ name: user.name, link: `${siteUrl(request)}/reset-password?token=${token}` }) });
    }
  }
  return NextResponse.json({ ok: true });
}
