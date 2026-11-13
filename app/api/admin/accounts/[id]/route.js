import { NextResponse } from "next/server";
import { crossSiteResponse, requireAdminApi } from "@/lib/auth";
import { approvedEmail } from "@/lib/emailTemplates";
import { sendMail, siteUrl } from "@/lib/mailer";
import { findUserById, publicUser, setStatus } from "@/lib/userStore";

export const dynamic = "force-dynamic";

// Which status each action may start from, and where it leads.
const actions = {
  approve: { from: ["pending_approval"], to: "active" },
  decline: { from: ["pending_approval"], to: "declined" },
  suspend: { from: ["active"], to: "suspended" },
  reinstate: { from: ["suspended", "declined"], to: "active" }
};

export async function POST(request, { params }) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = actions[body.action];
  const user = await findUserById(id);
  if (!action || !user) return NextResponse.json({ error: "Account or action not found." }, { status: 404 });
  if (!action.from.includes(user.status)) {
    return NextResponse.json({ error: "That action does not apply to this account any more. Refresh the page." }, { status: 409 });
  }
  const updated = await setStatus(user.id, action.to);
  if (body.action === "approve") {
    await sendMail({ to: updated.email, ...approvedEmail({ name: updated.name, loginLink: `${siteUrl(request)}/login` }) });
  }
  return NextResponse.json({ ok: true, user: publicUser(updated) });
}
