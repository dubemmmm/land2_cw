import { NextResponse } from "next/server";
import { crossSiteResponse, getUserRow } from "@/lib/auth";
import { publicUser, updateProfile } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const refused = crossSiteResponse(request);
  if (refused) return refused;
  const current = await getUserRow();
  if (!current) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const company = current.role === "agent" ? String(body.company || "").trim().slice(0, 160) : "";
  if (name.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (current.role === "agent" && company.length < 2) return NextResponse.json({ error: "Enter your agency or company name." }, { status: 400 });
  const user = await updateProfile(current.id, { name, phone, company });
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
