import { NextResponse } from "next/server";
import { crossSiteResponse } from "@/lib/auth";
import { confirmEmail } from "@/lib/emailTemplates";
import { sendMail, siteUrl } from "@/lib/mailer";
import { allowAttempt, findUserByEmail, isEmail, issueToken, normalizeEmail } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (isEmail(email) && (await allowAttempt(`mail:${email}`, 3, 60 * 60 * 1000))) {
    const user = await findUserByEmail(email);
    if (user && user.status === "pending_email") {
      const token = await issueToken(user.id, "verify");
      await sendMail({ to: email, ...confirmEmail({ name: user.name, role: user.role, link: `${siteUrl(request)}/verify-email?token=${token}` }) });
    }
  }
  return NextResponse.json({ ok: true });
}
