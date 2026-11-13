import { NextResponse } from "next/server";
import { clientIp, crossSiteResponse } from "@/lib/auth";
import { alreadyRegisteredEmail, confirmEmail } from "@/lib/emailTemplates";
import { sendMail, siteUrl } from "@/lib/mailer";
import { passwordProblem } from "@/lib/passwords";
import { ROLES, allowAttempt, createUser, findUserByEmail, isEmail, issueToken, normalizeEmail } from "@/lib/userStore";

export const dynamic = "force-dynamic";
const HOUR = 60 * 60 * 1000;

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  const role = ROLES.includes(body.role) ? body.role : "customer";
  const name = String(body.name || "").trim().slice(0, 120);
  const email = normalizeEmail(body.email);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const company = role === "agent" ? String(body.company || "").trim().slice(0, 160) : "";
  const password = String(body.password || "");

  const errors = {};
  if (name.length < 2) errors.name = "Enter your full name.";
  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  if (role === "agent" && company.length < 2) errors.company = "Enter your agency or company name.";
  if (passwordProblem(password)) errors.password = passwordProblem(password);
  if (Object.keys(errors).length) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });

  if (!(await allowAttempt(`signup:${clientIp(request)}`, 10, HOUR))) {
    return NextResponse.json({ error: "Too many sign-ups from this connection. Try again in an hour." }, { status: 429 });
  }

  // The answer is the same whether or not the email is already registered,
  // so this form cannot be used to find out who has an account.
  const base = siteUrl(request);
  const existing = await findUserByEmail(email);
  if (existing) {
    if (await allowAttempt(`mail:${email}`, 3, HOUR)) {
      if (existing.status === "pending_email") {
        const token = await issueToken(existing.id, "verify");
        await sendMail({ to: email, ...confirmEmail({ name: existing.name, role: existing.role, link: `${base}/verify-email?token=${token}` }) });
      } else {
        await sendMail({ to: email, ...alreadyRegisteredEmail({ name: existing.name, loginLink: `${base}/login`, resetLink: `${base}/forgot-password` }) });
      }
    }
    return NextResponse.json({ ok: true });
  }

  const user = await createUser({ name, email, phone, role, company, password });
  const token = await issueToken(user.id, "verify");
  await sendMail({ to: email, ...confirmEmail({ name, role, link: `${base}/verify-email?token=${token}` }) });
  return NextResponse.json({ ok: true });
}
