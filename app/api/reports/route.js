import { NextResponse } from "next/server";
import { requireAdminApi, requirePortalApi } from "@/lib/auth";
import { clientView, createReport, getReports } from "@/lib/reportStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, refused } = await requirePortalApi();
  if (refused) return refused;
  const reports = await getReports();
  return NextResponse.json(session.admin ? reports : reports.filter((report) => report.clientVisible).map(clientView));
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    const report = await createReport(body);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create report" }, { status: 400 });
  }
}
