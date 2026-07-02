import { NextResponse } from "next/server";
import { createReport, getReports } from "@/lib/reportStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getReports());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const report = await createReport(body);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create report" }, { status: 400 });
  }
}
